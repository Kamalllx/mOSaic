import { cn } from "@/lib/utils";

const PRIVACY: Record<string, string> = {
  public: "border-border text-muted-foreground",
  internal: "border-ev-tool/50 text-ev-tool",
  confidential: "border-st-failed/60 bg-st-failed/10 text-st-failed",
  restricted: "border-st-failed bg-st-failed/20 text-st-failed",
};
const TRUST: Record<string, string> = {
  verified: "border-st-running/60 bg-st-running/10 text-st-running",
  trusted: "border-ev-knowledge/50 text-ev-knowledge",
  unverified: "border-st-waiting/60 text-st-waiting",
  untrusted: "border-st-failed/60 bg-st-failed/10 text-st-failed",
};

export function Chip({ label, value, className }: { label?: string; value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs", className)}>
      {label && <span className="opacity-60">{label}</span>}
      {value}
    </span>
  );
}

export const PrivacyChip = ({ value }: { value?: string | null }) =>
  value ? <Chip label="privacy" value={value} className={PRIVACY[value] ?? PRIVACY.public} /> : null;

export const TrustChip = ({ value }: { value?: string | null }) =>
  value ? <Chip label="trust" value={value} className={TRUST[value] ?? "border-border"} /> : null;
