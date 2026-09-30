// Role -> permission hints for the UI, mirroring the phase-2 RBAC plan (Person C: policies/roles.yaml).
// The gateway is the authority: this only hides buttons the user could not use anyway. When the session carries an
// explicit permission list (from GET /auth/me), that list wins over this table.
export type Permission =
  | "task.create"
  | "task.cancel"
  | "approval.resolve"
  | "knowledge.read"
  | "knowledge.ingest"
  | "connectors.manage"
  | "config.read"
  | "config.manage"
  | "members.manage";

export const ROLES = ["owner", "admin", "approver", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const ALL: Permission[] = [
  "task.create",
  "task.cancel",
  "approval.resolve",
  "knowledge.read",
  "knowledge.ingest",
  "connectors.manage",
  "config.read",
  "config.manage",
  "members.manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  admin: ALL,
  approver: ["task.create", "task.cancel", "approval.resolve", "knowledge.read", "config.read"],
  member: ["task.create", "task.cancel", "knowledge.read", "knowledge.ingest", "config.read"],
  viewer: ["knowledge.read", "config.read"],
};

export function permissionsFor(roles: string[], explicit?: string[]): Set<string> {
  if (explicit?.length) return new Set(explicit);
  // Dev mode without roles behaves like today's gateway: every header user may do everything.
  if (!roles.length) return new Set(ALL);
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r as Role] ?? []));
}

export function can(perms: Set<string>, p: Permission): boolean {
  return perms.has(p);
}
