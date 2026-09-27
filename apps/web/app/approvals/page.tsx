"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import Link from "next/link";
import { useClient } from "@/app/providers";
import { ApprovalCard } from "@/components/approval-card";
import { PidChip, formatTime } from "@/components/status";
import { cn } from "@/lib/utils";

export default function ApprovalsPage() {
  const client = useClient();
  const all = useQuery({ queryKey: ["approvals", "all"], queryFn: () => client.approvals(), refetchInterval: 2_000 });
  const approvals = [...(all.data ?? [])].sort((a, b) => (b.requested_at ?? "").localeCompare(a.requested_at ?? ""));
  const pending = approvals.filter((a) => (a.status ?? "pending") === "pending");
  const resolved = approvals.filter((a) => (a.status ?? "pending") !== "pending");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BellRing className={cn("size-6", pending.length ? "text-st-waiting" : "text-muted-foreground")} /> Approval center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Privileged syscalls that policy routed to a human. Each card shows exactly which documents justify the action.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending ({pending.length})</h2>
        {all.isError && <p className="text-sm text-st-failed">Gateway unreachable: {String(all.error)}</p>}
        {all.isSuccess && pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting for you.</p>}
        {pending.map((a) => (
          <div key={a.approval_id} className="space-y-1">
            <Link href={`/tasks/${a.task_id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground">
              task {a.task_id} →
            </Link>
            <ApprovalCard approval={a} />
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resolved ({resolved.length})</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {resolved.map((a) => (
              <tr key={a.approval_id} className="border-b border-border/60">
                <td className="py-2 font-mono text-xs text-muted-foreground">{formatTime(a.resolved_at ?? a.requested_at)}</td>
                <td className="py-2"><PidChip pid={a.pid} /></td>
                <td className="py-2 font-mono text-ev-syscall">{a.syscall.capability}</td>
                <td className="py-2 text-muted-foreground">{a.agent}</td>
                <td className={cn("py-2 font-semibold", a.status === "approved" ? "text-st-running" : "text-st-failed")}>
                  {a.status}{a.resolved_by ? ` by ${a.resolved_by}` : ""}
                </td>
                <td className="py-2 text-right">
                  <Link href={`/tasks/${a.task_id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground">{a.task_id}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
