"use client";

/**
 * Report something broken: which room, what kind of fault, one line.
 *
 * It sends `POST /ops/tickets`, which lands on the maintenance board the
 * manager reads. The form is only offered to a person holding
 * `ticket.advance`, the permission that route checks; a housekeeper holds it.
 *
 * NO PHOTO. The ticket contract has no attachment, so a camera box here would
 * be a control with nothing behind it. It comes back when the ticket does.
 */

import type { MaintenanceCategory, OperatorRoom } from "@injishi/contracts";
import { Button, Textarea } from "@injishi/ui";
import { cn } from "@/lib/utils";

import { FieldLabel } from "../ui";
import { FAULTS, roomName } from "./words";

export interface FaultDraft {
  roomId: string;
  category: MaintenanceCategory | "";
  note: string;
  urgent: boolean;
}

export const EMPTY_FAULT: FaultDraft = { roomId: "", category: "", note: "", urgent: false };

export interface FaultReportProps {
  rooms: readonly OperatorRoom[];
  draft: FaultDraft;
  onChange: (draft: FaultDraft) => void;
  sending: boolean;
  onSend: () => void;
}

export function FaultReport({ rooms, draft, onChange, sending, onSend }: FaultReportProps) {
  const sorted = [...rooms].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }),
  );
  const ready = Boolean(draft.roomId && draft.category);

  return (
    <form
      className="flex flex-col gap-5"
      aria-label="Report a fault"
      onSubmit={(e) => {
        e.preventDefault();
        if (!sending) onSend();
      }}
    >
      <div>
        <h2 className="text-xl font-bold text-ink">Something broken?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send it to maintenance. The manager sees it too.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>1. Which room</FieldLabel>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((r) => {
            const on = draft.roomId === r.id;
            return (
              <Button
                key={r.id}
                type="button"
                variant={on ? "secondary" : "outline"}
                shape="rounded"
                size="lg"
                fullWidth
                aria-pressed={on}
                data-fault-room={r.id}
                onClick={() => onChange({ ...draft, roomId: r.id })}
                className={cn("min-h-12 text-base font-semibold", on && "border-accent-text text-accent-text")}
              >
                {r.label ?? "—"}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <FieldLabel>2. What is wrong</FieldLabel>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {FAULTS.map((f) => {
            const on = draft.category === f.value;
            return (
              <Button
                key={f.value}
                type="button"
                variant={on ? "secondary" : "outline"}
                shape="rounded"
                size="lg"
                fullWidth
                aria-pressed={on}
                data-fault-category={f.value}
                onClick={() => onChange({ ...draft, category: f.value })}
                className={cn("min-h-12 text-sm font-semibold", on && "border-accent-text text-accent-text")}
              >
                {f.label}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <FieldLabel>3. A few words (if you want)</FieldLabel>
        <Textarea
          value={draft.note}
          maxLength={500}
          rows={2}
          name="fault-note"
          placeholder="Example: shower is leaking"
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          className="bg-field text-base"
        />
      </div>

      <Button
        type="button"
        variant={draft.urgent ? "secondary" : "outline"}
        shape="rounded"
        size="lg"
        fullWidth
        aria-pressed={draft.urgent}
        onClick={() => onChange({ ...draft, urgent: !draft.urgent })}
        className={cn("min-h-12 text-base font-semibold", draft.urgent && "border-bad text-bad")}
      >
        {draft.urgent ? "Urgent — guest can't use it" : "Mark as urgent"}
      </Button>

      <Button
        type="button"
        variant="primary"
        shape="rounded"
        size="lg"
        fullWidth
        pending={sending}
        data-fault-send=""
        onClick={() => !sending && onSend()}
        className={cn("min-h-14 text-base font-bold", !ready && "opacity-60")}
      >
        {sending
          ? "Sending"
          : ready
            ? `Send — ${roomName(sorted.find((r) => r.id === draft.roomId)?.label)}`
            : "Pick a room and what is wrong"}
      </Button>
    </form>
  );
}
