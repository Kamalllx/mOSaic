"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useClient } from "@/app/providers";
import { approvalHeadline } from "@/components/approval-card";
import { TaskStatusBadge, duration } from "@/components/status";
import { byNewest } from "@/components/task-row";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";
import { useAllDocs, usePendingApprovals, useResources, useTasks } from "./hooks";
import { Orb } from "./orb";

const subscribe = (tick: () => void) => {
  const t = setInterval(tick, 15_000);
  return () => clearInterval(t);
};
const timeNow = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "");
const dateNow = () => new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/** The empty desktop's centrepiece: the time, and one way in. */
export function Hero({ onAsk, compact }: { onAsk: () => void; compact: boolean }) {
  const time = useSyncExternalStore(subscribe, timeNow, () => "");
  const date = useSyncExternalStore(subscribe, dateNow, () => "");
  const hello = useSyncExternalStore(subscribe, greeting, () => "");
  return (
    <div className="flex flex-col items-center text-center text-[#1d1d1f] dark:text-white">
      <p className={cn("font-extralight tracking-[-0.04em] tabular-nums [text-shadow:0_2px_24px_rgb(255_255_255/0.6)] dark:[text-shadow:none]", compact ? "text-7xl" : "text-[124px] leading-none")}>{time}</p>
      <p className="mt-2 text-lg font-medium opacity-80">
        {date} · {hello}
      </p>
      <button
        type="button"
        onClick={onAsk}
        className="material-strong group mt-8 flex h-14 w-[min(600px,calc(100vw-40px))] items-center gap-3 rounded-full px-4 text-left shadow-window transition-transform hover:scale-[1.01] active:scale-[0.99]"
        aria-label="Ask mOSaic (Alt Space)"
      >
        <Orb state="breathing" size={32} label="mOSaic" />
        <span className="flex-1 text-[17px] text-text-2">What should mOSaic work on?</span>
        <kbd className="rounded-md border border-hairline bg-surface-1/80 px-2 py-0.5 font-mono text-xs text-text-2">Alt Space</kbd>
      </button>
    </div>
  );
}

function Widget({ title, tint, href, children }: { title: string; tint: string; href: string; children: React.ReactNode }) {
  return (
    <section className="material-strong stage-in rounded-[22px] p-3.5 shadow-window-idle">
      <Link href={href} className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold hover:underline" style={{ color: tint }}>
        {title}
      </Link>
      {children}
    </section>
  );
}

/** Desktop widgets, macOS-style: running work, what needs you, the machine, the knowledge. */
export function Widgets() {
  const client = useClient();
  const tasks = [...(useTasks().data ?? [])].sort(byNewest);
  const pending = usePendingApprovals().data ?? [];
  const res = useResources().data;
  const docs = useAllDocs().data ?? [];
  const valid = useQuery({ queryKey: ["knowledge-validate"], queryFn: () => client.validate(), staleTime: 5 * 60_000 });
  const running = tasks.filter((t) => isActive(t.status));
  const shown = (running.length ? running : tasks).slice(0, 3);
  const folders = new Set(docs.map((d) => d.path.split("/")[2])).size;
  const gpu = res?.gpu;
  const bar = (label: string, pct: number, text: string) => (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-text-2">{label}</span>
        <span className="font-mono tabular-nums">{text}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className={cn("h-full rounded-full", pct > 90 ? "bg-st-failed" : "bg-gradient-to-r from-[#34d8b4] to-[#2563eb]")} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="flex w-[300px] flex-col gap-3">
      <Widget title={running.length ? `Running now · ${running.length}` : "Recent tasks"} tint="#0e9f86" href="/tasks">
        <ul className="space-y-2">
          {shown.map((t) => (
            <li key={t.task_id}>
              <Link href={`/tasks/${t.task_id}`} className="flex items-center gap-2 rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5">
                {isActive(t.status) ? <Orb state="working" label="running" /> : <AppTile app="task" size={20} />}
                <span className="min-w-0 flex-1 truncate text-sm">{t.goal}</span>
                {isActive(t.status) ? <span className="font-mono text-xs text-text-2">{duration(t.created_at, null)}</span> : <TaskStatusBadge status={t.status} />}
              </Link>
            </li>
          ))}
          {!shown.length && <li className="text-sm text-text-2">No tasks yet. Press Alt Space.</li>}
        </ul>
      </Widget>

      <Widget title={pending.length ? `Needs you · ${pending.length}` : "Needs you"} tint="#f5860f" href="/approvals">
        {pending.length ? (
          <Link href={`/tasks/${pending[0].task_id}`} className="block rounded-lg bg-st-waiting/10 p-2 text-sm font-medium hover:bg-st-waiting/15">
            {approvalHeadline(pending[0])}
          </Link>
        ) : (
          <p className="text-sm text-text-2">Nothing is waiting for a decision.</p>
        )}
      </Widget>

      <Widget title="This machine" tint="#e5484d" href="/system">
        <div className="space-y-2">
          {gpu && bar(`GPU · ${gpu.name.replace(/^NVIDIA GeForce /, "")}`, (100 * gpu.memory_used_mb) / Math.max(1, gpu.memory_total_mb), `${(gpu.memory_used_mb / 1024).toFixed(1)} GB`)}
          {res && bar("CPU", res.cpu_percent, `${res.cpu_percent.toFixed(0)}%`)}
          {res && bar("Memory", (100 * res.ram_used_mb) / Math.max(1, res.ram_total_mb), `${(res.ram_used_mb / 1024).toFixed(0)} GB`)}
          {!res && <p className="text-sm text-text-2">Reading the machine…</p>}
        </div>
      </Widget>

      <Widget title="Knowledge" tint="#2563eb" href="/knowledge">
        <p className="text-sm">
          <span className="font-mono text-2xl font-semibold tabular-nums">{docs.length}</span> documents in <span className="font-mono">{folders}</span> folders
        </p>
        <p className="mt-0.5 text-xs text-text-2">{valid.data ? (valid.data.ok ? "bundle valid" : `${valid.data.issues?.length ?? 0} issues`) : "checking…"}</p>
      </Widget>
    </div>
  );
}
