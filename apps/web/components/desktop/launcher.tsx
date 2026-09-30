"use client";

import { useMutation } from "@tanstack/react-query";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import { TaskStatusBadge } from "@/components/status";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { APPS, type AppId } from "@/lib/desktop/routes";
import { isActive } from "@/lib/events";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";
import { useAllDocs, useTasks } from "./hooks";
import { Orb } from "./orb";

const LAUNCHABLE: AppId[] = ["tasks", "approvals", "files", "memory", "journals", "programs", "monitor", "terminal", "settings"];

type Item = { id: string; label: string; detail?: string; icon: React.ReactNode; run: () => void };

/** Ctrl+K: apps, tasks and /org documents by name; anything else becomes a new task. */
export function Launcher({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const client = useClient();
  const router = useRouter();
  const docs = useAllDocs().data ?? [];
  const tasks = useTasks().data ?? [];
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const go = (url: string) => {
    onOpenChange(false);
    setQ("");
    router.push(url);
  };
  const start = useMutation({
    mutationFn: (goal: string) => client.createTask({ goal, priority: "high" }),
    onSuccess: (t) => go(`/tasks/${t.task_id}`),
    onError: (e) => toast.error("Couldn't start the task", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const has = (...s: (string | undefined)[]) => !needle || s.some((x) => x?.toLowerCase().includes(needle));
    const apps: Item[] = LAUNCHABLE.filter((a) => has(APPS[a].title, a)).map((a) => ({
      id: `app:${a}`,
      label: APPS[a].title,
      detail: APPS[a].home,
      icon: <AppTile app={a} size={24} className="rounded-[7px]" />,
      run: () => go(APPS[a].home),
    }));
    const taskItems: Item[] = needle
      ? tasks
          .filter((t) => has(t.goal, t.task_id))
          .slice(0, 4)
          .map((t) => ({
            id: `task:${t.task_id}`,
            label: t.goal,
            detail: t.task_id,
            icon: isActive(t.status) ? <Orb state="working" /> : <TaskStatusBadge status={t.status} />,
            run: () => go(`/tasks/${t.task_id}`),
          }))
      : [];
    const docItems: Item[] = needle
      ? docs
          .filter((d) => has(d.title, d.path))
          .slice(0, 6)
          .map((d) => ({
            id: `doc:${d.path}`,
            label: d.title ?? d.path,
            detail: d.path,
            icon: <FileText className="size-5 text-text-2" />,
            run: () => go(`/knowledge?path=${encodeURIComponent(d.path)}`),
          }))
      : [];
    const run: Item[] = needle.length > 8 ? [{ id: "run", label: `Run "${q.trim()}"`, detail: "new task", icon: <CornerDownLeft className="size-5 text-brand" />, run: () => start.mutate(q.trim()) }] : [];
    return [...apps, ...taskItems, ...docItems, ...run];
    // go and start are stable enough for a palette that lives for a few seconds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, docs, tasks]);
  const active = Math.min(sel, Math.max(0, items.length - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogTitle className="sr-only">Launcher</DialogTitle>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-text-2" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[active]?.run();
              }
            }}
            placeholder="Open an app, a task or a document, or type a goal to run"
            aria-label="Search apps, tasks and documents"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {start.isPending && <Orb state="shaping" label="Starting the task" />}
        </div>
        <ul role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={it.run}
                className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left", i === active && "bg-surface-3")}
              >
                <span className="flex w-6 justify-center">{it.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{it.label}</span>
                {it.detail && <span className="max-w-[45%] truncate font-mono text-xs text-text-2">{it.detail}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-text-2">Nothing matches. Type a longer goal to run it as a task.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
