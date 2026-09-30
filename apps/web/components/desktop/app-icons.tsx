"use client";

import { BellRing, Brain, Cpu, FolderTree, Gauge, ListChecks, type LucideIcon, ScrollText, SquareTerminal, Workflow } from "lucide-react";
import type { AppId } from "@/lib/desktop/routes";
import { cn } from "@/lib/utils";

export const APP_ICON: Record<AppId, LucideIcon> = {
  tasks: ListChecks,
  task: Workflow,
  approvals: BellRing,
  files: FolderTree,
  memory: Brain,
  journals: ScrollText,
  journal: ScrollText,
  programs: Cpu,
  monitor: Gauge,
  terminal: SquareTerminal,
};

/** Each app's icon gradient (top-left to bottom-right), bright like a macOS app icon. */
export const APP_GRADIENT: Record<AppId, [string, string]> = {
  tasks: ["#34d8b4", "#0e9f86"],
  task: ["#34d8b4", "#0e9f86"],
  approvals: ["#ffc24b", "#f5860f"],
  files: ["#5ab0ff", "#2563eb"],
  memory: ["#c58cff", "#8b3fe8"],
  journals: ["#9fb4c9", "#5a6f86"],
  journal: ["#9fb4c9", "#5a6f86"],
  programs: ["#86e36b", "#2f9e44"],
  monitor: ["#ff8a80", "#e5484d"],
  terminal: ["#3a4150", "#171b22"],
};

/** The app's colour, for small accents (the window's title bar tint, chips). */
export const APP_TINT: Record<AppId, string> = Object.fromEntries(Object.entries(APP_GRADIENT).map(([k, v]) => [k, v[1]])) as Record<AppId, string>;

/** An app icon: its glyph on a glossy squircle in the app's gradient. */
export function AppTile({ app, size = 40, className }: { app: AppId; size?: number; className?: string }) {
  const Icon = APP_ICON[app];
  const [from, to] = APP_GRADIENT[app];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.235,
        background: `linear-gradient(155deg, ${from}, ${to})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 -1px 0 rgb(0 0 0 / 0.12), 0 ${size * 0.06}px ${size * 0.16}px rgb(15 23 42 / 0.28)`,
      }}
      aria-hidden
    >
      <span className="absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(180deg, rgb(255 255 255 / 0.28), transparent)" }} />
      {app === "terminal" ? (
        <span className="relative font-mono font-bold text-[#5ff0a8]" style={{ fontSize: size * 0.34 }}>
          &gt;_
        </span>
      ) : (
        <Icon className="relative drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2} />
      )}
    </span>
  );
}
