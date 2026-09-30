"use client";

import { LayoutGrid } from "lucide-react";
import { useRef, useState } from "react";
import { APPS, type AppId } from "@/lib/desktop/routes";
import type { Win } from "@/lib/desktop/windows";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";
import { usePendingApprovals, useTasks } from "./hooks";
import { Orb } from "./orb";
import { DOCK_APPS } from "./shortcuts";

/** Windows that belong to a dock app (a task window counts as Tasks, a journal as Audit). */
const FAMILY: Partial<Record<AppId, AppId[]>> = { tasks: ["tasks", "task"], journals: ["journals", "journal"] };
const BASE = 50;
const REACH = 140;
const GROW = 0.55;

/** How much an icon grows with the pointer's distance from its centre (macOS magnification). */
export function magnify(distance: number | null): number {
  if (distance === null) return 1;
  return 1 + GROW * Math.max(0, 1 - Math.abs(distance) / REACH) ** 1.6;
}

export function Dock({ wins, focusedKey, compact, onApp, onDesktop }: { wins: Win[]; focusedKey?: string; compact: boolean; onApp: (app: AppId, home: string) => void; onDesktop: () => void }) {
  const pending = usePendingApprovals().data?.length ?? 0;
  const running = (useTasks().data ?? []).some((t) => isActive(t.status));
  const items = compact ? (["tasks", "approvals", "files", "terminal"] as AppId[]) : DOCK_APPS;
  // Distances from the pointer to each icon's centre, measured in the pointer handler (never during render).
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const scale = (id: string) => (compact || !dist || dist[id] === undefined ? 1 : magnify(dist[id]));
  const measure = (x: number) => {
    const d: Record<string, number> = {};
    for (const [id, el] of Object.entries(refs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      d[id] = x - (r.left + r.width / 2);
    }
    setDist(d);
  };

  const entry = (id: string, label: string, content: (size: number) => React.ReactNode, onClick: () => void, open?: boolean, active?: boolean, bounce?: boolean) => {
    const size = Math.round((compact ? 40 : BASE) * scale(id));
    return (
      <button
        key={id}
        ref={(el) => {
          refs.current[id] = el;
        }}
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "true" : undefined}
        className="group relative flex flex-col items-center gap-1 outline-offset-4"
      >
        <span className={cn("transition-[width,height] duration-100 ease-out active:brightness-90", bounce && "dock-bounce")} style={{ width: size, height: size }}>
          {content(size)}
        </span>
        {compact ? (
          <span className={cn("text-[11px]", active ? "text-foreground" : "text-text-2")}>{label}</span>
        ) : (
          <span className="material-strong pointer-events-none absolute -top-10 hidden whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-chrome-ink shadow-window-idle group-hover:block group-focus-visible:block">
            {label}
          </span>
        )}
        <span className={cn("size-1 rounded-full", open ? "bg-chrome-ink/70" : "bg-transparent")} aria-hidden />
      </button>
    );
  };

  return (
    <nav
      aria-label="Dock"
      onPointerMove={(e) => !compact && measure(e.clientX)}
      onPointerLeave={() => setDist(null)}
      className={cn(
        "material z-[5000] flex items-end",
        compact ? "w-full justify-around rounded-none border-x-0 border-b-0 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]" : "gap-2 rounded-[22px] px-3 pt-2.5 pb-1 shadow-window",
      )}
    >
      {entry(
        "desktop",
        "Desktop",
        (s) => (
          <span
            className="flex size-full items-center justify-center bg-gradient-to-b from-white to-[#e7eaf0] text-[#3b4252] shadow-[inset_0_1px_0_white,0_2px_6px_rgb(15_23_42/0.2)] dark:from-[#4a5160] dark:to-[#2b3039] dark:text-white"
            style={{ borderRadius: s * 0.235 }}
            aria-hidden
          >
            <LayoutGrid style={{ width: s * 0.5, height: s * 0.5 }} />
          </span>
        ),
        onDesktop,
        false,
        !focusedKey,
      )}
      {!compact && <span className="mx-0.5 mb-3 h-10 w-px self-center bg-hairline" aria-hidden />}
      {items.map((app) => {
        const family = FAMILY[app] ?? [app];
        const open = wins.some((w) => family.includes(w.app));
        const active = wins.some((w) => w.key === focusedKey && family.includes(w.app));
        return entry(
          app,
          APPS[app].title,
          (s) => (
            <span className="relative block">
              <AppTile app={app} size={s} />
              {app === "approvals" && pending > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-[#ff3b30] px-1.5 text-center text-xs font-bold leading-5 text-white shadow">{pending}</span>
              )}
              {app === "tasks" && running && (
                <span className="absolute -top-2 -right-2 rounded-full bg-white p-0.5 shadow dark:bg-surface-2">
                  <Orb state="working" label="a task is running" />
                </span>
              )}
            </span>
          ),
          () => onApp(app, APPS[app].home),
          open,
          active,
          app === "approvals" && pending > 0,
        );
      })}
    </nav>
  );
}
