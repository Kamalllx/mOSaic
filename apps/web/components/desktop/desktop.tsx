"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useClient } from "@/app/providers";
import { ApprovalsApp } from "@/components/apps/approvals";
import { FilesApp } from "@/components/apps/files";
import { JournalApp } from "@/components/apps/journal";
import { JournalsApp } from "@/components/apps/journals";
import { MemoryApp } from "@/components/apps/memory";
import { MonitorApp } from "@/components/apps/monitor";
import { ProgramsApp } from "@/components/apps/programs";
import { TaskApp } from "@/components/apps/task";
import { TasksApp } from "@/components/apps/tasks";
import { TerminalApp } from "@/components/apps/terminal";
import { APPS, type AppId, parseRoute } from "@/lib/desktop/routes";
import { type Area, COMPACT_WIDTH, EMPTY, focused as topWindow, reduce, type Win } from "@/lib/desktop/windows";
import { Boot } from "./boot";
import { Composer } from "./composer";
import { Dock } from "./dock";
import { Launcher } from "./launcher";
import { Notifications } from "./notifications";
import { TopBar } from "./top-bar";
import { Wallpaper } from "./wallpaper";
import { WindowContext } from "./window-context";
import { WindowFrame } from "./window-frame";

function AppBody({ win }: { win: Win }) {
  const r = parseRoute(win.url);
  switch (win.app) {
    case "tasks":
      return <TasksApp />;
    case "task":
      return <TaskApp id={r?.id ?? ""} />;
    case "approvals":
      return <ApprovalsApp />;
    case "files":
      return <FilesApp />;
    case "memory":
      return <MemoryApp />;
    case "journals":
      return <JournalsApp />;
    case "journal":
      return <JournalApp taskId={r?.id ?? ""} />;
    case "programs":
      return <ProgramsApp />;
    case "monitor":
      return <MonitorApp />;
    case "terminal":
      return <TerminalApp />;
  }
}

