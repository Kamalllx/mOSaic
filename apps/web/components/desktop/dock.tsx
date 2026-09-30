"use client";

import { LayoutGrid } from "lucide-react";
import { APPS, type AppId } from "@/lib/desktop/routes";
import type { Win } from "@/lib/desktop/windows";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";
import { usePendingApprovals, useTasks } from "./hooks";
import { Orb } from "./orb";

const DOCK: AppId[] = ["tasks", "approvals", "files", "memory", "journals", "programs", "monitor", "terminal", "settings"];
/** Windows that belong to a dock app (a task window counts as Tasks, a journal as Journal). */
const FAMILY: Partial<Record<AppId, AppId[]>> = { tasks: ["tasks", "task"], journals: ["journals", "journal"] };

export function Dock({ wins, focusedKey, compact, onApp, onDesktop }: { wins: Win[]; focusedKey?: string; compact: boolean; onApp: (app: AppId, home: string) => void; onDesktop: () => void }) {
  const pending = usePendingApprovals().data?.length ?? 0;
  const running = (useTasks().data ?? []).some((t) => isActive(t.status));
  const items = compact ? (["tasks", "approvals", "files", "terminal"] as AppId[]) : DOCK;

  return (
    <nav
      aria-label="Dock"
      className={cn(
        "z-[5000] flex items-end gap-1.5 border border-line bg-surface-1/95 shadow-window",
        compact ? "w-full justify-around rounded-none border-x-0 border-b-0 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]" : "rounded-[18px] px-2.5 pt-2 pb-1.5",
      )}
    >
      <DockItem label="Desktop" onClick={onDesktop} active={!focusedKey} compact={compact}>
        <span className="inline-flex size-10 items-center justify-center rounded-[28%] bg-surface-3 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" aria-hidden>
          <LayoutGrid className="size-5" />
        </span>
      </DockItem>
      {!compact && <span className="mx-1 mb-2 h-8 w-px bg-line" aria-hidden />}
      {items.map((app) => {
        const family = FAMILY[app] ?? [app];
        const open = wins.some((w) => family.includes(w.app));
        const focused = wins.some((w) => w.key === focusedKey && family.includes(w.app));
        return (
          <DockItem key={app} label={APPS[app].title} onClick={() => onApp(app, APPS[app].home)} open={open} active={focused} compact={compact}>
            <span className="relative">
              <AppTile app={app} />
              {app === "approvals" && pending > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-st-waiting px-1 text-center font-mono text-xs font-bold text-black ring-2 ring-surface-1">
                  {pending}
                </span>
              )}
              {app === "tasks" && running && (
                <span className="absolute -top-2 -right-2 rounded-full bg-surface-1 ring-2 ring-surface-1">
                  <Orb state="working" label="a task is running" />
                </span>
              )}
            </span>
          </DockItem>
        );
      })}
    </nav>
  );
}

function DockItem({ label, onClick, open, active, compact, children }: { label: string; onClick: () => void; open?: boolean; active?: boolean; compact: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-current={active ? "true" : undefined} className="dock-item group relative flex flex-col items-center gap-1 rounded-lg px-1 pt-0.5 outline-offset-4">
      <span className="transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-95">{children}</span>
      {compact ? (
        <span className={cn("text-[11px]", active ? "text-foreground" : "text-text-2")}>{label}</span>
      ) : (
        <span className="pointer-events-none absolute -top-9 hidden whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium shadow-panel group-hover:block group-focus-visible:block">
          {label}
        </span>
      )}
      <span className={cn("size-1 rounded-full", open ? (active ? "bg-brand" : "bg-text-2") : "bg-transparent")} aria-hidden />
    </button>
  );
}
