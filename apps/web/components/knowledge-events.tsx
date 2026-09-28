"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { str, strList } from "@/lib/events";

/** Knowledge/memory coherence events carry no task_id, so they don't reach any task timeline. This listener makes
 *  them visible everywhere (demo S2: a policy changes → memories derived from it go stale) and refreshes the
 *  explorer when a document changes. */
export function KnowledgeEvents() {
  const client = useClient();
  const qc = useQueryClient();
  useEffect(
    () =>
      client.events(
        (e) => {
          if (e.type === "knowledge.changed" || e.type === "knowledge.reindexed") {
            for (const key of ["knowledge-object", "knowledge-tree", "knowledge-search", "knowledge-graph"]) {
              qc.invalidateQueries({ queryKey: [key] });
            }
            if (e.type === "knowledge.changed") toast.info(`Knowledge ${str(e, "change")}: ${str(e, "path")}`);
          }
          if (e.type === "memory.invalidated") {
            const n = strList(e, "invalidated").length;
            toast.warning(`Memory invalidated: ${n} ${n === 1 ? "memory" : "memories"} stale`, {
              description: `${str(e, "source")} changed. Affected agents: ${strList(e, "affected_agents").join(", ") || "none"}.`,
              duration: 20_000,
            });
          }
        },
        { types: ["knowledge.changed", "knowledge.reindexed", "memory.invalidated"] },
      ),
    [client, qc],
  );
  return null;
}