/** A window's title-bar text: the app, plus what it is showing. */
function useWindowTitle(win: Win): { title: string; subtitle?: string } {
  const client = useClient();
  const r = parseRoute(win.url);
  const task = useQuery({ queryKey: ["task", r?.id], queryFn: () => client.getTask(r!.id!), enabled: !!r?.id && (win.app === "task" || win.app === "journal") });
  if (win.app === "task") return { title: task.data?.goal ? truncate(task.data.goal, 70) : "Task", subtitle: r?.id };
  if (win.app === "journal") return { title: "Audit", subtitle: r?.id };
  if (win.app === "files") return { title: "Knowledge", subtitle: new URLSearchParams(win.url.split("?")[1] ?? "").get("path") ?? "/org" };
  return { title: APPS[win.app].title };
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function WindowView(props: { win: Win; focused: boolean; compact: boolean; area: Area; dispatch: React.Dispatch<Parameters<typeof reduce>[1]>; onNavigate: (url: string) => void; onClose: () => void }) {
  const { win, focused, compact, area, dispatch, onNavigate, onClose } = props;
  const { title, subtitle } = useWindowTitle(win);
  const nav = useMemo(() => ({ key: win.key, url: win.url, navigate: onNavigate, close: onClose }), [win.key, win.url, onNavigate, onClose]);
  return (
    <WindowFrame
      win={win}
      title={title}
      subtitle={subtitle}
      focused={focused}
      compact={compact}
      area={area}
      onFocus={() => dispatch({ type: "focus", key: win.key })}
      onClose={onClose}
      onMinimize={() => dispatch({ type: "minimize", key: win.key })}
      onToggleMax={() => dispatch({ type: "toggleMax", key: win.key })}
      onMove={(x, y) => dispatch({ type: "move", key: win.key, x, y, area })}
      onResize={(w, h) => dispatch({ type: "resize", key: win.key, w, h, area })}
    >
      <WindowContext.Provider value={nav}>
        <AppBody win={win} />
      </WindowContext.Provider>
    </WindowFrame>
  );
}

function DesktopInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const url = `${pathname}${search.size ? `?${search}` : ""}`;
  const [state, dispatch] = useReducer(reduce, EMPTY);
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Area>({ w: 1440, h: 800 });
  const [launcher, setLauncher] = useState(false);
  const compact = area.w < COMPACT_WIDTH;
  const top = topWindow(state);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The address bar drives the windows: a link, a deep link or Back opens or focuses the window for that URL...
  useEffect(() => {
    if (pathname === "/") dispatch({ type: "minimizeAll" });
    else dispatch({ type: "open", url, area });
    // area only sizes new windows; a resize must not reopen them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ...and the window in front drives the address bar, so a reload or a shared link comes back to it. Only after the
  // front window actually changes: on load the address bar is the truth, and writing "/" before its window has opened
  // would read as "show the desktop" and minimise it.
  const lastTop = useRef<string | null>(null);
  useEffect(() => {
    const sig = top ? `${top.key}|${top.url}` : "";
    if (lastTop.current === null || sig === lastTop.current) {
      lastTop.current = sig;
      return;
    }
    lastTop.current = sig;
    const want = top?.url ?? "/";
    if (want !== url) window.history.replaceState(null, "", want);
    // only when the front window (or its URL) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.key, top?.url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLauncher((o) => !o);
      } else if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        router.push("/terminal");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const navigate = useCallback((to: string) => router.push(to), [router]);
  const close = useCallback((key: string) => dispatch({ type: "close", key }), []);

  const onApp = (app: AppId, home: string) => {
    const family: AppId[] = app === "tasks" ? ["tasks", "task"] : app === "journals" ? ["journals", "journal"] : [app];
    const mine = state.wins.filter((w) => family.includes(w.app)).sort((a, b) => b.z - a.z);
    if (!mine.length) return router.push(home);
    if (top && family.includes(top.app)) return dispatch({ type: "minimize", key: top.key });
    dispatch({ type: "focus", key: mine[0].key });
  };

  if (pathname === "/boot") return <Boot />;

  const focusedTask = top?.app === "task" ? parseRoute(top.url)?.id : undefined;
  const titleOf = top ? (top.app === "task" ? "Task" : APPS[top.app].title) : undefined;

  return (
    <div className="desktop fixed inset-0 flex flex-col overflow-hidden bg-grout text-foreground">
      <Wallpaper />
      <TopBar title={titleOf} onLauncher={() => setLauncher(true)} onBell={() => router.push("/approvals")} />
      <main ref={areaRef} className={`relative min-h-0 flex-1 ${compact ? "" : "mb-[86px]"}`} aria-label="Desktop">
        <div className={`absolute inset-0 flex items-start justify-center overflow-y-auto px-4 ${compact ? "pt-6" : "pt-[12vh]"}`}>
          <Composer />
        </div>
        {state.wins.map((w) => (
          <WindowView key={w.key} win={w} focused={w.key === top?.key} compact={compact} area={area} dispatch={dispatch} onNavigate={navigate} onClose={() => close(w.key)} />
        ))}
        <Notifications focusedTask={focusedTask} />
      </main>
      <div className={compact ? "relative" : "pointer-events-none absolute inset-x-0 bottom-2.5 z-[5000] flex justify-center"}>
        <div className={compact ? "" : "pointer-events-auto"}>
          <Dock wins={state.wins} focusedKey={top?.key} compact={compact} onApp={onApp} onDesktop={() => router.push("/")} />
        </div>
      </div>
      <Launcher open={launcher} onOpenChange={setLauncher} />
    </div>
  );
}

/** The console as an operating system: wallpaper, menu bar, windows, dock. Routes only say which window to show. */
export function Desktop() {
  return (
    <Suspense>
      <DesktopInner />
    </Suspense>
  );
}
