// Typed client for the mOSaic gateway. The ONLY way the web UI talks to the backend.
// Works unchanged against the mock gateway (`uv run mosaic-mock-gateway`) and the real kernel.
// Owner: P2. Types are generated from the Python contracts; never hand-write backend shapes here.
import type {
  AgentManifest,
  AgentProcess,
  Approval,
  Checkpoint,
  EvidenceSet,
  Event,
  GraphResult,
  KnowledgeListing,
  KnowledgeObject,
  MemoryRecord,
  ModelInfo,
  PolicyDocument,
  ProcessTreeNode,
  ResourceSnapshot,
  RunTimeline,
  SandboxInfo,
  SystemStatus,
  Task,
  TaskCreate,
  ToolSpec,
  ValidationReport,
} from "@mosaic/contracts";
import { ORG_HEADER, USER_HEADER, WS_EVENTS_PATH } from "@mosaic/contracts";


// ---- Identity / org / connector types -----------------------------------------------
// These are gateway-local shapes (not yet in the shared contract) for the new Phase 2 surfaces.

export type MemberRole = "owner" | "admin" | "approver" | "member" | "viewer";
export type MemberStatus = "active" | "invited";

export interface OrgMember {
  user_id: string;
  email: string;
  name: string;
  avatar?: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at?: string;
}

export interface Org {
  org_id: string;
  name: string;
  domain?: string;
  created_at: string;
  member_count: number;
}

export interface RoleDefinition {
  role: MemberRole;
  description: string;
  permissions: string[];
}

export type ConnectorId = "github" | "google_calendar";
export type ConnectorStatus = "connected" | "disconnected" | "error";

export interface ConnectorInfo {
  connector_id: ConnectorId;
  name: string;
  status: ConnectorStatus;
  scopes?: string[];
  last_sync?: string;
  connected_by?: string;
  connected_at?: string;
  recent_agents?: string[];
}

export interface IngestProgressEvent {
  file: string;
  stage: "converting" | "writing" | "indexing" | "done" | "error";
  error?: string;
  path?: string;
}
// -------------------------------------------------------------------------------------


export class MosaicError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_MOSAIC_URL ?? "http://localhost:8080";

