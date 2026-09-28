// One state→colour map for the whole console (brief §7). Colours are the --color-st-* tokens in globals.css.
import type { AgentState, TaskStatus } from "@mosaic/contracts";

export interface Tone {
  text: string;
  bg: string;
  border: string;
  dot: string;
  hex: string;
}

// Literal class names so Tailwind's scanner sees them.
export const TONES = {
  running: { text: "text-st-running", bg: "bg-st-running/15", border: "border-st-running/50", dot: "bg-st-running", hex: "#3fb950" },
  waiting: { text: "text-st-waiting", bg: "bg-st-waiting/15", border: "border-st-waiting/50", dot: "bg-st-waiting", hex: "#e3b341" },
  failed: { text: "text-st-failed", bg: "bg-st-failed/15", border: "border-st-failed/50", dot: "bg-st-failed", hex: "#f85149" },
  completed: { text: "text-st-completed", bg: "bg-st-completed/15", border: "border-st-completed/50", dot: "bg-st-completed", hex: "#8b949e" },
  paused: { text: "text-st-paused", bg: "bg-st-paused/15", border: "border-st-paused/50", dot: "bg-st-paused", hex: "#58a6ff" },
  checkpoint: { text: "text-st-checkpoint", bg: "bg-st-checkpoint/15", border: "border-st-checkpoint/50", dot: "bg-st-checkpoint", hex: "#bc8cff" },
  retrying: { text: "text-st-retrying", bg: "bg-st-retrying/15", border: "border-st-retrying/50", dot: "bg-st-retrying", hex: "#f0883e" },
  terminated: { text: "text-st-terminated", bg: "bg-st-terminated/15", border: "border-st-terminated/50", dot: "bg-st-terminated", hex: "#da3633" },
  idle: { text: "text-st-idle", bg: "bg-st-idle/15", border: "border-st-idle/50", dot: "bg-st-idle", hex: "#6e7681" },
} satisfies Record<string, Tone>;

export const AGENT_STATE_TONE: Record<AgentState, Tone> = {
  CREATED: TONES.idle,
  INITIALIZING: TONES.idle,
  READY: TONES.idle,
  RUNNING: TONES.running,
  WAITING: TONES.waiting,
  PAUSED: TONES.paused,
  CHECKPOINTING: TONES.checkpoint,
  FAILED: TONES.failed,
  RETRYING: TONES.retrying,
  COMPLETED: TONES.completed,
  TERMINATED: TONES.terminated,
};

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  queued: TONES.idle,
  planning: TONES.running,
  running: TONES.running,
  waiting_approval: TONES.waiting,
  paused: TONES.paused,
  completed: TONES.completed,
  failed: TONES.failed,
  cancelled: TONES.terminated,
};

export const agentTone = (s?: string | null): Tone => AGENT_STATE_TONE[(s ?? "") as AgentState] ?? TONES.idle;
export const taskTone = (s?: string | null): Tone => TASK_STATUS_TONE[(s ?? "") as TaskStatus] ?? TONES.idle;
