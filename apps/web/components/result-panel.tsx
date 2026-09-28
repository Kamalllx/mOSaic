"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Brain, Camera, CircleCheck, CircleX, FileText, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useClient } from "@/app/providers";
import { str, strList, type TaskView } from "@/lib/events";
import { cn } from "@/lib/utils";
import { PidChip } from "./status";
import { EvidencePath } from "./timeline";

export function ResultPanel({ taskId, view }: { taskId: string; view: TaskView }) {
  const client = useClient();
  const done = view.status === "completed" || view.status === "failed" || view.status === "cancelled";
  const artifacts = useQuery({ queryKey: ["artifacts", taskId], queryFn: () => client.taskArtifacts(taskId), enabled: done });
  if (!done) return null;
  const failed = view.status !== "completed";
  const r = view.task?.result;
  const tokens = (r?.usage?.tokens_prompt ?? 0) + (r?.usage?.tokens_completion ?? 0);

  return (
    <div className={cn("rounded-lg border-2 bg-card p-4", failed ? "border-st-failed/60" : "border-st-running/50")}>
      <h2 className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wider", failed ? "text-st-failed" : "text-st-running")}>
        {failed ? <CircleX className="size-4" /> : <CircleCheck className="size-4" />} {failed ? `Task ${view.status}` : "Result"}
      </h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{(failed ? view.failure : view.summary) ?? r?.summary ?? ""}</ReactMarkdown>
      </div>
      {!!artifacts.data?.length && (
        <section className="mt-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Paperclip className="size-3.5" /> Artifacts</h3>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {artifacts.data.map((a) => (
              <li key={a} className="flex items-center gap-2 text-ev-tool">
                {a.endsWith(".png") ? <Camera className="size-3.5" /> : <FileText className="size-3.5" />}
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!r?.evidence?.length && (
        <section className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence ({r.evidence.length})</h3>
          <div className="mt-1 max-h-40 overflow-y-auto">
            {r.evidence.map((p) => <EvidencePath key={p} path={p} flagged={view.flaggedPaths.includes(p)} />)}
          </div>
        </section>
      )}
      {r && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {r.actions?.length ?? 0} committed actions · {tokens} tokens · {r.usage?.tool_calls ?? 0} tool calls
        </p>
      )}
    </div>
  );
}

export function SandboxPanel({ view }: { view: TaskView }) {
  const boxes = Object.values(view.sandboxes);
  if (!boxes.length) return null;
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Box className="size-4 text-ev-tool" /> Sandboxes</h2>
      <ul className="mt-2 space-y-2">
        {boxes.map((b) => (
          <li key={b.sandboxId} className="text-sm">
            <p className="flex items-center gap-2">
              <PidChip pid={b.pid} />
              <span className="font-mono">{b.sandboxId}</span>
              <span className={cn("rounded px-1.5 font-mono text-[11px]", b.destroyed ? "bg-secondary text-muted-foreground" : "bg-st-running/15 text-st-running")}>
                {b.destroyed ? "destroyed" : "running"}
              </span>
            </p>
            {b.image && <p className="pl-11 font-mono text-xs text-muted-foreground">{b.image}</p>}
            {b.screenshots.map((s) => (
              <p key={s} className="flex items-center gap-1.5 pl-11 font-mono text-xs text-ev-tool"><Camera className="size-3.5" /> {s}</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** S2: knowledge changed under the agents' feet. Shown prominently on purpose. */
export function InvalidationBanner({ view }: { view: TaskView }) {
  if (!view.invalidations.length) return null;
  return (
    <div className="rounded-lg border-2 border-st-failed/60 bg-st-failed/10 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-st-failed"><Brain className="size-4" /> Memory invalidated</h2>
      {view.invalidations.map((e) => (
        <div key={e.event_id} className="mt-2 text-sm">
          <EvidencePath path={str(e, "source") ?? ""} />
          <p className="pl-1.5 text-xs text-muted-foreground">
            {strList(e, "invalidated").length} memories marked stale · affected agents: {strList(e, "affected_agents").join(", ") || "none"}
          </p>
        </div>
      ))}
    </div>
  );
}
