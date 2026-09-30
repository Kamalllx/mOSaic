"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, CheckCircle2, ExternalLink, GitBranch, RefreshCw, Unplug, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { Loading } from "@/components/desktop/orb";
import type { ConnectorId, ConnectorInfo, ConnectorStatus } from "@/lib/mosaic-client";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ConnectorStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold",
        status === "connected" && "bg-st-completed/15 text-st-completed",
        status === "disconnected" && "bg-surface-3 text-text-2",
        status === "error" && "bg-st-failed/15 text-st-failed",
      )}
    >
      {status === "connected" ? <CheckCircle2 className="size-3" aria-hidden /> : status === "error" ? <XCircle className="size-3" aria-hidden /> : null}
      {status}
    </span>
  );
}

const CONNECTOR_ICON: Record<ConnectorId, React.ElementType> = {
  github: GitBranch,
  google_calendar: Cable,
};

const CONNECTOR_SCOPES_HELP: Record<ConnectorId, string[]> = {
  github: ["Read repos, issues, PRs, file contents", "Create issues and comments (requires approval)"],
  google_calendar: ["Read free/busy and events", "Create events with Meet links (requires approval)"],
};

function ConnectorCard({ connector }: { connector: ConnectorInfo }) {
  const client = useClient();
  const qc = useQueryClient();
  const Icon = CONNECTOR_ICON[connector.connector_id] ?? Cable;

  const connect = useMutation({
    mutationFn: () => client.connectOAuth(connector.connector_id),
    onSuccess: (data) => {
      // In production, navigate the user to data.auth_url for OAuth
      toast.info("OAuth flow would open", { description: data.auth_url });
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
    onError: (e) => toast.error("Couldn't start connection", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  const disconnect = useMutation({
    mutationFn: () => client.disconnectConnector(connector.connector_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      toast.success(`${connector.name} disconnected`);
    },
    onError: (e) => toast.error("Couldn't disconnect", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  const sync = useMutation({
    mutationFn: () => client.syncConnector(connector.connector_id),
    onSuccess: () => toast.success("Sync queued"),
    onError: (e) => toast.error("Couldn't sync", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  return (
    <article className="rounded-xl border border-line bg-surface-1 p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-surface-3">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{connector.name}</p>
            <StatusBadge status={connector.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connector.status === "connected" && (
            <>
              <button
                type="button"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                aria-label={`Sync ${connector.name}`}
                className="rounded-md border border-line p-1.5 hover:bg-surface-3 disabled:opacity-50"
              >
                <RefreshCw className={cn("size-4 text-text-2", sync.isPending && "animate-spin")} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                aria-label={`Disconnect ${connector.name}`}
                className="rounded-md border border-line p-1.5 hover:bg-surface-3 disabled:opacity-50"
              >
                <Unplug className="size-4 text-text-2" aria-hidden />
              </button>
            </>
          )}
          {connector.status !== "connected" && (
            <button
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-[var(--on-brand)] hover:bg-brand-hover disabled:opacity-50"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 @md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-2">Capabilities</p>
          <ul className="space-y-1">
            {CONNECTOR_SCOPES_HELP[connector.connector_id].map((s) => (
              <li key={s} className="flex items-start gap-1.5 text-xs text-text-2">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-brand" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
        {connector.status === "connected" && (
          <div className="space-y-1 text-xs text-text-2">
            {connector.last_sync && (
              <p>
                Last sync: <span className="font-mono">{new Date(connector.last_sync).toLocaleString()}</span>
              </p>
            )}
            {connector.connected_by && (
              <p>
                Connected by: <span className="font-mono">{connector.connected_by}</span>
              </p>
            )}
            {connector.scopes && connector.scopes.length > 0 && (
              <div>
                <p className="mb-0.5 font-semibold uppercase tracking-wider">Scopes</p>
                <div className="flex flex-wrap gap-1">
                  {connector.scopes.map((s) => (
                    <span key={s} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {connector.recent_agents && connector.recent_agents.length > 0 && (
              <div>
                <p className="mb-0.5 font-semibold uppercase tracking-wider">Recently used by</p>
                <div className="flex flex-wrap gap-1">
                  {connector.recent_agents.map((a) => (
                    <span key={a} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function ConnectionsApp() {
  const client = useClient();
  const connectors = useQuery({
    queryKey: ["connectors"],
    queryFn: () => client.connectors(),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Cable className="size-6 text-brand" aria-hidden />
          Connections
        </h1>
        <p className="mt-1 text-sm text-text-2">
          Connected services are registered as governed tools. Agents call them through the policy engine, and privileged
          writes require approval.
        </p>
      </div>

      {connectors.isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-st-failed/50 bg-st-failed/8 p-8 text-center">
          <XCircle className="size-8 text-st-failed opacity-70" aria-hidden />
          <p className="text-sm text-st-failed">Gateway unreachable: {String(connectors.error)}</p>
          <button type="button" onClick={() => connectors.refetch()} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-3">
            Retry
          </button>
        </div>
      )}

      {connectors.isLoading && <Loading label="Loading connectors" state="working" />}

      {connectors.isSuccess && connectors.data.length === 0 && (
        <div className="rounded-xl border border-line bg-surface-1 px-6 py-12 text-center shadow-panel">
          <Cable className="mx-auto mb-3 size-10 text-muted-foreground opacity-40" aria-hidden />
          <p className="text-sm font-medium text-text-2">No connected services.</p>
          <p className="mt-1 text-xs text-muted-foreground">Connect GitHub or Google Calendar to let agents read and write through governed actions.</p>
        </div>
      )}

      <div className="space-y-4">
        {(connectors.data ?? []).map((c) => (
          <ConnectorCard key={c.connector_id} connector={c} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Need another integration?{" "}
        <a href="https://github.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
          Open an issue <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </div>
  );
}
