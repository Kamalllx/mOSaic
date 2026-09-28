"use client";

import type { Event } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import { Box, Camera, CircleCheck, CircleX, Cpu, Gauge, MemoryStick, MonitorCog } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClient } from "@/app/providers";
import { ArtifactImage, isImage } from "@/components/artifacts";
import { formatTime } from "@/components/status";
import { str } from "@/lib/events";
import { cn } from "@/lib/utils";

function GaugeRing({ label, value, detail, icon: Icon }: { label: string; value: number | null; detail: string; icon: typeof Cpu }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const color = value === null ? "#6e7681" : pct > 85 ? "#f85149" : pct > 60 ? "#e3b341" : "#3fb950";
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5 rounded-xl border bg-card p-5">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${label} ${value === null ? "n/a" : `${pct.toFixed(0)}%`}`}>
        <circle cx="66" cy="66" r={R} fill="none" stroke="#1c2733" strokeWidth="12" />
        <circle
          cx="66" cy="66" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 66 66)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="66" y="72" textAnchor="middle" className="fill-foreground font-mono text-2xl font-bold">
          {value === null ? "n/a" : `${pct.toFixed(0)}%`}
        </text>
      </svg>
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Icon className="size-4" /> {label}</p>
        <p className="mt-1 font-mono text-sm">{detail}</p>
      </div>
    </div>
  );
}

/** The latest sandbox.screenshot events from the live stream (any task). */
function useScreenshots() {
  const client = useClient();
  const [shots, setShots] = useState<Event[]>([]);
  useEffect(
    () => client.events((e) => setShots((s) => [e, ...s.filter((x) => x.event_id !== e.event_id)].slice(0, 6)), { types: ["sandbox.screenshot"] }),
    [client],
  );
  return shots;
}

/** Before any live screenshot arrives: the screenshots of the most recent task that has some. */
function useLastTaskScreenshots() {
  const client = useClient();
  return useQuery({
    queryKey: ["last-task-screenshots"],
    queryFn: async () => {
      const tasks = (await client.listTasks()).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 5);
      for (const t of tasks) {
        const refs = (await client.taskArtifacts(t.task_id)).filter(isImage);
        if (refs.length) return { taskId: t.task_id, refs };
      }
      return null;
    },
  });
}

export default function SystemPage() {
  const client = useClient();
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => client.status(), refetchInterval: 10_000 });
  const res = useQuery({ queryKey: ["system-resources"], queryFn: () => client.resources(), refetchInterval: 2_000 });
  const sandboxes = useQuery({ queryKey: ["sandboxes"], queryFn: () => client.sandboxes(), refetchInterval: 3_000 });
  const shots = useScreenshots();
  const last = useLastTaskScreenshots();
  const r = res.data;
  const gpu = r?.gpu;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><MonitorCog className="size-6 text-primary" /> System</h1>
        {status.data && (
          <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-bold", status.data.ready ? "bg-st-running/15 text-st-running" : "bg-st-failed/15 text-st-failed")}>
            {status.data.ready ? "READY" : "NOT READY"}
          </span>
        )}
        {status.data && (
          <span className="font-mono text-xs text-muted-foreground">
            v{status.data.version} · contracts {status.data.contract_version} · up {Math.round(status.data.uptime_s / 60)} min
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GaugeRing label="CPU" icon={Cpu} value={r ? r.cpu_percent : null} detail={r ? `${r.cpu_percent.toFixed(1)} %` : "…"} />
        <GaugeRing
          label="RAM"
          icon={MemoryStick}
          value={r ? (100 * r.ram_used_mb) / Math.max(r.ram_total_mb, 1) : null}
          detail={r ? `${(r.ram_used_mb / 1024).toFixed(1)} / ${(r.ram_total_mb / 1024).toFixed(1)} GB` : "…"}
        />
        <GaugeRing
          label={gpu ? `GPU · ${gpu.name}` : "GPU"}
          icon={Gauge}
          value={gpu ? gpu.utilization : null}
          detail={gpu ? `${gpu.utilization.toFixed(0)} % · VRAM ${(gpu.memory_used_mb / 1024).toFixed(1)} / ${(gpu.memory_total_mb / 1024).toFixed(1)} GB` : "no GPU reported"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kernel</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3 font-mono text-sm sm:grid-cols-4">
            {[
              ["processes", r?.running_processes],
              ["queued tasks", r?.queued_tasks],
              ["sandboxes", r?.active_sandboxes],
              ["tokens / min", r?.tokens_last_minute],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-secondary/60 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-2xl font-bold">{v ?? "–"}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Components</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {status.data?.components.map((c) => (
              <li key={c.component} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm" title={c.detail || undefined}>
                {c.ok ? <CircleCheck className="size-4 text-st-running" /> : <CircleX className="size-4 text-st-failed" />}
                <span className="truncate">{c.component}</span>
                <span className={cn("ml-auto rounded px-1.5 font-mono text-[11px] font-bold", c.mode === "real" ? "bg-st-running/15 text-st-running" : "bg-st-waiting/15 text-st-waiting")}>
                  {c.mode}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Box className="size-4" /> Sandboxes</h2>
          <ul className="space-y-1.5">
            {(sandboxes.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">No sandboxes.</li>}
            {[...(sandboxes.data ?? [])].reverse().slice(0, 8).map((s) => (
              <li key={s.sandbox_id} className="flex items-center gap-3 font-mono text-xs">
                <span className={cn("rounded px-1.5 py-0.5 font-bold", s.status === "running" ? "bg-st-running/15 text-st-running" : "bg-secondary text-muted-foreground")}>{s.status}</span>
                <span>{s.sandbox_id}</span>
                <span className="text-muted-foreground">{s.spec.display ? "browser" : s.spec.image}</span>
                <span className="text-muted-foreground">net {s.spec.network}{s.spec.network_allow?.length ? ` → ${s.spec.network_allow.join(", ")}` : ""}</span>
                <Link href={`/tasks/${s.spec.task_id}`} className="ml-auto text-primary hover:underline">{s.spec.task_id}</Link>
              </li>
            ))}
          </ul>
          <h2 className="flex items-center gap-2 pt-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Camera className="size-4" /> Latest screenshots</h2>
          {shots.length === 0 && last.data ? (
            <div className="space-y-1">
              <p className="flex font-mono text-xs text-muted-foreground">
                from the last run
                <Link href={`/tasks/${last.data.taskId}`} className="ml-auto text-primary hover:underline">{last.data.taskId}</Link>
              </p>
              {last.data.refs.map((r) => <ArtifactImage key={r} artifact={r} />)}
            </div>
          ) : shots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Screenshots appear here live when an agent browses inside a sandbox.</p>
          ) : (
            <ul className="space-y-3">
              {shots.map((e, i) => (
                <li key={e.event_id} className="space-y-1">
                  <p className="flex gap-3 font-mono text-xs">
                    <span className="text-muted-foreground">{formatTime(e.ts)}</span>
                    <span className="text-muted-foreground">pid {e.pid}</span>
                    <Link href={`/tasks/${e.task_id}`} className="ml-auto text-primary hover:underline">{e.task_id}</Link>
                  </p>
                  {str(e, "artifact") && <ArtifactImage artifact={str(e, "artifact")!} className={i === 0 ? "" : "max-w-xs opacity-80"} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
