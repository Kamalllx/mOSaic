"use client";

import type { Approval, Risk } from "@mosaic/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileSearch, Gavel, KeyRound, Loader2, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";
import { PidChip, formatTime } from "./status";
import { EvidencePath } from "./timeline";

const RISK: Record<Risk, string> = {
  low: "bg-st-running/15 text-st-running border-st-running/50",
  medium: "bg-st-waiting/15 text-st-waiting border-st-waiting/50",
  high: "bg-st-failed/15 text-st-failed border-st-failed/50",
  critical: "bg-st-failed/30 text-st-failed border-st-failed",
};

/** Renders JSON with light syntax colouring (keys, strings, numbers) without a dependency. */
function JsonView({ value }: { value: unknown }) {
  const json = JSON.stringify(value ?? {}, null, 2);
  const parts = json.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background/80 p-3 font-mono text-[13px] leading-relaxed">
      {parts.map((p, i) => {
        if (/^".*":$/.test(p.replace(/\s/g, ""))) return <span key={i} className="text-ev-tool">{p}</span>;
        if (p.startsWith('"')) return <span key={i} className="text-st-running">{p}</span>;
        if (/^(-?\d|true|false|null)/.test(p)) return <span key={i} className="text-ev-policy">{p}</span>;
        return <span key={i}>{p}</span>;
      })}
    </pre>
  );
}

export function ApprovalCard({ approval, flaggedPaths = [], compact }: { approval: Approval; flaggedPaths?: string[]; compact?: boolean }) {
  const client = useClient();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const sc = approval.syscall;
  const pending = (approval.status ?? "pending") === "pending";

  const resolve = useMutation({
    mutationFn: (approve: boolean) =>
      approve ? client.approve(approval.approval_id, comment || undefined) : client.reject(approval.approval_id, comment || undefined),
    onSuccess: (a) => {
      if (a.status === "approved") toast.success(`Approved ${a.approval_id}`, { description: `${sc.capability} runs now; the task continues.` });
      else toast(`Rejected ${a.approval_id}`, { description: "The syscall is refused; the agent is told why." });
    },
    onError: (e) => {
      if (e instanceof MosaicError && e.code === "APPROVAL_ALREADY_RESOLVED") {
        toast.info("Already resolved", { description: "Someone else (or the phone app) resolved this approval first." });
      } else {
        toast.error("Couldn't resolve the approval", { description: e instanceof MosaicError ? e.message : String(e) });
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["approvals"] }),
  });

  return (
    <article
      className={cn(
        "rounded-xl border-2 bg-card p-5",
        pending ? "border-st-waiting/70 shadow-[0_0_40px_-12px] shadow-st-waiting/40" : "border-border opacity-80",
      )}
    >
      <header className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-widest",
            pending ? "bg-st-waiting text-black" : approval.status === "approved" ? "bg-st-running/20 text-st-running" : "bg-st-failed/20 text-st-failed",
          )}
        >
          <Gavel className="size-3.5" />
          {pending ? "Approval required" : approval.status}
        </span>
        <span className="font-mono text-sm text-muted-foreground">{approval.approval_id}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {approval.requested_at && `requested ${formatTime(approval.requested_at)}`}
          {approval.resolved_by && ` · ${approval.status} by ${approval.resolved_by}`}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PidChip pid={approval.pid} className="text-sm" />
        <span className="text-base font-medium">{approval.agent}</span>
        <span className="text-muted-foreground">wants</span>
        <span className="flex items-center gap-1.5 rounded-md border border-ev-syscall/60 bg-ev-syscall/10 px-2.5 py-1 font-mono text-base font-semibold text-ev-syscall">
          <KeyRound className="size-4" />
          {sc.capability}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {sc.tool}.{sc.operation}
          {sc.resource ? ` on ${sc.resource}` : ""}
        </span>
        {sc.risk && (
          <span className={cn("rounded-md border px-2 py-0.5 font-mono text-xs font-bold uppercase", RISK[sc.risk])}>
            risk {sc.risk}
          </span>
        )}
      </div>

      <div className={cn("mt-4 grid gap-4", !compact && "xl:grid-cols-2")}>
        <div className="space-y-3">
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldAlert className="size-3.5 text-ev-policy" /> Policy
            </h4>
            <p className="mt-1 text-sm">
              <span className="font-mono font-semibold text-ev-policy">{approval.decision.policy}</span>
              <span className="text-muted-foreground"> · {approval.decision.reason}</span>
            </p>
            {!!approval.decision.matched_rules?.length && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">rules: {approval.decision.matched_rules.join(", ")}</p>
            )}
          </section>
          {sc.justification && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Justification</h4>
              <blockquote className="mt-1 border-l-2 border-primary/60 pl-3 text-sm italic">{sc.justification}</blockquote>
            </section>
          )}
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileSearch className="size-3.5 text-ev-knowledge" /> Evidence ({sc.evidence?.length ?? 0})
            </h4>
            <div className="mt-1">
              {sc.evidence?.length ? (
                sc.evidence.map((p) => <EvidencePath key={p} path={p} flagged={flaggedPaths.includes(p)} />)
              ) : (
                <p className="text-sm text-st-waiting">No evidence cited for this action.</p>
              )}
            </div>
          </section>
        </div>
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arguments</h4>
          <div className="mt-1">
            <JsonView value={sc.arguments} />
          </div>
        </section>
      </div>

      {pending ? (
        <footer className="mt-5 space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional, recorded in the audit journal)"
            className="min-h-16"
          />
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 bg-st-running text-black hover:bg-st-running/90"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate(true)}
            >
              {resolve.isPending && resolve.variables ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Approve
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 border-st-failed/60 text-st-failed hover:bg-st-failed/10 hover:text-st-failed"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate(false)}
            >
              {resolve.isPending && resolve.variables === false ? <Loader2 className="size-5 animate-spin" /> : <X className="size-5" />}
              Reject
            </Button>
          </div>
        </footer>
      ) : (
        approval.comment && <p className="mt-4 text-sm text-muted-foreground">Comment: “{approval.comment}”</p>
      )}
    </article>
  );
}
