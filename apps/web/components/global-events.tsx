"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { str, strList } from "@/lib/events";

const TYPES = ["approval.requested", "approval.resolved", "knowledge.changed", "knowledge.reindexed", "memory.invalidated"];

/** The console's one app-level subscription. These events matter on every page: the approvals badge, the explorer, and
 *  the memory-invalidation moment of the demo (knowledge/memory events carry no task_id, so no task timeline gets them). */
export function GlobalEvents() {
  const client = useClient();
  const qc = useQueryClient();
  useEffect(
    () =>
      client.events(
        (e) => {
          if (e.type.startsWith("approval.")) qc.invalidateQueries({ queryKey: ["approvals"] });
          if (e.type === "knowledge.changed" || e.type === "knowledge.reindexed") {
            for (const key of ["knowledge-object", "knowledge-tree", "knowledge-search", "knowledge-graph"]) {
              qc.invalidateQueries({ queryKey: [key] });
            }
            if (e.type === "knowledge.changed") toast.info(`Knowledge ${str(e, "change")}: ${str(e, "path")}`);
          }
          if (e.type === "memory.invalidated") {
            qc.invalidateQueries({ queryKey: ["memory"] });
            toast.warning(invalidationTitle(e.payload), {
              description: `Affected: ${strList(e, "affected_agents").join(", ") || "no agents"}`,
              duration: 20_000,
            });
          }
        },
        { types: TYPES },
      ),
    [client, qc],
  );
  return null;
}

export function invalidationTitle(p: Record<string, unknown> | null | undefined) {
  const n = Array.isArray(p?.invalidated) ? p.invalidated.length : 0;
  return `Source changed: ${typeof p?.source === "string" ? p.source : "a document"} · ${n} ${n === 1 ? "memory" : "memories"} invalidated`;
}