/** artifact://<task_id>/<name> → <baseUrl>/tasks/<task_id>/artifacts/<name> (each segment URL-encoded). */
export function artifactUrl(baseUrl: string, ref: string): string | null {
  const m = /^artifact:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!m) return null;
  const name = m[2].split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/tasks/${encodeURIComponent(m[1])}/artifacts/${name}`;
}

export function createMosaicClient(baseUrl = DEFAULT_BASE_URL, user = "alice", org = "acme") {
  const headers = { "Content-Type": "application/json", [USER_HEADER]: user, [ORG_HEADER]: org };

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ code: "INTERNAL", message: res.statusText }));
      throw new MosaicError(res.status, err.code ?? "INTERNAL", err.message ?? err.detail ?? res.statusText);
    }
    return res.json() as Promise<T>;
  }
  const q = (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return s.size ? `?${s}` : "";
  };

  return {
    baseUrl,
    // tasks
    createTask: (body: TaskCreate) => call<Task>("POST", "/tasks", body),
    listTasks: () => call<Task[]>("GET", "/tasks"),
    getTask: (id: string) => call<Task>("GET", `/tasks/${id}`),
    cancelTask: (id: string) => call<Task>("POST", `/tasks/${id}/cancel`),
    taskArtifacts: (id: string) => call<string[]>("GET", `/tasks/${id}/artifacts`),
    /** URL of an artifact's bytes (for <img src>, links); null if `ref` isn't artifact://<task>/<name>. */
    artifactUrl: (ref: string) => artifactUrl(baseUrl, ref),
    artifactText: async (ref: string) => {
      const url = artifactUrl(baseUrl, ref);
      if (!url) throw new MosaicError(400, "BAD_REQUEST", `not an artifact ref: ${ref}`);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ code: "INTERNAL", message: res.statusText }));
        throw new MosaicError(res.status, err.code ?? "INTERNAL", err.message ?? res.statusText);
      }
      return res.text();
    },
    // processes
    listProcesses: (taskId?: string) => call<AgentProcess[]>("GET", `/agents${q({ task_id: taskId })}`),
    processTree: (taskId?: string) => call<ProcessTreeNode[]>("GET", `/agents/tree${q({ task_id: taskId })}`),
    killProcess: (pid: number) => call<AgentProcess>("POST", `/agents/${pid}/kill`),
    pauseProcess: (pid: number) => call<AgentProcess>("POST", `/agents/${pid}/pause`),
    resumeProcess: (pid: number) => call<AgentProcess>("POST", `/agents/${pid}/resume`),
    registry: () => call<AgentManifest[]>("GET", "/registry/agents"),
    // knowledge
    search: (text: string, topK = 8) => call<EvidenceSet>("GET", `/knowledge/search${q({ q: text, top_k: topK })}`),
    tree: (path = "/org") => call<KnowledgeListing>("GET", `/knowledge/tree${q({ path })}`),
    object: (path: string) => call<KnowledgeObject>("GET", `/knowledge/object${q({ path })}`),
    graph: (path: string, depth = 1) => call<GraphResult>("GET", `/knowledge/graph${q({ path, depth })}`),
    validate: () => call<ValidationReport>("POST", "/knowledge/validate"),
    memory: (opts: { owner?: string; taskId?: string } = {}) =>
      call<MemoryRecord[]>("GET", `/memory${q({ owner: opts.owner, task_id: opts.taskId })}`),
    // governance
    approvals: (status?: string) => call<Approval[]>("GET", `/approvals${q({ status })}`),
    approve: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${id}/approve`, { comment }),
    reject: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${id}/reject`, { comment }),
    audit: (taskId: string) => call<RunTimeline>("GET", `/audit/${taskId}`),
    // added for the revamped console (existing routes only)
    health: () => call<Record<string, unknown>>("GET", "/health"),
    models: () => call<ModelInfo[]>("GET", "/models"),
    registryTools: () => call<ToolSpec[]>("GET", "/registry/tools"),
    getProcess: (pid: number) => call<AgentProcess>("GET", `/agents/${pid}`),
    checkpointProcess: (pid: number) => call<Checkpoint>("POST", `/agents/${pid}/checkpoint`),
    resumeTask: (id: string) => call<Task>("POST", `/tasks/${id}/resume`),
    checkpointTask: (id: string) => call<Checkpoint[]>("POST", `/tasks/${id}/checkpoint`),
    reindex: () => call<Record<string, number>>("POST", "/knowledge/reindex"),
    policies: () => call<PolicyDocument[]>("GET", "/policies"),
    // system
    status: () => call<SystemStatus>("GET", "/system/status"),
    resources: () => call<ResourceSnapshot>("GET", "/system/resources"),
    sandboxes: (taskId?: string) => call<SandboxInfo[]>("GET", `/sandboxes${q({ task_id: taskId })}`),
    // upload (multipart – returns IngestResult-compatible shape)
    upload: async (files: File[], folder: string, privacy = "internal") => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("target_folder", folder);
      fd.append("privacy", privacy);
      const res = await fetch(`${baseUrl}/knowledge/upload`, { method: "POST", headers: { [USER_HEADER]: user, [ORG_HEADER]: org }, body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ code: "INTERNAL", message: res.statusText }));
        throw new MosaicError(res.status, err.code ?? "INTERNAL", err.message ?? res.statusText);
      }
      return res.json() as Promise<{ ingested: number; paths: string[] }>;
    },
    // identity / org / members
    getOrg: () => call<Org>("GET", "/orgs/me"),
    orgMembers: (orgId: string) => call<OrgMember[]>("GET", `/orgs/${encodeURIComponent(orgId)}/members`),
    inviteMember: (orgId: string, body: { email: string; role: MemberRole }) => call<OrgMember>("POST", `/orgs/${encodeURIComponent(orgId)}/members`, body),
    updateMember: (orgId: string, userId: string, body: { role: MemberRole }) => call<OrgMember>("PATCH", `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, body),
    removeMember: (orgId: string, userId: string) => call<void>("DELETE", `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`),
    orgRoles: (orgId: string) => call<RoleDefinition[]>("GET", `/orgs/${encodeURIComponent(orgId)}/roles`),
    // connectors
    connectors: () => call<ConnectorInfo[]>("GET", "/connectors"),
    connectOAuth: (connectorId: ConnectorId) => call<{ auth_url: string }>("POST", `/connectors/${connectorId}/connect`),
    disconnectConnector: (connectorId: ConnectorId) => call<void>("DELETE", `/connectors/${connectorId}`),
    syncConnector: (connectorId: ConnectorId) => call<{ queued: boolean }>("POST", `/connectors/${connectorId}/sync`),

    /** Subscribe to the live event stream, reconnecting with exponential backoff. Returns an unsubscribe function.
     *  The real gateway replays a task's history on connect, so consumers must de-duplicate by event_id. */
    events(
      onEvent: (e: Event) => void,
      opts: { taskId?: string; types?: string[]; onStatus?: (s: StreamStatus) => void } = {},
    ): () => void {
      const url = new URL(WS_EVENTS_PATH + q({ task_id: opts.taskId, types: opts.types?.join(",") }), baseUrl);
      url.protocol = url.protocol.replace("http", "ws");
      let ws: WebSocket | null = null;
      let stopped = false;
      let attempt = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const connect = () => {
        opts.onStatus?.(attempt === 0 ? "connecting" : "reconnecting");
        ws = new WebSocket(url);
        ws.onopen = () => {
          attempt = 0;
          opts.onStatus?.("open");
        };
        ws.onmessage = (m) => onEvent(JSON.parse(m.data) as Event);
        ws.onclose = () => {
          if (stopped) return;
          const delay = Math.min(10_000, 500 * 2 ** attempt) * (0.8 + Math.random() * 0.4);
          attempt += 1;
          opts.onStatus?.("reconnecting");
          timer = setTimeout(connect, delay);
        };
        ws.onerror = () => ws?.close();
      };
      connect();
      return () => {
        stopped = true;
        clearTimeout(timer);
        ws?.close();
        opts.onStatus?.("closed");
      };
    },
  };
}

export type MosaicClient = ReturnType<typeof createMosaicClient>;
