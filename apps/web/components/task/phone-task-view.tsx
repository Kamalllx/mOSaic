"use client";

import { describeEvent, FAMILY_TEXT } from "@/lib/describe";
import type { TaskView } from "@/lib/events";
import { agentTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { isNoise } from "../timeline";
import { offset } from "../status";

/** Under 768 px: the task at a glance (processes with state dots, the latest five events). */
export function PhoneTaskView({ view, start }: { view: TaskView; start?: string | null }) {
  const procs = Object.values(view.processes).sort((a, b) => a.pid - b.pid);
  const latest = view.timeline.filter((e) => !isNoise(e)).slice(-5).reverse();
  return (
    <div className="space-y-4 md:hidden">
      <section className="rounded-xl border border-line bg-surface-1 p-3">
        <h2 className="mb-2 text-base font-semibold">Processes</h2>
        <ul className="divide-y divide-line">
          {procs.map((p) => (
            <li key={p.pid} className="flex items-center gap-3 py-2 text-sm">
              <span className={cn("size-2.5 shrink-0 rounded-full", agentTone(p.state).dot)} aria-hidden />
              <span className="w-12 font-mono">{p.pid}</span>
              <span className="min-w-0 flex-1 truncate">{p.agent}</span>
              <span className={cn("font-mono text-xs", agentTone(p.state).text === "text-st-terminated-fg" ? "text-text-2" : agentTone(p.state).text)}>{p.state}</span>
            </li>
          ))}
          {!procs.length && <li className="py-2 text-sm text-muted-foreground">No processes yet.</li>}
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-surface-1 p-3">
        <h2 className="mb-2 text-base font-semibold">Latest events</h2>
        <ol className="space-y-2">
          {latest.map((e, i) => {
            const line = describeEvent(e);
            const Icon = line.icon;
            return (
              <li key={e.event_id ?? i} className="flex items-start gap-2 text-sm">
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{offset(e.ts, start)}</span>
                <Icon className={cn("mt-0.5 size-4 shrink-0", FAMILY_TEXT[line.family])} aria-hidden />
                <span className="min-w-0 flex-1">{line.title}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
