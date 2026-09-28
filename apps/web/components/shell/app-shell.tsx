"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  BookOpenText,
  Bot,
  Brain,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  House,
  ListChecks,
  type LucideIcon,
  Monitor,
  Moon,
  MoreHorizontal,
  ScrollText,
  Search,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";
import { useClient } from "@/app/providers";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House, match: (p) => p === "/" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, match: (p) => p.startsWith("/tasks") },
  { href: "/approvals", label: "Approvals", icon: BellRing, match: (p) => p.startsWith("/approvals") },
  { href: "/knowledge", label: "Knowledge", icon: BookOpenText, match: (p) => p.startsWith("/knowledge") },
  { href: "/memory", label: "Memory", icon: Brain, match: (p) => p.startsWith("/memory") },
  { href: "/audit", label: "Audit", icon: ScrollText, match: (p) => p.startsWith("/audit") },
  { href: "/agents", label: "Agents", icon: Bot, match: (p) => p.startsWith("/agents") },
  { href: "/system", label: "System", icon: Gauge, match: (p) => p.startsWith("/system") },
];
const PHONE_NAV = ["/", "/tasks", "/approvals", "/knowledge"];

export function usePendingApprovals() {
  const client = useClient();
  return useQuery({ queryKey: ["approvals", "pending"], queryFn: () => client.approvals("pending"), refetchInterval: 5_000 });
}

export function useResources() {
  const client = useClient();
  return useQuery({ queryKey: ["system-resources"], queryFn: () => client.resources(), refetchInterval: 2_000 });
}

export function useModels() {
  const client = useClient();
  return useQuery({ queryKey: ["models"], queryFn: () => client.models(), refetchInterval: 30_000 });
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
        <rect x="2" y="2" width="9" height="9" rx="2" fill="var(--brand)" />
        <rect x="13" y="2" width="9" height="9" rx="2" fill="var(--brand)" opacity="0.55" />
        <rect x="2" y="13" width="9" height="9" rx="2" fill="var(--brand)" opacity="0.55" />
        <rect x="13" y="13" width="9" height="9" rx="2" fill="var(--text)" opacity="0.85" />
      </svg>
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight">
          m<span className="text-brand">OS</span>aic
        </span>
      )}
    </span>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const order = ["system", "light", "dark"] as const;
  const current = mounted ? ((theme as (typeof order)[number]) ?? "system") : "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${current}. Switch to ${next}`}
      title={`Theme: ${current}`}
      className="flex size-9 items-center justify-center rounded-md text-text-2 transition-colors hover:bg-surface-3 hover:text-foreground"
    >
      <Icon className="size-4.5" />
    </button>
  );
}

function GpuMeter() {
  const gpu = useResources().data?.gpu;
  if (!gpu) return null;
  const pct = (100 * gpu.memory_used_mb) / Math.max(1, gpu.memory_total_mb);
  return (
    <Link href="/system" className="hidden items-center gap-2 rounded-md border border-line px-2.5 py-1 font-mono text-xs text-text-2 hover:bg-surface-3 lg:flex" title={gpu.name}>
      <span>GPU {gpu.utilization.toFixed(0)}%</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <span className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </span>
      <span>
        {(gpu.memory_used_mb / 1024).toFixed(1)}/{(gpu.memory_total_mb / 1024).toFixed(0)} GB
      </span>
    </Link>
  );
}

/** The task a /tasks/[id] or /audit/[id] page is about, for the top bar. */
function useCurrentTaskGoal(path: string) {
  const client = useClient();
  const id = /^\/(?:tasks|audit)\/([^/]+)/.exec(path)?.[1];
  const task = useQuery({ queryKey: ["task", id], queryFn: () => client.getTask(id!), enabled: !!id });
  return id ? { id, goal: task.data?.goal } : null;
}

