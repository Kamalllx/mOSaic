"use client";

import type { AuditEntry, AuditKind, TimelineStats } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  Brain,
  CircleCheck,
  Cpu,
  Flag,
  Gavel,
  GitFork,
  KeyRound,
  Link2,
  Link2Off,
  type LucideIcon,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { useClient } from "@/app/providers";
import { PidChip, formatTime } from "@/components/status";
import { cn } from "@/lib/utils";

const KIND: Record<AuditKind, { icon: LucideIcon; color: string; label: string }> = {
  task: { icon: Flag, color: "text-foreground border-foreground/40", label: "task" },
  spawn: { icon: GitFork, color: "text-muted-foreground border-muted-foreground/40", label: "spawn" },
  state: { icon: Cpu, color: "text-muted-foreground border-muted-foreground/40", label: "state" },
  model: { icon: Sparkles, color: "text-muted-foreground border-muted-foreground/40", label: "model" },
  knowledge: { icon: BookOpenText, color: "text-ev-knowledge border-ev-knowledge/50", label: "knowledge" },
  memory: { icon: Brain, color: "text-ev-memory border-ev-memory/50", label: "memory" },
  ipc: { icon: Send, color: "text-foreground/80 border-foreground/30", label: "ipc" },
  syscall: { icon: KeyRound, color: "text-ev-syscall border-ev-syscall/50", label: "syscall" },
  policy: { icon: ShieldCheck, color: "text-ev-policy border-ev-policy/50", label: "policy" },
  approval: { icon: Gavel, color: "text-ev-approval border-ev-approval/60", label: "approval" },
  tool: { icon: Wrench, color: "text-ev-tool border-ev-tool/50", label: "tool" },
  verify: { icon: CircleCheck, color: "text-st-running border-st-running/50", label: "verify" },
  commit: { icon: CircleCheck, color: "text-st-running border-st-running/60", label: "commit" },
  rollback: { icon: Undo2, color: "text-st-failed border-st-failed/60", label: "rollback" },
};

function statsLine(s?: TimelineStats) {
  if (!s) return [];
  const n = (v: number | undefined, one: string, many = `${one}s`) => `${v ?? 0} ${(v ?? 0) === 1 ? one : many}`;
  return [
    n(s.agents, "agent"),
    n(s.knowledge_objects, "knowledge object"),
    n(s.ipc_messages, "IPC message"),
    n(s.tool_calls, "tool call"),
    n(s.privileged_syscalls, "privileged syscall"),
    n(s.approvals, "approval"),
    ...(s.rollbacks ? [n(s.rollbacks, "rollback")] : []),
  ];
}

/** Checks that each entry's prev_hash is the previous entry's hash. It can't recompute the hashes (the kernel
 *  does that), so it only shows whether the links the gateway returned are unbroken. */
function chainStatus(entries: AuditEntry[]): "none" | "intact" | "broken" {
  if (!entries.some((e) => e.hash)) return "none";
  for (let i = 1; i < entries.length; i++) if (entries[i].prev_hash !== entries[i - 1].hash) return "broken";
  return "intact";
}

export default function AuditPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const client = useClient();
  const [hidden, setHidden] = useState<AuditKind[]>(["state", "model"]);
  const q = useQuery({ queryKey: ["audit", taskId], queryFn: () => client.audit(taskId), refetchInterval: 5_000 });
  const entries = [...(q.data?.entries ?? [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const counts = entries.reduce<Record<string, number>>((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {});
  const chain = chainStatus(entries);
  const shown = entries.filter((e) => !hidden.includes(e.kind));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href={`/tasks/${taskId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> back to task {taskId}
      </Link>
      <header className="rounded-xl border bg-card p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Audit journal · {taskId}</p>
        <h1 className="mt-1 text-lg font-semibold">{q.data?.goal ?? "…"}</h1>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-base text-primary">
          {statsLine(q.data?.stats).map((s, i) => (
            <span key={s}>
              {i > 0 && <span className="mr-3 text-muted-foreground">·</span>}
              {s}
            </span>
          ))}
        </p>
        {q.data?.stats?.models?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">models: {q.data.stats.models.join(", ")}</p>
        ) : null}
        {chain !== "none" && (
          <p className={cn("mt-3 flex items-center gap-2 text-sm", chain === "intact" ? "text-st-running" : "text-st-failed")}>
            {chain === "intact" ? <Link2 className="size-4" /> : <Link2Off className="size-4" />}
            {chain === "intact"
              ? `sha256 hash chain: all ${entries.length} entries link to their predecessor`
              : "hash chain broken: an entry's prev_hash doesn't match the previous entry"}
          </p>
        )}
        {q.isError && <p className="mt-2 text-sm text-st-failed">{String(q.error)}</p>}
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND) as AuditKind[])
          .filter((k) => counts[k])
          .map((k) => {
            const on = !hidden.includes(k);
            const Icon = KIND[k].icon;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setHidden((h) => (on ? [...h, k] : h.filter((x) => x !== k)))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  on ? KIND[k].color : "border-border text-muted-foreground/60 line-through",
                )}
              >
                <Icon className="size-3.5" /> {KIND[k].label} <span className="font-mono">{counts[k]}</span>
              </button>
            );
          })}
      </div>

      <ol className="relative ml-4 border-l border-border">
        {shown.map((e) => {
          const k = KIND[e.kind] ?? KIND.task;
          const Icon = k.icon;
          const privileged = ["syscall", "policy", "approval", "commit", "rollback"].includes(e.kind);
          return (
            <li key={e.entry_id} className="mb-2 ml-6">
              <span className={cn("absolute -left-3.5 flex size-7 items-center justify-center rounded-full border-2 bg-background", k.color)}>
                <Icon className="size-3.5" />
              </span>
              <div className={cn("rounded-lg border px-3 py-2", privileged ? "bg-card" : "border-transparent")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{e.seq}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatTime(e.ts)}</span>
                  <PidChip pid={e.pid} />
                  <span className={cn("font-mono text-xs uppercase", k.color.split(" ")[0])}>{e.kind}</span>
                  <span className="font-mono text-xs text-muted-foreground">{e.actor}</span>
                </div>
                <p className={cn("mt-0.5 text-sm", privileged && "font-medium")}>{e.summary}</p>
                {!!e.refs?.length && (
                  <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs">
                    {e.refs.map((r) =>
                      r.startsWith("/org") ? (
                        <Link key={r} href={`/knowledge?path=${encodeURIComponent(r)}`} className="text-ev-knowledge hover:underline">
                          {r}
                        </Link>
                      ) : (
                        <span key={r} className="text-muted-foreground">{r}</span>
                      ),
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
