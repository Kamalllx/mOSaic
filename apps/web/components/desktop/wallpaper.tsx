"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "@/app/providers";
import { hash2, layoutMosaic, type MosaicLayout, tileAt } from "@/lib/desktop/mosaic";
import { FOLDER_HUES } from "@/lib/desktop/palette";
import { strList } from "@/lib/events";
import { useAllDocs } from "./hooks";

/** The field behind the tesserae: a soft multicolour gradient, like a macOS wallpaper. */
function paintField(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean) {
  ctx.fillStyle = dark ? "#141824" : "#eef2fb";
  ctx.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = dark
    ? [[0.12, 0.1, 0.7, "rgba(47,124,246,0.35)"], [0.9, 0.12, 0.6, "rgba(197,108,240,0.30)"], [0.15, 0.95, 0.65, "rgba(20,168,154,0.30)"], [0.88, 0.9, 0.6, "rgba(255,138,61,0.22)"]]
    : [[0.1, 0.08, 0.75, "rgba(122,190,255,0.85)"], [0.92, 0.1, 0.65, "rgba(255,170,214,0.8)"], [0.12, 0.98, 0.7, "rgba(140,232,196,0.85)"], [0.9, 0.92, 0.65, "rgba(255,200,140,0.85)"], [0.5, 0.5, 0.45, "rgba(200,184,255,0.55)"]];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

type Flare = { t0: number; kind: "read" | "flagged" | "stale" | "changed" };
const FLARE_MS: Record<Flare["kind"], number> = { read: 2600, flagged: 9000, stale: 12000, changed: 3000 };
const FLARE_COLOR: Record<Flare["kind"], string> = { read: "43,184,163", flagged: "235,106,106", stale: "217,154,37", changed: "106,155,227" };

/** The desktop's wallpaper: the organisation's knowledge as a mosaic. Tiles flare when agents read them (red when the
 *  firewall flagged the document), pulse amber when a source change invalidates memories, and open in Files on click. */
export function Wallpaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flares = useRef(new Map<string, Flare>());
  const kick = useRef<() => void>(() => {});
  const client = useClient();
  const router = useRouter();
  const docs = useAllDocs().data;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; title: string; path: string } | null>(null);

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const layout: MosaicLayout | null = useMemo(
    // On wide screens the widgets take the right edge, so the folder patches sit a little left of centre.
    () => (docs && size.w ? layoutMosaic(docs, size.w, size.h, size.w < 700 ? 22 : 28, size.w >= 1100 ? { cx: 0.42, rx: 0.31, avoid: [0.24, 0.1, 0.61, 0.46] } : {}) : null),
    [docs, size.w, size.h],
  );

  // Live flares from the kernel's events.
  useEffect(
    () =>
      client.events(
        (e) => {
          const now = performance.now();
          const add = (paths: string[], kind: Flare["kind"]) => paths.forEach((p) => flares.current.set(p, { t0: now, kind }));
          if (e.type === "knowledge.retrieved") {
            const flagged = strList(e, "flagged");
            add(strList(e, "paths").filter((p) => !flagged.includes(p)), "read");
            add(flagged, "flagged");
          } else if (e.type === "memory.invalidated") {
            const src = e.payload?.source;
            if (typeof src === "string") add([src], "stale");
          } else if (e.type === "knowledge.changed") {
            const p = e.payload?.path;
            if (typeof p === "string") add([p], "changed");
          } else return;
          kick.current();
        },
        { types: ["knowledge.retrieved", "memory.invalidated", "knowledge.changed"] },
      ),
    [client],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Canvas fonts can't read CSS variables: resolve the bundled mono face's family name once.
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains-mono").trim() || "monospace";
    const labelInk = dark ? "rgba(226,232,240,0.7)" : "rgba(29,29,31,0.55)";
    const cell = layout?.cell ?? 28;
    const cols = Math.ceil(size.w / cell) + 1;
    const rows = Math.ceil(size.h / cell) + 1;
    const docAt = new Map((layout?.tiles ?? []).map((t) => [`${t.col},${t.row}`, t]));

    const tess = (c: number, r: number, fill: string | CanvasGradient, lift = 0, gloss = false) => {
      const j = hash2(c, r);
      const k = hash2(r + 7, c + 13);
      const inset = 2.2 + j * 1.6 - lift;
      const x = c * cell + inset + (k - 0.5) * 1.6;
      const y = r * cell + inset + (j - 0.5) * 1.6;
      const s = cell - inset * 2;
      ctx.save();
      ctx.translate(x + s / 2, y + s / 2);
      ctx.rotate((j - 0.5) * 0.07);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s * (0.9 + k * 0.1), 4);
      ctx.fill();
      if (gloss) {
        // A glossy top half and a hairline highlight, like glazed glass tesserae.
        const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
        g.addColorStop(0, "rgba(255,255,255,0.45)");
        g.addColorStop(0.5, "rgba(255,255,255,0.05)");
        g.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
    };

    let raf = 0;
    const draw = () => {
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintField(ctx, size.w, size.h, dark);
      // Filler tesserae: the field the organisation's documents sit in.
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (docAt.has(`${c},${r}`)) continue;
          const v = hash2(c * 3 + 1, r * 5 + 2);
          tess(c, r, dark ? `rgba(255,255,255,${0.03 + v * 0.05})` : `rgba(255,255,255,${0.2 + v * 0.22})`);
        }
      }
      let live = false;
      for (const t of layout?.tiles ?? []) {
        const hue = FOLDER_HUES[t.folder] ?? "#8a94a6";
        const f = flares.current.get(t.path);
        const age = f ? now - f.t0 : Infinity;
        if (f && age < FLARE_MS[f.kind]) {
          live = true;
          const p = age / FLARE_MS[f.kind];
          const pulse = f.kind === "flagged" || f.kind === "stale" ? 0.55 + 0.45 * Math.cos(age / 260) : 1;
          const a = (1 - p) * pulse;
          tess(t.col, t.row, hue, 0, true);
          ctx.save();
          ctx.shadowColor = `rgba(${FLARE_COLOR[f.kind]},${0.9 * a})`;
          ctx.shadowBlur = 18 * a;
          tess(t.col, t.row, `rgba(${FLARE_COLOR[f.kind]},${0.35 + 0.55 * a})`, 1);
          ctx.restore();
          // A ring that opens once when the flare starts.
          if (age < 900 && !reduced) {
            const q = age / 900;
            ctx.strokeStyle = `rgba(${FLARE_COLOR[f.kind]},${0.6 * (1 - q)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc((t.col + 0.5) * cell, (t.row + 0.5) * cell, cell * (0.5 + q * 1.4), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          if (f) flares.current.delete(t.path);
          tess(t.col, t.row, hue, 0, true);
        }
      }
      ctx.font = `600 11px ${mono}, ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = labelInk;
      for (const l of layout?.labels ?? []) ctx.fillText(l.folder, l.x, l.y);
      raf = live && !reduced ? requestAnimationFrame(draw) : 0;
    };
    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      kick.current = () => {};
    };
  }, [layout, size.w, size.h, dark]);

  return (
    <div className="absolute inset-0" aria-hidden>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        onPointerMove={(e) => {
          const t = layout && tileAt(layout, e.clientX, e.clientY);
          setHover(t ? { x: e.clientX, y: e.clientY, title: t.title ?? t.path, path: t.path } : null);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const t = layout && tileAt(layout, e.clientX, e.clientY);
          if (t) router.push(`/knowledge?path=${encodeURIComponent(t.path)}`);
        }}
        style={{ cursor: hover ? "pointer" : "default" }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface-2/95 px-2.5 py-1.5 shadow-panel"
          style={{ left: Math.min(hover.x + 14, size.w - 280), top: hover.y + 14 }}
        >
          <p className="text-sm font-medium">{hover.title}</p>
          <p className="font-mono text-xs text-text-2">{hover.path}</p>
        </div>
      )}
    </div>
  );
}
