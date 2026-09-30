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

/** Each app's tile colour, from the same mineral family as the wallpaper. */
export const APP_TINT: Record<AppId, string> = {
  tasks: "#2b8f80",
  task: "#2b8f80",
  approvals: "#a8741c",
  files: "#3d5f8a",
  memory: "#6b5a8e",
  journals: "#5d6b7c",
  journal: "#5d6b7c",
  programs: "#4f6a3d",
  monitor: "#7c4a44",
  terminal: "#2a3038",
};

/** An app's icon as a tessera: its glyph on a small tile in the app's colour. */
export function AppTile({ app, size = 40, className }: { app: AppId; size?: number; className?: string }) {
  const Icon = APP_ICON[app];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-[28%] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.35)]", className)}
      style={{ width: size, height: size, background: `linear-gradient(160deg, color-mix(in srgb, ${APP_TINT[app]} 88%, white), ${APP_TINT[app]})` }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}
