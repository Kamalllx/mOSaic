"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "@/app/providers";
import { hash2, layoutMosaic } from "@/lib/desktop/mosaic";
import { FOLDER_HUES } from "@/lib/desktop/palette";
import { strList } from "@/lib/events";
import { useAllDocs } from "./hooks";

type Flare = { t0: number; kind: "read" | "flagged" | "stale" | "changed" };
const FLARE_MS: Record<Flare["kind"], number> = { read: 2400, flagged: 9000, stale: 12000, changed: 3000 };
const FLARE_RGB: Record<Flare["kind"], string> = { read: "20,184,166", flagged: "239,68,68", stale: "245,158,11", changed: "59,130,246" };

interface Node {
  path: string;
  title: string;
  folder: string;
  x: number;
  y: number;
  hue: string;
}

/** The organisation's knowledge drawn on the desktop as a constellation: one node per /org document, each folder a
 *  linked cluster in its own colour. Painted once; only flares animate, on a separate layer and only while live. */
export function Wallpaper({ avoid }: { avoid?: [number, number, number, number] }) {
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const flares = useRef(new Map<string, Flare>());
  const kick = useRef<() => void>(() => {});
  const client = useClient();
  const router = useRouter();
  const docs = useAllDocs().data;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Node | null>(null);

  useEffect(() => {
    let t = 0;
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const on = () => {
      clearTimeout(t);
      t = window.setTimeout(measure, 120);
    };
    measure();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const nodes: Node[] = useMemo(() => {
    if (!docs || !size.w) return [];
    const cell = size.w < 700 ? 24 : 30;
    const wide = size.w >= 1100;
    const m = layoutMosaic(docs, size.w, size.h, cell, wide ? { cx: 0.55, rx: 0.27, avoid } : {});
    return m.tiles.map((t) => {
      const j = hash2(t.col, t.row);
      const k = hash2(t.row + 11, t.col + 5);
      return { path: t.path, title: t.title ?? t.path, folder: t.folder, x: (t.col + 0.5 + (j - 0.5) * 0.6) * cell, y: (t.row + 0.5 + (k - 0.5) * 0.6) * cell, hue: FOLDER_HUES[t.folder] ?? "#8a94a6" };
    });
  }, [docs, size.w, size.h, avoid]);
  const byPath = useMemo(() => new Map(nodes.map((n) => [n.path, n])), [nodes]);

  // The static layer: links within each folder, the nodes, the folder names. Redrawn only when data, size or theme change.
  useEffect(() => {
    const c = base.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !size.w) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const folders = new Map<string, Node[]>();
    for (const n of nodes) folders.set(n.folder, [...(folders.get(n.folder) ?? []), n]);
    for (const [, group] of folders) {
      // Each node links to its nearest earlier node in the folder: a light tree, not a hairball.
      ctx.strokeStyle = `${group[0].hue}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      group.forEach((n, i) => {
        if (!i) return;
        let best = group[0];
        for (const m of group.slice(0, i)) if ((m.x - n.x) ** 2 + (m.y - n.y) ** 2 < (best.x - n.x) ** 2 + (best.y - n.y) ** 2) best = m;
        ctx.moveTo(best.x, best.y);
        ctx.lineTo(n.x, n.y);
      });
      ctx.stroke();
    }
    for (const n of nodes) {
      ctx.fillStyle = `${n.hue}26`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.hue;
      ctx.strokeStyle = dark ? "#0e121c" : "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains-mono").trim() || "monospace";
    ctx.font = `600 11px ${mono}, monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = dark ? "rgba(226,232,240,0.6)" : "rgba(15,23,42,0.5)";
    for (const [folder, group] of folders) {
      const top = group.reduce((a, b) => (b.y < a.y ? b : a));
      const cx = group.reduce((s, n) => s + n.x, 0) / group.length;
      ctx.fillText(folder, cx, top.y - 14);
    }
  }, [nodes, size.w, size.h, dark]);

  // Live flares from the kernel's events, on the overlay; the loop runs only while one is alive.
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
          } else if (e.type === "memory.invalidated" && typeof e.payload?.source === "string") add([e.payload.source], "stale");
          else if (e.type === "knowledge.changed" && typeof e.payload?.path === "string") add([e.payload.path], "changed");
          else return;
          kick.current();
        },
        { types: ["knowledge.retrieved", "memory.invalidated", "knowledge.changed"] },
      ),
    [client],
  );

  useEffect(() => {
    const c = overlay.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !size.w) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = () => {
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      let live = false;
      for (const [path, f] of flares.current) {
        const n = byPath.get(path);
        const age = now - f.t0;
        if (!n || age > FLARE_MS[f.kind]) {
          flares.current.delete(path);
          continue;
        }
        live = true;
        const fade = 1 - age / FLARE_MS[f.kind];
        const pulse = f.kind === "flagged" || f.kind === "stale" ? 0.6 + 0.4 * Math.cos(age / 220) : 1;
        const rgb = FLARE_RGB[f.kind];
        ctx.fillStyle = `rgba(${rgb},${0.28 * fade * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${rgb},${0.9 * fade})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        if (!reduced && age < 1000) {
          const q = age / 1000;
          ctx.strokeStyle = `rgba(${rgb},${0.7 * (1 - q)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 8 + q * 30, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      raf = live && !reduced ? requestAnimationFrame(draw) : 0;
    };
    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    return () => {
      cancelAnimationFrame(raf);
      kick.current = () => {};
    };
  }, [byPath, size.w, size.h]);

  const hit = (x: number, y: number) => {
    let best: Node | null = null;
    let d = 144;
    for (const n of nodes) {
      const dd = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (dd < d) {
        d = dd;
        best = n;
      }
    }
    return best;
  };

  return (
    <div className="ground absolute inset-0" aria-hidden>
      <canvas ref={base} className="absolute inset-0 size-full" />
      <canvas
        ref={overlay}
        className="absolute inset-0 size-full"
        onPointerMove={(e) => {
          const n = hit(e.clientX, e.clientY);
          if (n?.path !== hover?.path) setHover(n);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const n = hit(e.clientX, e.clientY);
          if (n) router.push(`/knowledge?path=${encodeURIComponent(n.path)}`);
        }}
        style={{ cursor: hover ? "pointer" : "default" }}
      />
      {hover && (
        <div className="panel pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5" style={{ left: Math.min(hover.x + 14, size.w - 300), top: hover.y + 14 }}>
          <p className="text-sm font-medium">{hover.title}</p>
          <p className="font-mono text-xs text-text-2">{hover.path}</p>
        </div>
      )}
    </div>
  );
}
