"use client";

import type { TaskStatus } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useClient } from "@/app/providers";
import { TaskRow, byNewest } from "@/components/task-row";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "active", "completed", "failed"] as const;
type Filter = (typeof FILTERS)[number];

const matches = (f: Filter, s?: TaskStatus) =>
  f === "all" || (f === "active" ? isActive(s) : f === "failed" ? s === "failed" || s === "cancelled" : s === f);

export default function TasksPage() {
  const client = useClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => client.listTasks(), refetchInterval: 3_000 });
  const all = [...(tasks.data ?? [])].sort(byNewest);
  const shown = all.filter((t) => matches(filter, t.status)).filter((t) => !text || `${t.task_id} ${t.goal}`.toLowerCase().includes(text.toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-text-2">Every goal submitted to the kernel, newest first.</p>
        </div>
        <Link href="/" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-[var(--on-brand)] hover:bg-brand-hover">
          New task
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Status" className="flex overflow-hidden rounded-md border border-line">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn("h-9 px-3 text-sm capitalize text-text-2", filter === f && "bg-surface-3 text-foreground")}
            >
              {f} <span className="font-mono text-xs">({all.filter((t) => matches(f, t.status)).length})</span>
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by id or goal…"
          aria-label="Filter tasks"
          className="h-9 min-w-48 flex-1 rounded-md border border-line bg-surface-2 px-3 text-sm"
        />
      </div>
      <section className="rounded-xl border border-line bg-surface-1 p-2 shadow-panel">
        {tasks.isError && <p className="p-3 text-sm text-st-failed">Gateway unreachable: {String(tasks.error)}</p>}
        {tasks.isSuccess && shown.length === 0 && <p className="p-3 text-sm text-text-2">No tasks match.</p>}
        {shown.map((t) => (
          <TaskRow key={t.task_id} t={t} />
        ))}
      </section>
    </div>
  );
}
