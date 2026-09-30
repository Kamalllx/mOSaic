"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Monitor, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useClient } from "@/app/providers";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";
import { usePendingApprovals, useResources, useTasks } from "./hooks";
import { Mark, Wordmark } from "./logo";
import { Orb } from "./orb";

const noop = () => () => {};

const subscribeClock = (tick: () => void) => {
  const t = setInterval(tick, 10_000);
  return () => clearInterval(t);
};
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Clock() {
  const time = useSyncExternalStore(subscribeClock, timeNow, () => "");
  return <span className="whitespace-nowrap font-mono text-xs tabular-nums text-text-2">{time}</span>;
}

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const order = ["system", "light", "dark"] as const;
  const current = mounted ? ((theme as (typeof order)[number]) ?? "system") : "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Theme: ${current}. Switch to ${next}`} title={`Theme: ${current}`} className="bar-btn">
      <Icon className="size-3.5" />
    </button>
  );
}

/** The menu bar: the system's name and the focused window on the left; live system state on the right. */
export function TopBar({ title, onLauncher, onBell }: { title?: string; onLauncher: () => void; onBell: () => void }) {
  const client = useClient();
  const pending = usePendingApprovals().data?.length ?? 0;
  const running = (useTasks().data ?? []).filter((t) => isActive(t.status)).length;
  const gpu = useResources().data?.gpu;
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => client.status(), refetchInterval: 15_000 });
  const vram = gpu ? (100 * gpu.memory_used_mb) / Math.max(1, gpu.memory_total_mb) : 0;

  return (
    <header className="relative z-[5000] flex h-8 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-3 text-sm">
      <Link href="/" className="flex items-center gap-2 rounded px-1 hover:bg-surface-3" title="Show the desktop">
        <Mark className="size-4" />
        <Wordmark className="text-[13px]" />
      </Link>
      {title && <span className="hidden min-w-0 truncate font-semibold sm:inline">{title}</span>}
      {status.data && (
        <span className="hidden font-mono text-xs text-text-2 lg:inline">
          kernel {status.data.version} · contract {status.data.contract_version}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onLauncher} className="bar-btn hidden gap-1.5 px-2 sm:inline-flex" aria-label="Open the launcher">
          <Search className="size-3.5" />
          <kbd className="font-mono text-[11px] text-text-2">Ctrl K</kbd>
        </button>
        {running > 0 && (
          <Link href="/tasks" className="bar-btn gap-1.5 px-2" title="Running tasks">
            <Orb state="working" label="tasks running" />
            <span className="font-mono text-xs">{running} running</span>
          </Link>
        )}
        {gpu && (
          <Link href="/system" className="bar-btn hidden gap-2 px-2 md:inline-flex" title={gpu.name}>
            <span className="font-mono text-xs tabular-nums">GPU {gpu.utilization.toFixed(0)}%</span>
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className={cn("block h-full rounded-full transition-[width] duration-300", vram > 92 ? "bg-st-failed" : "bg-brand")} style={{ width: `${vram}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums text-text-2">{(gpu.memory_used_mb / 1024).toFixed(1)} GB</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onBell}
          aria-label={pending ? `${pending} approvals waiting` : "No approvals waiting"}
          className={cn("bar-btn gap-1 px-2", pending > 0 && "bg-st-waiting text-black hover:bg-st-waiting/90")}
        >
          <Bell className="size-3.5" />
          {pending > 0 && <span className="font-mono text-xs font-bold">{pending}</span>}
        </button>
        <ThemeButton />
        <Clock />
      </div>
    </header>
  );
}
