import { cn } from "@/lib/utils";
import { agentTone, taskTone, type Tone } from "@/lib/tones";

function Pill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide",
        tone.bg,
        tone.border,
        tone.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}

export const AgentStateBadge = ({ state, className }: { state?: string | null; className?: string }) => (
  <Pill tone={agentTone(state)} label={state ?? "UNKNOWN"} className={className} />
);

export const TaskStatusBadge = ({ status, className }: { status?: string | null; className?: string }) => (
  <Pill tone={taskTone(status)} label={(status ?? "unknown").replaceAll("_", " ")} className={className} />
);

export const PidChip = ({ pid, className }: { pid?: number | null; className?: string }) =>
  pid ? (
    <span className={cn("rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold text-primary", className)}>
      {pid}
    </span>
  ) : (
    <span className={cn("w-9 font-mono text-xs text-muted-foreground", className)}>sys</span>
  );

export function formatTime(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