function TopBar({ path }: { path: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const count = usePendingApprovals().data?.length ?? 0;
  const current = useCurrentTaskGoal(path);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-background/95 px-4 backdrop-blur md:px-6">
      <span className="md:hidden">
        <Logo />
      </span>
      <form
        role="search"
        className="relative hidden w-full max-w-sm md:block"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/knowledge?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search /org knowledge…"
          aria-label="Search organization knowledge"
          className="h-9 w-full rounded-md border border-line bg-surface-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2"
        />
      </form>
      {current && (
        <p className="hidden min-w-0 flex-1 truncate text-sm text-text-2 xl:block" title={current.goal}>
          <span className="font-mono text-foreground">{current.id}</span>
          {current.goal && <span> · {current.goal}</span>}
        </p>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <GpuMeter />
        <Link
          href="/approvals"
          aria-label={count ? `${count} pending approval${count === 1 ? "" : "s"}` : "Approvals"}
          className={cn(
            "relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-surface-3",
            count ? "text-st-waiting" : "text-text-2",
          )}
        >
          {count ? <BellRing className="size-4.5" /> : <Bell className="size-4.5" />}
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-st-waiting px-1 text-center font-mono text-xs font-bold leading-5 text-black">
              {count}
            </span>
          )}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Sidebar({ path, collapsed, onToggle }: { path: string; collapsed: boolean; onToggle: () => void }) {
  const count = usePendingApprovals().data?.length ?? 0;
  const models = useModels().data;
  const allLocal = !models || models.every((m) => m.local !== false);
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface-1 transition-[width] duration-180 md:flex",
        collapsed ? "w-16" : "w-[220px]",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-line", collapsed ? "justify-center" : "px-4")}>
        <Link href="/" aria-label="mOSaic home">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          const badge = href === "/approvals" && count > 0 ? count : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-text-2 transition-colors hover:bg-surface-3 hover:text-foreground",
                active && "bg-surface-3 text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" aria-hidden />}
              <Icon className={cn("size-4.5 shrink-0", active && "text-brand")} aria-hidden />
              {!collapsed && <span className="flex-1">{label}</span>}
              {badge > 0 && (
                <span
                  className={cn(
                    "rounded-full bg-st-waiting px-1.5 font-mono text-xs font-bold leading-5 text-black",
                    collapsed && "absolute right-1.5 top-1",
                  )}
                  aria-label={`${badge} pending`}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className={cn("space-y-1 border-t border-line p-3 text-xs", collapsed && "px-1 text-center")}>
        {!collapsed && <p className="font-mono text-text-2">alice · acme</p>}
        <p className={cn("flex items-center gap-1.5", collapsed && "justify-center")} title={allLocal ? "Every model runs on this machine" : "Remote models are enabled"}>
          <span className={cn("size-2 rounded-full", allLocal ? "bg-st-running" : "bg-st-waiting")} aria-hidden />
          {!collapsed && <span className="text-text-2">{allLocal ? "Local · on-device" : "Remote models on"}</span>}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-1 flex h-8 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}

function PhoneNav({ path }: { path: string }) {
  const count = usePendingApprovals().data?.length ?? 0;
  const [more, setMore] = useState(false);
  const items = NAV.filter((n) => PHONE_NAV.includes(n.href));
  const rest = NAV.filter((n) => !PHONE_NAV.includes(n.href));
  return (
    <>
      {more && (
        <div className="fixed inset-x-0 bottom-16 z-40 grid grid-cols-4 gap-1 border-t border-line bg-surface-1 p-2 md:hidden">
          {rest.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMore(false)} className="flex flex-col items-center gap-1 rounded-md py-2 text-xs text-text-2 hover:bg-surface-3">
              <Icon className="size-5" aria-hidden /> {label}
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-line bg-surface-1 md:hidden">
        {items.map(({ href, label, icon: Icon, match }) => (
          <Link
            key={href}
            href={href}
            aria-current={match(path) ? "page" : undefined}
            className={cn("relative flex flex-col items-center justify-center gap-0.5 text-xs", match(path) ? "text-brand" : "text-text-2")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
            {href === "/approvals" && count > 0 && (
              <span className="absolute right-[22%] top-1.5 min-w-5 rounded-full bg-st-waiting px-1 text-center font-mono text-xs font-bold leading-5 text-black">{count}</span>
            )}
          </Link>
        ))}
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex flex-col items-center justify-center gap-0.5 text-xs text-text-2">
          <MoreHorizontal className="size-5" aria-hidden />
          More
        </button>
      </nav>
    </>
  );
}

const noop = () => () => {};
const SIDEBAR_KEY = "sidebar-collapsed";

function subscribeSidebar(cb: () => void) {
  window.addEventListener(SIDEBAR_KEY, cb);
  return () => window.removeEventListener(SIDEBAR_KEY, cb);
}

function readSidebar() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(SIDEBAR_KEY));
  };

  if (path === "/boot") return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <Sidebar path={path} collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar path={path} />
        <main className="w-full flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-6">{children}</main>
      </div>
      <PhoneNav path={path} />
    </div>
  );
}
