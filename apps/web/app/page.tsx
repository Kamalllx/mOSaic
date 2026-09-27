"use client";

import type { TaskCreate } from "@mosaic/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CornerDownLeft, Loader2, Sparkles, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { TaskStatusBadge, formatTime } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";

// The prompt from docs/DEMO_SCRIPT.md ("paste exactly").
const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";

type Priority = NonNullable<TaskCreate["priority"]>;
const PRIORITIES: Priority[] = ["high", "normal", "background"];

export default function ConsolePage() {
  const client = useClient();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState<Priority>("high");

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => client.listTasks(), refetchInterval: 3_000 });
  const submit = useMutation({
    mutationFn: () => client.createTask({ goal: goal.trim(), priority }),
    onSuccess: (t) => router.push(`/tasks/${t.task_id}`),
    onError: (e) => toast.error("Couldn't submit the task", { description: e instanceof MosaicError ? e.message : String(e) }),
  });
  const canSubmit = goal.trim().length > 0 && !submit.isPending;

  const recent = [...(tasks.data ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TerminalSquare className="size-5 text-primary" />
            New task
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The planner becomes the root process and forks specialists. Reads are filtered by your scope; writes to the
            outside world are syscalls that policy may send to you for approval.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) submit.mutate();
            }}
            placeholder="Describe the goal, e.g. why is Project Apollo over budget?"
            className="min-h-40 resize-y font-mono text-base leading-relaxed"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-md border" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "px-3 py-1.5 text-sm capitalize text-muted-foreground transition-colors hover:text-foreground",
                    priority === p && "bg-accent text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setGoal(DEMO_PROMPT)}>
              <Sparkles className="size-4" /> Apollo demo prompt
            </Button>
            <Button className="ml-auto" size="lg" disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CornerDownLeft className="size-4" />}
              Run
              <kbd className="ml-1 rounded bg-primary-foreground/15 px-1 font-mono text-[10px]">Ctrl+Enter</kbd>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {tasks.isError && <p className="text-sm text-st-failed">Gateway unreachable: {String(tasks.error)}</p>}
          {tasks.isSuccess && recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks yet. Submit one on the left.</p>
          )}
          {recent.map((t) => (
            <Link
              key={t.task_id}
              href={`/tasks/${t.task_id}`}
              className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border hover:bg-accent/60"
            >
              <TaskStatusBadge status={t.status} className="w-40 justify-center" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.goal}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {t.task_id} · {formatTime(t.created_at)}
                  {t.root_pid ? ` · pid ${t.root_pid}` : ""}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
