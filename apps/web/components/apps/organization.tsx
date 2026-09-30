"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Crown, MailPlus, Shield, Trash2, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { Loading } from "@/components/desktop/orb";
import type { MemberRole, OrgMember } from "@/lib/mosaic-client";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";

const ROLE_ORDER: MemberRole[] = ["owner", "admin", "approver", "member", "viewer"];

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  approver: "Approver",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_ICON: Record<MemberRole, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  approver: UserCog,
  member: Users,
  viewer: Users,
};

function RoleBadge({ role }: { role: MemberRole }) {
  const Icon = ROLE_ICON[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
        role === "owner" && "bg-st-waiting/15 text-st-waiting",
        role === "admin" && "bg-brand/15 text-brand",
        role === "approver" && "bg-brand-subtle/30 text-foreground",
        (role === "member" || role === "viewer") && "bg-surface-3 text-text-2",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ROLE_LABEL[role]}
    </span>
  );
}

function MemberRow({
  m,
  orgId,
  canManage,
}: {
  m: OrgMember;
  orgId: string;
  canManage: boolean;
}) {
  const client = useClient();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const update = useMutation({
    mutationFn: (role: MemberRole) => client.updateMember(orgId, m.user_id, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
      setMenuOpen(false);
      toast.success("Role updated");
    },
    onError: (e) => toast.error("Couldn't update role", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  const remove = useMutation({
    mutationFn: () => client.removeMember(orgId, m.user_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
      toast.success("Member removed");
    },
    onError: (e) => toast.error("Couldn't remove member", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {/* Avatar */}
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 font-semibold text-sm uppercase" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m.avatar ? <img src={m.avatar} alt="" className="size-9 rounded-full object-cover" /> : m.name.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.name}</p>
        <p className="truncate font-mono text-xs text-text-2">{m.email}</p>
      </div>
      {m.status === "invited" && (
        <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-xs text-text-2">invited</span>
      )}
      <RoleBadge role={m.role} />
      {canManage && m.role !== "owner" && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Change role for ${m.name}`}
            aria-expanded={menuOpen}
            className="rounded p-1 hover:bg-surface-3"
          >
            <ChevronDown className="size-4 text-text-2" aria-hidden />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <ul className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-surface-1 shadow-panel">
                {ROLE_ORDER.filter((r) => r !== "owner").map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => update.mutate(r)}
                      disabled={update.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-3 disabled:opacity-50"
                    >
                      <RoleBadge role={r} />
                    </button>
                  </li>
                ))}
                <li className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-st-failed hover:bg-st-failed/8 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function InviteForm({ orgId }: { orgId: string }) {
  const client = useClient();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [open, setOpen] = useState(false);

  const invite = useMutation({
    mutationFn: () => client.inviteMember(orgId, { email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
      setEmail("");
      setOpen(false);
      toast.success("Invite sent");
    },
    onError: (e) => toast.error("Couldn't send invite", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm hover:bg-surface-3"
      >
        <MailPlus className="size-4" aria-hidden />
        Invite member
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        invite.mutate();
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-2 p-3"
    >
      <div className="flex-1 min-w-48">
        <label className="mb-1 block text-xs font-medium text-text-2">Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="h-9 w-full rounded-md border border-line bg-surface-1 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-2">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="h-9 rounded-md border border-line bg-surface-1 px-2 text-sm"
        >
          {ROLE_ORDER.filter((r) => r !== "owner").map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={invite.isPending}
          className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-[var(--on-brand)] hover:bg-brand-hover disabled:opacity-50"
        >
          Send invite
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-md border border-line px-3 text-sm hover:bg-surface-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function RolesTable() {
  const client = useClient();
  const org = useQuery({ queryKey: ["org-me"], queryFn: () => client.getOrg() });
  const orgId = org.data?.org_id ?? "acme";
  const roles = useQuery({
    queryKey: ["org-roles", orgId],
    queryFn: () => client.orgRoles(orgId),
    enabled: !!org.data,
  });

  if (roles.isLoading) return <Loading label="Loading roles" state="working" />;
  if (roles.isError) return <p className="text-sm text-st-failed">Could not load roles.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface-1 shadow-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wider text-text-2">
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Description</th>
            <th className="px-4 py-2.5">Permissions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(roles.data ?? []).map((r) => (
            <tr key={r.role}>
              <td className="px-4 py-3 align-top">
                <RoleBadge role={r.role as MemberRole} />
              </td>
              <td className="px-4 py-3 align-top text-text-2">{r.description}</td>
              <td className="px-4 py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-text-2">{p}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrganizationApp() {
  const client = useClient();
  const [tab, setTab] = useState<"members" | "roles">("members");

  const org = useQuery({ queryKey: ["org-me"], queryFn: () => client.getOrg(), refetchInterval: 30_000 });
  const orgId = org.data?.org_id ?? "acme";
  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => client.orgMembers(orgId),
    enabled: !!org.data,
    refetchInterval: 30_000,
  });

  // In production this comes from the session principal. For now hard-code "admin" so
  // we always show the invite/manage UI in the demo without an auth layer.
  const myRole = "admin" as MemberRole;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="size-6 text-brand" aria-hidden />
            {org.isLoading ? <span className="h-7 w-40 animate-pulse rounded bg-surface-3" aria-hidden /> : (org.data?.name ?? "Organization")}
          </h1>
          {org.data?.domain && <p className="mt-1 text-sm text-text-2">{org.data.domain}</p>}
        </div>
        {org.data && (
          <span className="font-mono text-sm text-text-2">
            {org.data.member_count} {org.data.member_count === 1 ? "member" : "members"}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Organization sections" className="flex gap-1 overflow-hidden rounded-xl border border-line bg-surface-1 p-1">
        {(["members", "roles"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors", tab === t ? "bg-surface-3 text-foreground" : "text-text-2 hover:bg-surface-2")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="space-y-3">
          {canManage && <InviteForm orgId={orgId} />}
          <section aria-label="Members list" className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel">
            {members.isError && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-sm text-st-failed">Gateway unreachable: {String(members.error)}</p>
                <button type="button" onClick={() => members.refetch()} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-3">
                  Retry
                </button>
              </div>
            )}
            {members.isLoading && <Loading label="Loading members" state="working" />}
            {members.isSuccess && members.data.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Users className="mx-auto mb-2 size-8 text-muted-foreground opacity-40" aria-hidden />
                <p className="text-sm font-medium text-text-2">No members yet.</p>
                {canManage && <p className="mt-1 text-xs text-muted-foreground">Invite people using the form above.</p>}
              </div>
            )}
            {members.isSuccess && (
              <ul className="divide-y divide-line">
                {members.data.map((m) => (
                  <MemberRow key={m.user_id} m={m} orgId={orgId} canManage={canManage} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "roles" && (
        <div className="space-y-3">
          <p className="text-sm text-text-2">
            Role definitions are read from <span className="font-mono">policies/roles.yaml</span>. An administrator can adjust permissions without a code change.
          </p>
          <RolesTable />
        </div>
      )}
    </div>
  );
}
