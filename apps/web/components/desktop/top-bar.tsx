"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menubar } from "radix-ui";
import { useSyncExternalStore } from "react";
import { useClient } from "@/app/providers";
import { APPS, type AppId } from "@/lib/desktop/routes";
import type { Win } from "@/lib/desktop/windows";
import { isActive } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";
import { usePendingApprovals, useResources, useTasks } from "./hooks";
import { Mark } from "./logo";
import { Orb } from "./orb";
import { DOCK_APPS, KEYS } from "./shortcuts";

const subscribeClock = (tick: () => void) => {
  const t = setInterval(tick, 10_000);
  return () => clearInterval(t);
};
const clockNow = () => new Date().toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export interface MenuActions {
  spotlight: () => void;
  close: () => void;
  minimize: () => void;
  zoom: () => void;
  desktop: () => void;
  shortcuts: () => void;
  openApp: (app: AppId) => void;
  focusWindow: (key: string) => void;
  boot: () => void;
}

const content = "material-strong z-[7000] min-w-56 rounded-[10px] p-1 text-[13px] text-chrome-ink shadow-window";
const item =
  "flex cursor-default select-none items-center gap-2 rounded-[5px] px-2.5 py-1 outline-none data-[highlighted]:bg-brand data-[highlighted]:text-white data-[disabled]:opacity-40";

function Item({ label, keys, onSelect, disabled, icon }: { label: string; keys?: string; onSelect?: () => void; disabled?: boolean; icon?: React.ReactNode }) {
  return (
    <Menubar.Item className={item} onSelect={onSelect} disabled={disabled}>
      {icon}
      <span className="flex-1">{label}</span>
      {keys && <kbd className="font-mono text-[11px] opacity-60">{keys}</kbd>}
    </Menubar.Item>
  );
}

function Menu({ label, bold, children }: { label: React.ReactNode; bold?: boolean; children: React.ReactNode }) {
  return (
    <Menubar.Menu>
      <Menubar.Trigger className={cn("rounded-[5px] px-2 py-0.5 outline-none data-[state=open]:bg-black/10 dark:data-[state=open]:bg-white/15", bold && "font-bold")}>{label}</Menubar.Trigger>
      <Menubar.Portal>
        <Menubar.Content className={content} align="start" sideOffset={5}>
          {children}
        </Menubar.Content>
      </Menubar.Portal>
    </Menubar.Menu>
  );
}

const Sep = () => <Menubar.Separator className="mx-2 my-1 h-px bg-hairline" />;

/** The macOS-style menu bar: the system menu, the front app's name and its menus on the left; status items on the right. */
export function TopBar({ front, wins, actions, compact }: { front?: Win; wins: Win[]; actions: MenuActions; compact: boolean }) {
  const client = useClient();
  const { theme, setTheme } = useTheme();
  const pending = usePendingApprovals().data?.length ?? 0;
  const running = (useTasks().data ?? []).filter((t) => isActive(t.status)).length;
  const gpu = useResources().data?.gpu;
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => client.status(), refetchInterval: 15_000 });
  const clock = useSyncExternalStore(subscribeClock, clockNow, () => "");
  const appName = front ? (front.app === "task" ? "Task" : APPS[front.app].title) : "Desktop";

  return (
    <header className="material relative z-[5000] flex h-[28px] shrink-0 items-center gap-1 border-x-0 border-t-0 px-2.5 text-[13px] text-chrome-ink">
      <Menubar.Root className="flex items-center gap-0.5">
        <Menu label={<Mark className="size-4" />}>
          <Item label="About mOSaic" disabled />
          {status.data && <Item label={`Kernel ${status.data.version} · contract ${status.data.contract_version}`} disabled />}
          <Sep />
          <Menubar.RadioGroup value={theme ?? "light"} onValueChange={setTheme}>
            {["light", "dark", "system"].map((t) => (
              <Menubar.RadioItem key={t} value={t} className={item}>
                <span className="w-3 text-center">{theme === t ? "•" : ""}</span>
                <span className="capitalize">{t} appearance</span>
              </Menubar.RadioItem>
            ))}
          </Menubar.RadioGroup>
          <Sep />
          <Item label="Keyboard shortcuts" keys={KEYS.shortcuts} onSelect={actions.shortcuts} />
          <Item label="Restart (boot screen)" onSelect={actions.boot} />
        </Menu>
        <Menu label={appName} bold>
          <Item label={`About ${appName}`} disabled />
          <Sep />
          <Item label="Close window" keys={KEYS.close} onSelect={actions.close} disabled={!front} />
        </Menu>
        {!compact && (
          <>
            <Menu label="File">
              <Item label="New task…" keys={KEYS.spotlight} onSelect={actions.spotlight} />
              <Item label="Open…" keys="Ctrl K" onSelect={actions.spotlight} />
              <Sep />
              <Item label="Close window" keys={KEYS.close} onSelect={actions.close} disabled={!front} />
            </Menu>
            <Menu label="Go">
              {DOCK_APPS.map((a, i) => (
                <Item key={a} label={APPS[a].title} keys={`Alt ${i + 1}`} onSelect={() => actions.openApp(a)} icon={<AppTile app={a} size={16} />} />
              ))}
            </Menu>
            <Menu label="Window">
              <Item label="Minimise" keys={KEYS.minimize} onSelect={actions.minimize} disabled={!front} />
              <Item label="Zoom" keys={KEYS.zoom} onSelect={actions.zoom} disabled={!front} />
              <Item label="Show desktop" keys={KEYS.desktop} onSelect={actions.desktop} />
              <Item label="Switch windows" keys={KEYS.switch} disabled />
              {wins.length > 0 && <Sep />}
              {wins.map((w) => (
                <Item key={w.key} label={w.app === "task" ? `Task ${w.key.slice(5)}` : APPS[w.app].title} onSelect={() => actions.focusWindow(w.key)} icon={<AppTile app={w.app} size={16} />} />
              ))}
            </Menu>
            <Menu label="Help">
              <Item label="Keyboard shortcuts" keys={KEYS.shortcuts} onSelect={actions.shortcuts} />
            </Menu>
          </>
        )}
      </Menubar.Root>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={actions.spotlight} className="bar-btn gap-1.5 px-2" aria-label="Ask mOSaic (Alt Space)">
          <Search className="size-3.5" />
          {!compact && <kbd className="font-mono text-[11px] opacity-70">Alt Space</kbd>}
        </button>
        {running > 0 && (
          <Link href="/tasks" className="bar-btn gap-1.5 px-2" title="Running tasks">
            <Orb state="working" label="tasks running" />
            <span className="font-mono text-xs">{running}</span>
          </Link>
        )}
        {gpu && !compact && (
          <Link href="/system" className="bar-btn gap-1.5 px-2 font-mono text-xs tabular-nums" title={gpu.name}>
            GPU {gpu.utilization.toFixed(0)}% · {(gpu.memory_used_mb / 1024).toFixed(1)} GB
          </Link>
        )}
        <Link
          href="/approvals"
          aria-label={pending ? `${pending} approvals waiting` : "No approvals waiting"}
          className={cn("bar-btn gap-1 px-2", pending > 0 && "bg-st-waiting text-white hover:bg-st-waiting/90")}
        >
          <Bell className="size-3.5" />
          {pending > 0 && <span className="font-mono text-xs font-bold">{pending}</span>}
        </Link>
        <span className="whitespace-nowrap px-1.5 text-[13px] tabular-nums">{clock}</span>
      </div>
    </header>
  );
}
