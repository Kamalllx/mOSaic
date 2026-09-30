"use client";

import type { Event, MemoryKind, MemoryRecord } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useClient } from "@/app/providers";
import { INVALIDATIONS_KEY, invalidationTitle } from "@/components/global-events";
import { EvidenceChip, formatTime } from "@/components/status";
import { strList } from "@/lib/events";
import { cn } from "@/lib/utils";

const KINDS: (MemoryKind | "all")[] = ["all", "episodic", "semantic", "working"];

function MemoryRow({ m, changed }: { m: MemoryRecord; changed: string[] }) {
  const importance = Math.max(0, Math.min(1, m.importance ?? 0));
  const replaces = m.tags?.find((t) => t.startsWith("replaces:"))?.slice("replaces:".length);
  const isReconsolidated = m.tags?.includes("reconsolidated");
  return (
    <li
      className={cn(
        "grid gap-3 px-4 py-3 transition-opacity duration-200 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
        m.stale && "bg-st-waiting/5",
        isReconsolidated && !m.stale && "bg-brand-subtle/20",
      )}
      data-stale={m.stale ? "true" : undefined}
    >
      <div className={cn("min-w-0 space-y-1.5", m.stale && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-text-2">{m.memory_id}</span>
          <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-xs">{m.kind}</span>
          <span className="font-mono text-xs font-semibold text-foreground">{m.owner}</span>
          {m.stale && (
            <span className="inline-flex items-center gap-1 rounded-md border border-st-waiting/60 bg-st-waiting/12 px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-st-waiting">
              <TriangleAlert className="size-3.5" aria-hidden /> source changed
            </span>
          )}
          {replaces && !m.stale && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-brand/60 bg-brand-subtle px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-brand"
              title={`Re-derived from the current sources; replaces ${replaces}`}
            >
              <RefreshCw className="size-3.5" aria-hidden /> re-derived
            </span>
          )}
        </div>
        {replaces && (
          <p className="font-mono text-xs text-text-2">
            replaces <span className="text-brand">{replaces}</span>
          </p>
        )}
        <p className={cn("line-clamp-3 text-sm leading-relaxed", m.stale && "line-through decoration-st-waiting/50")}>
          {m.summary || m.content}
        </p>
        <div className="flex items-center gap-3 text-xs text-text-2">
          <span className="flex items-center gap-1.5">
            importance
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${importance * 100}%` }} />
            </span>
            <span className="font-mono">{importance.toFixed(2)}</span>
          </span>
          {m.task_id && <span className="font-mono">{m.task_id}</span>}
          {m.created_at && <span className="font-mono">{formatTime(m.created_at)}</span>}
        </div>
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Derived from</p>
        <div className="flex flex-wrap gap-1.5">
          {(m.derived_from ?? []).map((p) =>
            p.startsWith("/org") ? (
              <EvidenceChip key={p} path={p} className={cn(changed.includes(p) && "border-st-waiting text-st-waiting")} />
            ) : (
              <span key={p} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-text-2">{p}</span>
            ),
          )}
          {!m.derived_from?.length && <span className="text-sm text-muted-foreground">—</span>}
        </div>
      </div>
    </li>
  );
}

/** Group stale memories with their re-derived replacements so the transition is obvious. */
function groupMemories(memories: MemoryRecord[]): Array<{ stale?: MemoryRecord; fresh?: MemoryRecord }> {
  const groups: Array<{ stale?: MemoryRecord; fresh?: MemoryRecord }> = [];
  const replacedIds = new Set<string>();

  // Collect all re-derived records and which IDs they replace.
  const byReplaces = new Map<string, MemoryRecord>();
  for (const m of memories) {
    const replaces = m.tags?.find((t) => t.startsWith("replaces:"))?.slice("replaces:".length);
    if (replaces) {
      byReplaces.set(replaces, m);
      replacedIds.add(replaces);
    }
  }

  // Build groups: stale + fresh side by side; standalone records as single entries.
  const handled = new Set<string>();
  for (const m of memories) {
    if (handled.has(m.memory_id)) continue;
    if (m.stale && byReplaces.has(m.memory_id)) {
      // This stale record has a re-derived replacement — show them together.
      const fresh = byReplaces.get(m.memory_id)!;
      groups.push({ stale: m, fresh });
      handled.add(m.memory_id);
      handled.add(fresh.memory_id);
    } else if (!replacedIds.has(m.memory_id)) {
      // A standalone record (not replaced by anything in the current view).
      groups.push({ fresh: m });
      handled.add(m.memory_id);
    } else {
      // Its replacement pair will be handled when we reach the stale record — skip for now.
      // But if the stale record is not in the current filtered view, show the fresh record alone.
      const alreadyPaired = memories.some((x) => x.stale && byReplaces.get(x.memory_id)?.memory_id === m.memory_id);
      if (!alreadyPaired) {
        groups.push({ fresh: m });
        handled.add(m.memory_id);
      }
    }
  }

  return groups;
}

function ReplacementGroup({ stale, fresh, changed }: { stale?: MemoryRecord; fresh?: MemoryRecord; changed: string[] }) {
  if (!stale) return <MemoryRow m={fresh!} changed={changed} />;
  if (!fresh) return <MemoryRow m={stale} changed={changed} />;
  // Both present: show as a paired group.
  return (
    <li className="rounded-lg border-2 border-brand/30 bg-brand-subtle/10">
      <div className="flex items-center gap-2 border-b border-brand/20 px-4 py-1.5">
        <RefreshCw className="size-3.5 text-brand" aria-hidden />
        <span className="text-xs font-semibold text-brand">Memory re-derived from changed source</span>
      </div>
      <ul className="divide-y divide-brand/10">
        <MemoryRow m={stale} changed={changed} />
        <MemoryRow m={fresh} changed={changed} />
      </ul>
    </li>
  );
}

function MemoryScreen() {
  const client = useClient();
  const params = useSearchParams();
  const [owner, setOwner] = useState(params.get("owner") ?? "");
  const [task, setTask] = useState(params.get("task_id") ?? "");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["memory", owner, task],
    queryFn: () => client.memory({ owner: owner || undefined, taskId: task || undefined }),
    refetchInterval: 5_000,
  });
  const inv = useQuery<Event[]>({ queryKey: INVALIDATIONS_KEY, queryFn: () => [], staleTime: Infinity });
  const latest = inv.data?.[0];
  const changed = [...new Set((inv.data ?? []).map((e) => String(e.payload?.source ?? "")))];

  const all = q.data ?? [];
  const owners = [...new Set(all.map((m) => m.owner))].sort();
  const shown = all
    .filter((m) => kind === "all" || m.kind === kind)
    .filter((m) => !staleOnly || m.stale)
    .filter((m) => !text || `${m.content} ${m.summary ?? ""} ${(m.derived_from ?? []).join(" ")}`.toLowerCase().includes(text.toLowerCase()))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const stale = all.filter((m) => m.stale).length;
  const rederived = all.filter((m) => m.tags?.includes("reconsolidated") && !m.stale).length;

  const groups = groupMemories(shown);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Brain className="size-6 text-brand" aria-hidden /> Memory
          </h1>
          <p className="mt-1 text-sm text-text-2">What agents learned, linked to the documents it came from. When a source changes, its memories go stale and are re-derived from the new text.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-text-2">
          <span>
            {all.length} {all.length === 1 ? "record" : "records"}
          </span>
          {stale > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-st-waiting">
              <TriangleAlert className="size-3.5" aria-hidden />
              {stale} stale
            </span>
          )}
          {rederived > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-brand">
              <RefreshCw className="size-3.5" aria-hidden />
              {rederived} re-derived
            </span>
          )}
        </div>
      </div>

      {latest && (
        <div role="status" className="row-in rounded-xl border-2 border-st-waiting/70 bg-st-waiting/10 p-4">
          <p className="flex items-center gap-2 text-base font-semibold text-st-waiting">
            <TriangleAlert className="size-5" aria-hidden /> {invalidationTitle(latest.payload)}
          </p>
          <p className="mt-1 text-sm">
            Affected: <span className="font-mono font-semibold">{strList(latest, "affected_agents").join(", ") || "no agents"}</span>
            <span className="text-text-2"> · {formatTime(latest.ts)}</span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          aria-label="Owner"
          className="h-9 rounded-md border border-line bg-surface-2 px-2 text-sm"
        >
          <option value="">All agents</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value.trim())}
          placeholder="Task id"
          aria-label="Task id"
          className="h-9 w-40 rounded-md border border-line bg-surface-2 px-2 font-mono text-sm"
        />
        <div role="radiogroup" aria-label="Kind" className="flex overflow-hidden rounded-md border border-line">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn("h-9 px-3 text-sm capitalize text-text-2", kind === k && "bg-surface-3 text-foreground")}
            >
              {k}
            </button>
          ))}
        </div>
        <label className="flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm">
          <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} className="accent-[var(--st-waiting)]" />
          Stale only
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter text…"
          aria-label="Filter memories"
          className="h-9 min-w-40 flex-1 rounded-md border border-line bg-surface-2 px-2 text-sm"
        />
      </div>

      {q.isError && (
        <div className="rounded-xl border border-st-failed/50 bg-st-failed/8 p-4 text-sm text-st-failed">
          Gateway unreachable: {String(q.error)}
        </div>
      )}

      {q.isLoading && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4 px-4 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-surface-3" />
                <div className="h-3 w-full animate-pulse rounded bg-surface-3" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-surface-3" />
              </div>
              <div className="w-40 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-3" />
                <div className="h-5 w-32 animate-pulse rounded bg-surface-3" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {q.isSuccess && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel">
          {shown.length === 0 && (
            <li className="px-4 py-8 text-center">
              <Brain className="mx-auto mb-2 size-8 text-muted-foreground opacity-40" aria-hidden />
              <p className="text-sm font-medium text-text-2">No memories match.</p>
              <p className="mt-1 text-xs text-muted-foreground">Memories appear after a task completes and agents consolidate what they learned.</p>
            </li>
          )}
          {groups.map((g, i) =>
            g.stale && g.fresh ? (
              <ReplacementGroup key={`group-${i}`} stale={g.stale} fresh={g.fresh} changed={changed} />
            ) : (
              <MemoryRow key={g.fresh?.memory_id ?? g.stale?.memory_id ?? i} m={g.fresh ?? g.stale!} changed={changed} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export default function MemoryPage() {
  return (
    <Suspense>
      <MemoryScreen />
    </Suspense>
  );
}
