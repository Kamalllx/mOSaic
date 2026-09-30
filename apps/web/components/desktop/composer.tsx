"use client";

import type { TaskCreate } from "@mosaic/contracts";
import { useMutation } from "@tanstack/react-query";
import { CornerDownLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { TaskStatusBadge, formatTime } from "@/components/status";
import { byNewest } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { isActive } from "@/lib/events";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";
import { useTasks } from "./hooks";
import { Orb } from "./orb";

// The prompt from docs/DEMO_SCRIPT.md ("paste exactly").
const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";

type Priority = NonNullable<TaskCreate["priority"]>;
const PRIORITIES: Priority[] = ["high", "normal", "background"];

/** The desktop's centrepiece: say what mOSaic should work on. Running and recent tasks sit underneath. */
export function Composer({ className }: { className?: string }) {
  const client = useClient();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState<Priority>("high");
  const tasks = useTasks();
  const submit = useMutation({
    mutationFn: () => client.createTask({ goal: goal.trim(), priority }),
    onSuccess: (t) => {
      setGoal("");
      router.push(`/tasks/${t.task_id}`);
    },
    onError: (e) => toast.error("Couldn't start the task", { description: e instanceof MosaicError ? e.message : String(e) }),
  });
  const canSubmit = goal.trim().length > 0 && !submit.isPending;
  const all = [...(tasks.data ?? [])].sort(byNewest);
  const shown = [...all.filter((t) => isActive(t.status)), ...all.filter((t) => !isActive(t.status))].slice(0, 3);

  return (
    <div className={cn("w-full max-w-[680px] space-y-3", className)}>
      <section className="rounded-[14px] border border-line-strong bg-surface-1/95 p-5 shadow-window">
        <label htmlFor="composer" className="text-[22px] font-semibold tracking-tight">
          What should mOSaic work on?
        </label>
        <p className="mt-1 text-sm text-text-2">
          The planner starts as the root process and forks specialists. Anything that writes to the outside world waits for you.
        </p>
        <textarea
          id="composer"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) submit.mutate();
          }}
          placeholder="Why is Project Apollo over budget?"
          className="mt-4 min-h-28 w-full resize-y rounded-lg border border-line bg-surface-2 p-3 text-base leading-relaxed placeholder:text-muted-foreground"
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
            {submit.isPending ? <Orb state="shaping" label="Starting the task" /> : <CornerDownLeft className="size-4" />}
            Run
            <kbd className="ml-1 hidden rounded bg-black/15 px-1 font-mono text-xs sm:inline">Ctrl+Enter</kbd>
          </Button>
        </div>
      </section>

      {shown.length > 0 && (
        <ul className="overflow-hidden rounded-[12px] border border-line bg-surface-1/90 shadow-window-idle">
          {shown.map((t) => (
            <li key={t.task_id} className="border-b border-line last:border-0">
              <Link href={`/tasks/${t.task_id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-3">
                {isActive(t.status) ? <Orb state="working" label="running" /> : <span className="size-5" aria-hidden />}
                <span className="min-w-0 flex-1 truncate text-sm">{t.goal}</span>
                <TaskStatusBadge status={t.status} />
                <span className="hidden font-mono text-xs text-text-2 sm:inline">{formatTime(t.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
