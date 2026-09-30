"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "@/app/providers";
import { hash2, layoutMosaic, type MosaicLayout, tileAt } from "@/lib/desktop/mosaic";
import { strList } from "@/lib/events";
import { useAllDocs } from "./hooks";

/** Folder hues: muted minerals, one per /org folder, tuned for each theme. */
const HUES: Record<string, [dark: string, light: string]> = {
  decisions: ["#4b6076", "#9fb3c8"],
  engineering: ["#3d5f8a", "#93b1d6"],
  finance: ["#3c6d60", "#8fc2b1"],
  inbox: ["#7c4a44", "#d4a39c"],
  jira: ["#58527f", "#aaa3cf"],
  meetings: ["#6c6350", "#c7bb9d"],
  people: ["#5a5561", "#b4aebb"],
  playbooks: ["#4a6a62", "#9ec3b8"],
  policies: ["#566b3d", "#b0c58f"],
  projects: ["#6d5c4c", "#c9b19a"],
  slack: ["#735f38", "#d0b27a"],
  systems: ["#4c5664", "#a5afbd"],
};
const FALLBACK: [string, string] = ["#4d5561", "#a9b1bc"];

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
    () => (docs && size.w ? layoutMosaic(docs, size.w, size.h, size.w < 700 ? 22 : 28) : null),
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
    const grout = dark ? "#07090c" : "#d3d8de";
    const labelInk = dark ? "rgba(169,179,191,0.55)" : "rgba(71,85,105,0.7)";
    const cell = layout?.cell ?? 28;
    const cols = Math.ceil(size.w / cell) + 1;
    const rows = Math.ceil(size.h / cell) + 1;
    const docAt = new Map((layout?.tiles ?? []).map((t) => [`${t.col},${t.row}`, t]));

    const tess = (c: number, r: number, fill: string, lift = 0) => {
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
      ctx.roundRect(-s / 2, -s / 2, s, s * (0.9 + k * 0.1), 3);
      ctx.fill();
      ctx.restore();
    };

    let raf = 0;
    const draw = () => {
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = grout;
      ctx.fillRect(0, 0, size.w, size.h);
      // Filler tesserae: the field the organisation's documents sit in.
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (docAt.has(`${c},${r}`)) continue;
          const v = hash2(c * 3 + 1, r * 5 + 2);
          const l = dark ? 8 + v * 5 : 88 + v * 5;
          tess(c, r, `hsl(214 ${dark ? 14 : 12}% ${l}%)`);
        }
      }
      let live = false;
      for (const t of layout?.tiles ?? []) {
        const hue = (HUES[t.folder] ?? FALLBACK)[dark ? 0 : 1];
        const f = flares.current.get(t.path);
        const age = f ? now - f.t0 : Infinity;
        if (f && age < FLARE_MS[f.kind]) {
          live = true;
          const p = age / FLARE_MS[f.kind];
          const pulse = f.kind === "flagged" || f.kind === "stale" ? 0.55 + 0.45 * Math.cos(age / 260) : 1;
          const a = (1 - p) * pulse;
          tess(t.col, t.row, hue, 0);
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
          tess(t.col, t.row, hue);
        }
      }
      ctx.font = "500 11px var(--font-jetbrains-mono), ui-monospace, monospace";
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
