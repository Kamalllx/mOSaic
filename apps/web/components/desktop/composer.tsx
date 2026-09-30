"use client";

import type { TaskCreate } from "@mosaic/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, BookOpenText, CornerDownLeft, Cpu, Gauge, Loader2, MemoryStick, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { approvalHeadline } from "@/components/approval-card";
import { useModels, usePendingApprovals, useResources } from "@/components/shell/app-shell";
import { RiskBadge, formatTime } from "@/components/status";
import { TaskRow, byNewest } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { isActive } from "@/lib/events";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";

// The prompt from docs/DEMO_SCRIPT.md ("paste exactly").
const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";

type Priority = NonNullable<TaskCreate["priority"]>;
const PRIORITIES: Priority[] = ["high", "normal", "background"];

function Panel({ title, icon: Icon, action, children, className }: { title: string; icon: typeof Cpu; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface-1 p-4 shadow-panel", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold">
          <Icon className="size-4.5 text-text-2" aria-hidden /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Meter({ label, icon: Icon, value, detail }: { label: string; icon: typeof Cpu; value: number | null; detail: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-text-2">
          <Icon className="size-4" aria-hidden /> {label}
        </span>
        <span className="font-mono">{detail}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width] duration-300", pct > 90 ? "bg-st-failed" : pct > 75 ? "bg-st-waiting" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const client = useClient();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState<Priority>("high");
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => client.listTasks(), refetchInterval: 3_000 });
  const pending = usePendingApprovals();
  const res = useResources().data;
  const models = useModels().data ?? [];
  const knowledge = useQuery({ queryKey: ["knowledge-validate"], queryFn: () => client.validate(), staleTime: 5 * 60_000, refetchOnMount: false });
  const submit = useMutation({
    mutationFn: () => client.createTask({ goal: goal.trim(), priority }),
    onSuccess: (t) => router.push(`/tasks/${t.task_id}`),
    onError: (e) => toast.error("Couldn't submit the task", { description: e instanceof MosaicError ? e.message : String(e) }),
  });
  const canSubmit = goal.trim().length > 0 && !submit.isPending;
  const all = [...(tasks.data ?? [])].sort(byNewest);
  const running = all.filter((t) => isActive(t.status));
  const recent = all.filter((t) => !isActive(t.status)).slice(0, 8);
  const gpu = res?.gpu;
  const chat = models.filter((m) => m.capabilities?.includes("chat") && m.available !== false);
  const approvals = pending.data ?? [];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-xl border border-line bg-surface-1 p-5 shadow-panel">
          <label htmlFor="composer" className="text-2xl font-semibold">
            What should mOSaic work on?
          </label>
          <p className="mt-1 text-sm text-text-2">
            The planner becomes the root process and forks specialists. Reads are scoped by policy; writes to the outside world are syscalls
            that may need your approval.
          </p>
          <textarea
            id="composer"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) submit.mutate();
            }}
            placeholder="Describe the goal, e.g. why is Project Apollo over budget?"
            className="mt-4 min-h-36 w-full resize-y rounded-lg border border-line bg-surface-2 p-3 text-base leading-relaxed placeholder:text-muted-foreground"
            autoFocus
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-md border border-line" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={cn("h-9 px-3 text-sm capitalize text-text-2 transition-colors hover:text-foreground", priority === p && "bg-surface-3 text-foreground")}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setGoal(DEMO_PROMPT)}>
              <Sparkles className="size-4" /> Apollo demo prompt
            </Button>
            <Button className="ml-auto h-10 px-5" disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CornerDownLeft className="size-4" />}
              Run
              <kbd className="ml-1 hidden rounded bg-black/15 px-1 font-mono text-xs sm:inline">Ctrl+Enter</kbd>
            </Button>
          </div>
        </section>

        <Panel title="Tasks" icon={Gauge} action={<Link href="/tasks" className="text-sm text-brand hover:underline">All tasks</Link>}>
          {tasks.isError && <p className="text-sm text-st-failed">Gateway unreachable: {String(tasks.error)}</p>}
          {tasks.isSuccess && all.length === 0 && <p className="text-sm text-text-2">No tasks yet.</p>}
          {running.length > 0 && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Running</p>}
          {running.map((t) => <TaskRow key={t.task_id} t={t} />)}
          {recent.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>}
          {recent.map((t) => <TaskRow key={t.task_id} t={t} />)}
        </Panel>
      </div>

      <div className="min-w-0 space-y-5">
        <Panel
          title="Pending approvals"
          icon={BellRing}
          className={approvals.length ? "border-st-waiting/70" : undefined}
          action={
            <span className={cn("rounded-full px-2 font-mono text-sm font-bold", approvals.length ? "bg-st-waiting text-black" : "bg-surface-3 text-text-2")}>
              {approvals.length} pending
            </span>
          }
        >
          {approvals.length === 0 ? (
            <p className="text-sm text-text-2">Nothing is waiting for you.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.slice(0, 4).map((a) => (
                <li key={a.approval_id}>
                  <Link href={`/tasks/${a.task_id}`} className="block rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:bg-surface-3">
                    <p className="font-medium">{approvalHeadline(a)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-text-2">
                      {a.approval_id} · {formatTime(a.requested_at)} <RiskBadge risk={a.syscall.risk} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="System" icon={Cpu} action={<Link href="/system" className="text-sm text-brand hover:underline">Details</Link>}>
          <div className="space-y-3">
            <Meter
              label={gpu ? `GPU · ${gpu.name}` : "GPU"}
              icon={Gauge}
              value={gpu ? (100 * gpu.memory_used_mb) / Math.max(1, gpu.memory_total_mb) : null}
              detail={gpu ? `${gpu.utilization.toFixed(0)}% · ${(gpu.memory_used_mb / 1024).toFixed(1)}/${(gpu.memory_total_mb / 1024).toFixed(0)} GB` : "not reported"}
            />
            <Meter label="CPU" icon={Cpu} value={res ? res.cpu_percent : null} detail={res ? `${res.cpu_percent.toFixed(0)}%` : "…"} />
            <Meter
              label="RAM"
              icon={MemoryStick}
              value={res ? (100 * res.ram_used_mb) / Math.max(1, res.ram_total_mb) : null}
              detail={res ? `${(res.ram_used_mb / 1024).toFixed(1)}/${(res.ram_total_mb / 1024).toFixed(0)} GB` : "…"}
            />
            <p className="text-sm text-text-2">
              <span className="font-mono text-foreground">{chat.length}</span> local chat models available ·{" "}
              {models.every((m) => m.local !== false) ? (
                <span className="font-semibold text-st-running">all local</span>
              ) : (
                <span className="font-semibold text-st-waiting">remote models enabled</span>
              )}
            </p>
          </div>
        </Panel>

        <Panel title="Knowledge" icon={BookOpenText} action={<Link href="/knowledge" className="text-sm text-brand hover:underline">Explore</Link>}>
          {knowledge.data ? (
            <p className="text-sm">
              <span className="font-mono text-2xl font-semibold">{knowledge.data.files_checked}</span>
              <span className="text-text-2"> documents under /org · </span>
              {knowledge.data.ok ? (
                <span className="text-st-running">bundle valid</span>
              ) : (
                <span className="text-st-waiting">{knowledge.data.issues?.length ?? 0} validation issues</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-text-2">{knowledge.isError ? "Couldn't read the knowledge bundle." : "Checking the bundle…"}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
