// Typed gateway client for the phone. Shapes come from @mosaic/contracts (generated from the Python contracts).
// Auth: a Bearer session token when signed in with Google (Person C's POST /auth/google); otherwise the dev-mode
// X-Mosaic-User / X-Mosaic-Org headers that MOSAIC_AUTH=dev and the mock gateway accept.
import type { AgentProcess, Approval, Event, EvidenceSet, Priority, Task } from "@mosaic/contracts";
import { ORG_HEADER, USER_HEADER, WS_EVENTS_PATH } from "@mosaic/contracts";

export type Session = {
  baseUrl: string;
  user: string;
  org: string;
  roles: string[];
  /** Orgs the user can switch between (the switcher in Settings). */
  orgs: string[];
  /** Bearer session token from POST /auth/google; absent in dev mode. */
  token?: string;
  /** Explicit permissions from GET /auth/me, when the server sends them. */
  permissions?: string[];
  name?: string;
  email?: string;
};

export class GatewayError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export const isNetworkError = (e: unknown) => !(e instanceof GatewayError);

export function normalizeUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(u) ? u : `http://${u}`;
}

function headers(s: Session, json: boolean): Record<string, string> {
  const h: Record<string, string> = s.token ? { Authorization: `Bearer ${s.token}` } : { [USER_HEADER]: s.user, [ORG_HEADER]: s.org };
  if (s.token) h[ORG_HEADER] = s.org; // the selected org, for users in several
  if (s.roles.length && !s.token) h["X-Mosaic-Roles"] = s.roles.join(",");
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function request<T>(s: Pick<Session, "baseUrl"> & Partial<Session>, method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(normalizeUrl(s.baseUrl) + path, {
      method,
      signal: controller.signal,
      headers: s.user ? headers(s as Session, body !== undefined) : body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text.slice(0, 200) };
    }
    if (!res.ok) {
      const d = (data ?? {}) as { code?: string; message?: string; detail?: string };
      throw new GatewayError(res.status, d.code ?? "HTTP_ERROR", d.message ?? d.detail ?? res.statusText);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export function createClient(s: Session) {
  const call = <T>(method: string, path: string, body?: unknown) => request<T>(s, method, path, body);
  const q = (params: Record<string, string | number | undefined>) => {
    const e = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
    return e.length ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}` : "";
  };
  return {
    health: () => call<{ ok: boolean }>("GET", "/health"),
    listTasks: () => call<Task[]>("GET", "/tasks"),
    getTask: (id: string) => call<Task>("GET", `/tasks/${encodeURIComponent(id)}`),
    createTask: (goal: string, priority: Priority) => call<Task>("POST", "/tasks", { goal, priority }),
    cancelTask: (id: string) => call<Task>("POST", `/tasks/${encodeURIComponent(id)}/cancel`),
    processes: (taskId: string) => call<AgentProcess[]>("GET", `/agents${q({ task_id: taskId })}`),
    pendingApprovals: () => call<Approval[]>("GET", "/approvals?status=pending"),
    approve: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${encodeURIComponent(id)}/approve`, { comment: comment ?? null }),
    reject: (id: string, comment?: string) => call<Approval>("POST", `/approvals/${encodeURIComponent(id)}/reject`, { comment: comment ?? null }),
    search: (text: string, topK = 10) => call<EvidenceSet>("GET", `/knowledge/search${q({ q: text, top_k: topK })}`),
    /** Live events for one task. The real gateway replays the task's history on connect; de-duplicate by event_id. */
    events(taskId: string | undefined, onEvent: (e: Event) => void, onState?: (open: boolean) => void): () => void {
      let ws: WebSocket | null = null;
      let stopped = false;
      let delay = 1_000;
      const params: Record<string, string | undefined> = { task_id: taskId, token: s.token };
      const url = `${normalizeUrl(s.baseUrl).replace(/^http/, "ws")}${WS_EVENTS_PATH}${q(params)}`;
      const open = () => {
        if (stopped) return;
        ws = new WebSocket(url);
        ws.onopen = () => {
          delay = 1_000;
          onState?.(true);
        };
        ws.onmessage = (m) => {
          try {
            onEvent(JSON.parse(String(m.data)) as Event);
          } catch {
            /* ignore non-JSON frames */
          }
        };
        ws.onclose = () => {
          onState?.(false);
          if (!stopped) setTimeout(open, (delay = Math.min(delay * 2, 15_000)));
        };
        ws.onerror = () => ws?.close();
      };
      open();
      return () => {
        stopped = true;
        ws?.close();
      };
    },
  };
}

export type Client = ReturnType<typeof createClient>;

// ---------------------------------------------------------------- sign-in (Person C's endpoints; MOSAIC_AUTH=google)

type Me = { user_id?: string; id?: string; email?: string; name?: string; org_id?: string; roles?: string[]; permissions?: string[]; orgs?: string[] };

/** Exchange a Google ID token for a mOSaic session, then read who we are. */
export async function signInWithGoogle(baseUrl: string, idToken: string): Promise<Session> {
  const res = await request<Record<string, unknown>>({ baseUrl }, "POST", "/auth/google", { id_token: idToken });
  const token = String(res.token ?? res.session_token ?? res.access_token ?? "");
  if (!token) throw new GatewayError(500, "INTERNAL", "sign-in returned no session token");
  const me = (res.principal as Me | undefined) ?? (await request<Me>({ baseUrl, token, user: "_", org: "_", roles: [], orgs: [] } as Session, "GET", "/auth/me"));
  const org = me.org_id ?? me.orgs?.[0] ?? "";
  return {
    baseUrl,
    token,
    user: me.user_id ?? me.id ?? me.email ?? "me",
    org,
    orgs: me.orgs?.length ? me.orgs : org ? [org] : [],
    roles: me.roles ?? [],
    permissions: me.permissions,
    name: me.name,
    email: me.email,
  };
}

export async function signOut(s: Session): Promise<void> {
  if (s.token) await request(s, "POST", "/auth/logout").catch(() => undefined);
}
