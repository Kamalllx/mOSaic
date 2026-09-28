"use client";

import type { AgentProcess } from "@mosaic/contracts";
import { ALLOWED_TRANSITIONS } from "@mosaic/contracts";
import { useMutation } from "@tanstack/react-query";
import {
  Background,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Hourglass, Pause, Play, Skull } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MosaicError } from "@/lib/mosaic-client";
import { agentTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AgentStateBadge } from "./status";

const NODE_W = 196;
const NODE_H = 104;
const GAP_X = 18;
const GAP_Y = 64;

type ProcNode = Node<{ proc: AgentProcess; onAction: (a: Action, p: AgentProcess) => void }, "proc">;
type Action = "kill" | "pause" | "resume";

const can = (state: string | undefined, next: string) => (ALLOWED_TRANSITIONS[state ?? ""] ?? []).includes(next);
const tokensOf = (p: AgentProcess) => (p.usage?.tokens_prompt ?? 0) + (p.usage?.tokens_completion ?? 0);

function ProcessNode({ data }: NodeProps<ProcNode>) {
  const p = data.proc;
  const tone = agentTone(p.state);
  const busy = p.state === "RUNNING";
  return (
    <div
      className={cn("rounded-lg border-2 bg-card px-3 py-2 shadow-lg", tone.border, p.state === "WAITING" && "attention")}
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-mono text-lg font-bold", tone.text)}>{p.pid}</span>
        <AgentStateBadge state={p.state} />
      </div>
      <p className="truncate text-sm font-medium">{p.agent}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <span className="rounded bg-secondary px-1.5 py-0.5">{tokensOf(p)} tok</span>
        {(p.usage?.tool_calls ?? 0) > 0 && <span className="rounded bg-secondary px-1.5 py-0.5">{p.usage?.tool_calls} tools</span>}
        {p.waiting_on && (
          <span className="flex items-center gap-1 rounded bg-st-waiting/15 px-1.5 py-0.5 text-st-waiting">
            <Hourglass className="size-3" /> {p.waiting_on}
          </span>
        )}
      </div>
      <div className="nodrag mt-1.5 flex gap-1">
        {can(p.state, "PAUSED") && (
          <NodeButton label="Pause" onClick={() => data.onAction("pause", p)} icon={<Pause className="size-3" />} />
        )}
        {p.state === "PAUSED" && can(p.state, "RUNNING") && (
          <NodeButton label="Resume" onClick={() => data.onAction("resume", p)} icon={<Play className="size-3" />} />
        )}
        {can(p.state, "TERMINATED") && (
          <NodeButton label="Kill" danger onClick={() => data.onAction("kill", p)} icon={<Skull className="size-3" />} />
        )}
        {busy && <span className="ml-auto self-center size-2 animate-pulse rounded-full bg-st-running" />}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

function NodeButton({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground",
        danger && "hover:border-st-failed hover:text-st-failed",
      )}
    >
      {icon} {label}
    </button>
  );
}

const nodeTypes = { proc: ProcessNode };

/** Re-fit whenever the set of processes or their parents change: fitView on its own only runs for the first render, and new
 *  nodes need a moment to be measured, so fit once right away and once after they've rendered. */
function FitOnGrowth({ pids }: { pids: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const fit = () => void fitView({ padding: 0.08, maxZoom: 1.25, duration: 250 });
    const timers = [setTimeout(fit, 60), setTimeout(fit, 450)];
    return () => timers.forEach(clearTimeout);
  }, [pids, fitView]);
  return null;
}

/** Tidy top-down layout: leaves take one slot each, parents sit centred over their children. */
export function layout(procs: AgentProcess[]): { positions: Record<number, { x: number; y: number }>; edges: [number, number][] } {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  for (const p of [...procs].sort((a, b) => a.pid - b.pid)) {
    if (p.ppid && byPid.has(p.ppid)) children.set(p.ppid, [...(children.get(p.ppid) ?? []), p.pid]);
    else roots.push(p.pid);
  }
  const positions: Record<number, { x: number; y: number }> = {};
  const edges: [number, number][] = [];
  let slot = 0;
  const place = (pid: number, depth: number): number => {
    const kids = children.get(pid) ?? [];
    let x: number;
    if (!kids.length) {
      x = slot * (NODE_W + GAP_X);
      slot += 1;
    } else {
      const xs = kids.map((k) => {
        edges.push([pid, k]);
        return place(k, depth + 1);
      });
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    positions[pid] = { x, y: depth * (NODE_H + GAP_Y) };
    return x;
  };
  roots.forEach((r) => place(r, 0));
  return { positions, edges };
}

export function ProcessTree({ processes }: { processes: Record<number, AgentProcess> }) {
  const client = useClient();
  const [confirm, setConfirm] = useState<AgentProcess | null>(null);
  const act = useMutation({
    mutationFn: ({ action, pid }: { action: Action; pid: number }) =>
      action === "kill" ? client.killProcess(pid) : action === "pause" ? client.pauseProcess(pid) : client.resumeProcess(pid),
    onSuccess: (p, { action }) => toast(`pid ${p.pid} ${action === "kill" ? "killed" : action === "pause" ? "paused" : "resumed"}`),
    onError: (e) => toast.error("Process control failed", { description: e instanceof MosaicError ? e.message : String(e) }),
  });

  const procs = useMemo(() => Object.values(processes), [processes]);
  const { nodes, edges } = useMemo(() => {
    const onAction = (a: Action, p: AgentProcess) => (a === "kill" ? setConfirm(p) : act.mutate({ action: a, pid: p.pid }));
    const { positions, edges: pairs } = layout(procs);
    const nodes: ProcNode[] = procs.map((p) => ({
      id: String(p.pid),
      type: "proc",
      position: positions[p.pid] ?? { x: 0, y: 0 },
      data: { proc: p, onAction },
      draggable: false,
    }));
    const edges: Edge[] = pairs.map(([a, b]) => {
      const child = processes[b];
      return {
        id: `${a}-${b}`,
        source: String(a),
        target: String(b),
        animated: child?.state === "RUNNING",
        style: { stroke: agentTone(child?.state).hex, strokeWidth: 2, opacity: 0.7 },
      };
    });
    return { nodes, edges };
  }, [procs, processes, act]);

  return (
    <div className="relative h-full min-h-0">
      {procs.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No processes yet.</p>
      ) : (
        <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1.25 }}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          minZoom={0.3}
          style={{ background: "transparent" }}
        >
          <Background gap={24} size={1} color="#1c2733" />
          <FitOnGrowth pids={procs.map((p) => `${p.pid}<${p.ppid ?? ""}`).sort().join(",")} />
        </ReactFlow>
        </ReactFlowProvider>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Kill pid {confirm?.pid} ({confirm?.agent})?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The process and its children are terminated. This is recorded in the audit journal and can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => confirm && act.mutate({ action: "kill", pid: confirm.pid })}
            >
              Kill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
