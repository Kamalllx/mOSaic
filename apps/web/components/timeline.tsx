"use client";

import type { Event } from "@mosaic/contracts";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EMPHASISED, FAMILY_TEXT, describeEvent } from "@/lib/describe";
import { type Retrieval, strList } from "@/lib/events";
import { cn } from "@/lib/utils";
import { EvidenceChip, PidChip, UntrustedBadge, formatTime } from "./status";

// Chatty events that add little on a projector; one click shows them.
const NOISE = new Set(["process.usage", "audit.appended", "tool.started", "syscall.completed", "system.health"]);
// Every real process walks CREATED → INITIALIZING → READY → RUNNING in its first milliseconds (P1's demo hides these too).
const BOOT = new Set(["INITIALIZING", "READY"]);
const isNoise = (e: Event) =>
  NOISE.has(e.type) ||
  (e.type === "process.state_changed" &&
    (BOOT.has(String(e.payload?.new)) || (e.payload?.old === "READY" && e.payload?.new === "RUNNING")));

/** Kept for existing imports; the chips live in ./status. */
export const FlagBadge = UntrustedBadge;
export const EvidencePath = EvidenceChip;

function Row({ e, retrieval }: { e: Event; retrieval?: Retrieval }) {
  const [openState, setOpen] = useState<boolean | null>(null);
  const line = describeEvent(e);
  const Icon = line.icon;
  const emphasised = EMPHASISED.includes(line.family);
  const expandable = e.type === "knowledge.retrieved";
  const paths = expandable ? strList(e, "paths") : [];
  const flagged = retrieval?.flagged ?? [];
  const extraFlagged = flagged.filter((p) => !paths.includes(p));
  const open = openState ?? flagged.length > 0; // a flagged retrieval opens by itself: the demo's firewall moment

  return (
    <li
      className={cn(
        "rounded-md border-l-2 border-transparent px-2 py-1.5",
        emphasised && "bg-card",
        line.family === "approval" && "border-ev-approval",
        line.family === "policy" && "border-ev-policy",
        line.family === "syscall" && "border-ev-syscall",
        (line.family === "danger" || line.family === "warning") && "border-st-failed/70 bg-st-failed/5",
        line.family === "warning" && "border-st-waiting bg-st-waiting/5",
        line.family === "transaction" && "border-st-running",
      )}
    >
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-2 text-left disabled:cursor-default"
      >
        <span className="mt-0.5 w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{formatTime(e.ts)}</span>
        <PidChip pid={e.pid} className="mt-0.5 shrink-0" />
        <Icon className={cn("mt-0.5 size-4 shrink-0", FAMILY_TEXT[line.family])} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm leading-snug", emphasised ? "font-medium" : "", FAMILY_TEXT[line.family])}>
            {line.title}
            {flagged.length > 0 && <span className="ml-2 align-middle"><FlagBadge /></span>}
          </span>
          {line.detail && <span className="block truncate text-xs text-muted-foreground">{line.detail}</span>}
        </span>
        {expandable && (
          <ChevronRight className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        )}
      </button>
      {expandable && open && (
        <div className="ml-[7.5rem] mt-1 space-y-0.5">
          {paths.map((p) => (
            <EvidencePath key={p} path={p} flagged={flagged.includes(p)} />
          ))}
          {extraFlagged.map((p) => (
            <EvidencePath key={p} path={p} flagged />
          ))}
        </div>
      )}
    </li>
  );
}

export function Timeline({ events, retrieved }: { events: Event[]; retrieved: Retrieval[] }) {
  const [showNoise, setShowNoise] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const byEvent = new Map(retrieved.map((r) => [r.event, r]));
  const shown = showNoise ? events : events.filter((e) => !isNoise(e));

  useEffect(() => {
    if (pinned.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [shown.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h2>
        <button
          type="button"
          onClick={() => setShowNoise((s) => !s)}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showNoise ? "hide" : "show"} low-level ({events.length - events.filter((e) => !isNoise(e)).length})
        </button>
      </div>
      <div
        ref={scroller}
        onScroll={(ev) => {
          const el = ev.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {shown.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Waiting for events…</p>
        ) : (
          <ol className="space-y-0.5">
            {shown.map((e, i) => (
              <Row key={e.event_id ?? i} e={e} retrieval={byEvent.get(e)} />
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
