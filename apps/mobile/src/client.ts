// Minimal typed gateway client for the phone: compose a task, list and resolve approvals.
// Shapes come from @mosaic/contracts (generated from the Python contracts); never hand-write them.
import type { Approval, Task, TaskCreate } from "@mosaic/contracts";
import { ORG_HEADER, USER_HEADER } from "@mosaic/contracts";

export type Settings = { baseUrl: string; user: string; org: string };

export class GatewayError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(`${code}: ${message}`);
  }
}

export function createClient({ baseUrl, user, org }: Settings) {
  const root = baseUrl.replace(/\/+$/, "");

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(root + path, {
        method,
        signal: controller.signal,
        headers: { [USER_HEADER]: user, [ORG_HEADER]: org, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new GatewayError(res.status, data?.code ?? "HTTP_ERROR", data?.message ?? res.statusText);
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    createTask: (body: TaskCreate) => call<Task>("POST", "/tasks", body),
    pendingApprovals: () => call<Approval[]>("GET", "/approvals?status=pending"),
    approve: (id: string, comment?: string) =>
      call<Approval>("POST", `/approvals/${encodeURIComponent(id)}/approve`, { comment: comment ?? null }),
    reject: (id: string, comment?: string) =>
      call<Approval>("POST", `/approvals/${encodeURIComponent(id)}/reject`, { comment: comment ?? null }),
  };
}

export type Client = ReturnType<typeof createClient>;
