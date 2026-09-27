"use client";

import { useMutation } from "@tanstack/react-query";
import { BookOpenText, ScrollText, Square } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { ProcessTree } from "@/components/process-tree";
import { TaskStatusBadge } from "@/components/status";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { isActive } from "@/lib/events";
import type { StreamStatus } from "@/lib/mosaic-client";
import { useTaskEvents } from "@/lib/use-task-events";
import { cn } from "@/lib/utils";

const STREAM_LABEL: Record<StreamStatus, [string, string]> = {
  connecting: ["connecting", "bg-st-idle"],
  open: ["live", "bg-st-running"],
  reconnecting: ["reconnecting", "bg-st-waiting animate-pulse"],
  closed: ["offline", "bg-st-failed"],
};

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = useClient();
  const view = useTaskEvents(id);
  const cancel = useMutation({
    mutationFn: () => client.cancelTask(id),
    onSuccess: () => toast("Task cancelled"),
    onError: (e) => toast.error("Couldn't cancel", { description: String(e) }),
  });
  const [streamLabel, streamDot] = STREAM_LABEL[view.stream];
  const goal = view.task?.goal ?? view.timeline.find((e) => e.type === "task.created")?.payload?.goal;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <TaskStatusBadge status={view.status} className="text-sm" />
            <span className="font-mono text-sm text-muted-foreground">{id}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Event stream">
              <span className={cn("size-2 rounded-full", streamDot)} /> {streamLabel}
            </span>
          </div>
          <h1 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug">{String(goal ?? "…")}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/audit/${id}`}>
              <ScrollText className="size-4" /> Audit journal
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge">
              <BookOpenText className="size-4" /> Knowledge
            </Link>
          </Button>
          {isActive(view.status) && (
            <Button variant="destructive" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              <Square className="size-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,1fr)_minmax(0,1.9fr)_minmax(320px,0.9fr)] gap-4">
        <section className="min-h-0 rounded-lg border bg-card/50 p-3">
          <Timeline events={view.timeline} retrieved={view.retrieved} />
        </section>
        <section className="flex min-h-0 flex-col rounded-lg border bg-card/50 p-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Processes <span className="font-mono normal-case">({Object.keys(view.processes).length})</span>
          </h2>
          <div className="min-h-0 flex-1">
            <ProcessTree processes={view.processes} />
          </div>
        </section>
        <section className="min-h-0 space-y-4 overflow-y-auto">
          <KnowledgePanel view={view} />
        </section>
      </div>
    </div>
  );
}
