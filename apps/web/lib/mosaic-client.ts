// Typed client for the mOSaic gateway. The ONLY way the web UI talks to the backend.
// Works unchanged against the mock gateway (`uv run mosaic-mock-gateway`) and the real kernel.
// Owner: P2. Types are generated from the Python contracts; never hand-write backend shapes here.
import type {
  AgentManifest,
  AgentProcess,
  Approval,
  EvidenceSet,
  Event,
  GraphResult,
  KnowledgeListing,
  KnowledgeObject,
  ProcessTreeNode,
  ResourceSnapshot,
  RunTimeline,
  SandboxInfo,
  SystemStatus,
  Task,
  TaskCreate,
} from "@mosaic/contracts";
import { ORG_HEADER, USER_HEADER, WS_EVENTS_PATH } from "@mosaic/contracts";

export class MosaicError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export function createMosaicClient(baseUrl = process.env.NEXT_PUBLIC_MOSAIC_URL ?? "http://localhost:8080",
                                   user = "alice", org = "acme") {
  const headers = { "Content-Type": "application/json", [USER_HEADER]: user, [ORG_HEADER]: org };

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ code: "INTERNAL", message: res.statusText }));
      throw new MosaicError(res.status, err.code, err.message);
    }
    return res.json() as Promise<T>;
  }
  const q = (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return s.size ? `?${s}` : "";
  };

  return {
    // tasks
    createTask: (body: TaskCreate) => call<Task>("POST", "/tasks", body),
    listTasks: () => call<Task[]>("GET", "/tasks"),
    getTask: (id: string) => call<Task>("GET", `/tasks/${id}`),
    cancelTask: (id: string) => call<Task>("POST", `/tasks/${id}/cancel`),
    // processes
    listProcesses: (taskId?: string) => call<AgentProcess[]>("GET", `/agents${q({ task_id: taskId })}`),
    processTree: (taskId?: string) => call<ProcessTreeNode[]>("GET", `/agents/tree${q({ task_id: taskId })}`),
    killProcess: (pid: number) => call<AgentProcess>("POST", `/agents/${pid}/kill`),
    registry: () => call<AgentManifest[]>("GET", "/registry/agents"),
    // knowledge
    search: (text: string, topK = 8) => call<EvidenceSet>("GET", `/knowledge/search${q({ q: text, top_k: topK })}`),
    tree: (path = "/org") => call<KnowledgeListing>("GET", `/knowledge/tree${q({ path })}`),
    object: (path: string) => call<KnowledgeObject>("GET", `/knowledge/object${q({ path })}`),
    graph: (path: string, depth = 1) => call<GraphResult>("GET", `/knowledge/graph${q({ path, depth })}`),
    // governance
    approvals: (status?: string) => call<Approval[]>("GET", `/approvals${q({ status })}`),
    approve: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${id}/approve`, { comment }),
    reject: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${id}/reject`, { comment }),
    audit: (taskId: string) => call<RunTimeline>("GET", `/audit/${taskId}`),
    // system
    status: () => call<SystemStatus>("GET", "/system/status"),
    resources: () => call<ResourceSnapshot>("GET", "/system/resources"),
    sandboxes: (taskId?: string) => call<SandboxInfo[]>("GET", `/sandboxes${q({ task_id: taskId })}`),

    /** Subscribe to the live event stream. Returns an unsubscribe function. */
    events(onEvent: (e: Event) => void, opts: { taskId?: string; types?: string[] } = {}): () => void {
      const url = new URL(WS_EVENTS_PATH + q({ task_id: opts.taskId, types: opts.types?.join(",") }), baseUrl);
      url.protocol = url.protocol.replace("http", "ws");
      const ws = new WebSocket(url);
      ws.onmessage = (m) => onEvent(JSON.parse(m.data) as Event);
      return () => ws.close();
    },
  };
}

export type MosaicClient = ReturnType<typeof createMosaicClient>;
