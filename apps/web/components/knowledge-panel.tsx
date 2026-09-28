"use client";

import { BookOpenText, EyeOff, ShieldAlert } from "lucide-react";
import { num, str, strList, type TaskView } from "@/lib/events";
import { EvidencePath } from "./timeline";
import { PidChip } from "./status";

/** Demo steps 4–5: what each agent retrieved, what policy hid, and what the context firewall flagged. */
export function KnowledgePanel({ view }: { view: TaskView }) {
  const hidden = view.retrieved.reduce((n, r) => n + (num(r.event, "filtered_by_policy") ?? 0), 0);
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-3 shadow-panel">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpenText className="size-4 text-ev-knowledge" /> Knowledge
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Objects removed by scope or privacy">
          <EyeOff className="size-3.5" /> {hidden} hidden by policy
        </span>
      </div>

      {view.flaggedPaths.length > 0 && (
        <div className="mt-3 rounded-lg border border-untrusted/50 bg-untrusted-bg p-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-untrusted">
            <ShieldAlert className="size-4" /> Context firewall
          </p>
          <p className="mt-0.5 text-xs text-text-2">
            Instruction-like text found in retrieved evidence. It is passed to agents as data, never as instructions.
          </p>
          <div className="mt-1.5">
            {view.flaggedPaths.map((p) => (
              <EvidencePath key={p} path={p} flagged />
            ))}
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-2.5">
        {view.retrieved.length === 0 && <li className="text-sm text-muted-foreground">No retrievals yet.</li>}
        {view.retrieved.map((r) => (
          <li key={r.event.event_id ?? r.event.ts} className="space-y-0.5">
            <p className="flex items-center gap-2 text-sm">
              <PidChip pid={r.event.pid} />
              <span className="truncate text-foreground/90" title={str(r.event, "query")}>
                “{str(r.event, "query")}”
              </span>
            </p>
            <p className="pl-11 text-xs text-text-2">
              {num(r.event, "hits") ?? 0} hits · {num(r.event, "filtered_by_policy") ?? 0} hidden by policy
            </p>
            <div className="pl-9">
              {strList(r.event, "paths").map((p) => (
                <EvidencePath key={p} path={p} flagged={r.flagged.includes(p)} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
