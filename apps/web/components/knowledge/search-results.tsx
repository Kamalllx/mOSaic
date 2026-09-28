"use client";

import { useQuery } from "@tanstack/react-query";
import { EyeOff } from "lucide-react";
import { useClient } from "@/app/providers";
import { FlagBadge } from "@/components/timeline";
import { cn } from "@/lib/utils";
import { TrustChip } from "./chips";

const MODES: [string, string][] = [
  ["lexical", "bg-ev-tool"],
  ["semantic", "bg-ev-policy"],
  ["graph", "bg-ev-memory"],
];

export function SearchResults({ text, onSelect }: { text: string; onSelect: (p: string) => void }) {
  const client = useClient();
  const q = useQuery({ queryKey: ["knowledge-search", text], queryFn: () => client.search(text, 10) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (q.isError) return <p className="text-sm text-st-failed">{String(q.error)}</p>;
  const ev = q.data!;
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        <span>{ev.hits.length} hits</span>
        <span>· {ev.total_candidates ?? 0} candidates</span>
        {!!ev.filtered_by_policy && (
          <span className="flex items-center gap-1 text-st-waiting">
            · <EyeOff className="size-3.5" /> {ev.filtered_by_policy} hidden by policy
          </span>
        )}
        {ev.took_ms !== undefined && <span>· {Math.round(ev.took_ms)} ms</span>}
      </p>
      {ev.hits.map((h, i) => {
        const flagged = !!h.firewall_flags?.length;
        return (
          <button
            key={h.path}
            type="button"
            onClick={() => onSelect(h.path)}
            className={cn(
              "block w-full rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50",
              flagged && "border-st-failed/60",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
              <span className="font-semibold">{h.title}</span>
              {flagged && <FlagBadge />}
              <span className="ml-auto font-mono text-xs text-muted-foreground">score {h.score.toFixed(4)}</span>
            </div>
            <p className="font-mono text-xs text-ev-knowledge">{h.path} <span className="text-muted-foreground">· {h.type}</span></p>
            <p className="mt-1.5 line-clamp-2 text-sm text-foreground/85">{h.snippet}</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="space-y-1">
                {MODES.map(([mode, color]) => {
                  const v = h.scores?.[mode];
                  return (
                    <div key={mode} className="flex items-center gap-2 text-xs">
                      <span className="w-16 font-mono text-muted-foreground">{mode}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-secondary">
                        <div className={cn("h-full rounded", color)} style={{ width: `${Math.round((v ?? 0) * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right font-mono text-muted-foreground">{v === undefined ? "–" : v.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <TrustChip value={h.provenance.trust} />
                <span className="font-mono">
                  {h.provenance.source}
                  {h.provenance.source_version ? ` @ ${h.provenance.source_version}` : ""}
                </span>
                {h.provenance.updated_at && <span className="font-mono">{h.provenance.updated_at.slice(0, 10)}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
