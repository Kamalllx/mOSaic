"use client";

import { BellRing } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TaskView } from "@/lib/events";
import { ApprovalCard } from "./approval-card";

/** Opens by itself the first time each approval turns up pending, and via the banner afterwards. */
export function ApprovalDrawer({ view }: { view: TaskView }) {
  const pending = view.pendingApprovalIds.map((id) => view.approvals[id]).filter(Boolean);
  const [seen, setSeen] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const unseen = pending.some((a) => !seen.includes(a.approval_id));
  const open = pending.length > 0 && (manualOpen || unseen);

  const close = () => {
    setSeen((s) => [...new Set([...s, ...pending.map((a) => a.approval_id)])]);
    setManualOpen(false);
  };

  return (
    <>
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="attention flex items-center gap-2 rounded-lg border-2 border-st-waiting bg-st-waiting/15 px-4 py-2 font-semibold text-st-waiting"
        >
          <BellRing className="size-5 animate-bounce" />
          {pending.length === 1 ? "1 approval waiting for you" : `${pending.length} approvals waiting for you`}
        </button>
      )}
      <Sheet open={open} onOpenChange={(o) => (o ? setManualOpen(true) : close())}>
        <SheetContent side="right" style={{ width: 780, maxWidth: "95vw" }} className="overflow-y-auto border-l-2 border-st-waiting/60 sm:max-w-none">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl">
              <BellRing className="size-5 text-st-waiting" /> Approval center
            </SheetTitle>
            <SheetDescription>
              Agent intent is not authorization. Policy sent this syscall to a human: check the evidence, then decide.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {pending.map((a) => (
              <ApprovalCard key={a.approval_id} approval={a} flaggedPaths={view.flaggedPaths} compact />
            ))}
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
