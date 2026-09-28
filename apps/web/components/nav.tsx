"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing, BookOpenText, Cpu, Gauge, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClient } from "@/app/providers";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Console", icon: LayoutDashboard },
  { href: "/approvals", label: "Approvals", icon: BellRing },
  { href: "/knowledge", label: "Knowledge", icon: BookOpenText },
  { href: "/system", label: "System", icon: Gauge },
];

export function Nav() {
  const client = useClient();
  const path = usePathname();
  const pending = useQuery({
    queryKey: ["approvals", "pending-count"],
    queryFn: () => client.approvals("pending"),
    refetchInterval: 3_000,
  });
  const count = pending.data?.length ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight">
          <Cpu className="size-5 text-primary" />
          <span>
            m<span className="text-primary">OS</span>aic
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" || path.startsWith("/tasks") : path.startsWith(href);
            const isApprovals = href === "/approvals";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground",
                  isApprovals && count > 0 && "attention bg-st-waiting/15 text-st-waiting",
                )}
              >
                <Icon className="size-4" />
                {label}
                {isApprovals && count > 0 && (
                  <span className="rounded-full bg-st-waiting px-1.5 font-mono text-xs font-bold text-black">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto font-mono text-xs text-muted-foreground" title="Gateway">
          {client.baseUrl.replace(/^https?:\/\//, "")}
        </div>
      </div>
    </header>
  );
}
