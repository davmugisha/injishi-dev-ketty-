"use client";

/**
 * My work · Today · asking for another shift (ADR-058, 058-time AC-TM5).
 *
 * Around the two weeks of shifts on Today: a way to ask for a different shift
 * on some days, or to swap those days with a colleague, what the person has
 * asked so far, and any swap a colleague is asking of them.
 *
 * NOTHING HERE MOVES A SHIFT. A change goes to whoever decides it; a swap goes
 * to the colleague first, and only once they have said yes to whoever decides.
 * The roster changes when it is approved, and the page says who it is waiting
 * for at each step.
 *
 * The shifts and colleagues offered are the ones the server will take: the
 * active shifts of the person's branch and the people who work there
 * (`shift-options`), read when the form is opened.
 */

import type { ShiftRequest } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useAnswerMyShift, useAskShift, useMyShiftOptions, useMyShiftRequests } from "../../data/my-work";
import { addDaysIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, Reveal, RowList, inputClass, rowClass } from "../staff/staff-ui";
import { Panel, dayText } from "./my-work-ui";

type Kind = ShiftRequest["kind"];

const KINDS: { key: Kind; label: string; how: string }[] = [
  { key: "change", label: "A different shift", how: "Your manager decides. Your shifts stay as they are until it is approved." },
  { key: "swap", label: "Swap with a colleague", how: "Your colleague says yes first, then your manager decides. Until then nothing changes." },
];

/** The closed requests kept in view: the rest are history the office holds. */
const CLOSED_SHOWN = 3;

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** `Mon 12 Oct`, or `Mon 12 Oct to Wed 14 Oct`. */
function daysOf(q: ShiftRequest): string {
  return q.fromDate === q.toDate ? dayText(q.fromDate) : `${dayText(q.fromDate)} to ${dayText(q.toDate)}`;
}

/** What was asked, in a line. */
function whatOf(q: ShiftRequest): string {
  if (q.kind === "swap") return `Swap with ${q.swapWith?.displayName ?? "a colleague"}`;
  return `${q.shiftTemplate?.name ?? "Another"} shift`;
}

function stateOf(q: ShiftRequest): { label: string; intent: "info" | "ok" | "bad" | "neutral" } {
  switch (q.status) {
    case "awaiting_colleague":
      return { label: `Waiting for ${q.swapWith ? first(q.swapWith.displayName) : "your colleague"}`, intent: "info" };
    case "requested":
      return { label: `Waiting for ${q.routedTo ? first(q.routedTo.displayName) : "a manager"}`, intent: "info" };
    case "approved":
      return { label: "Approved", intent: "ok" };
    case "rejected":
      return { label: "Refused", intent: "bad" };
    default:
      return { label: "Cancelled", intent: "neutral" };
  }
}

function AskForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const { toast } = usePms();
  const options = useMyShiftOptions(employeeId);
  const ask = useAskShift(employeeId);
  const tomorrow = addDaysIso(todayIso(), 1);
  const [kind, setKind] = useState<Kind>("change");
  const [shiftId, setShiftId] = useState("");
  const [colleagueId, setColleagueId] = useState("");
  const [from, setFrom] = useState(tomorrow);
  const [to, setTo] = useState(tomorrow);
  const [reason, setReason] = useState("");

  const shifts = options.data?.shifts ?? [];
  const colleagues = options.data?.colleagues ?? [];
  const colleague = colleagues.find((c) => c.employeeId === colleagueId) ?? null;
  const chosen = kind === "change" ? shiftId : colleagueId;
  const nothingToChoose = options.data !== undefined && (kind === "change" ? shifts.length === 0 : colleagues.length === 0);

  const missing = !chosen
    ? kind === "change"
      ? "Choose the shift you want."
      : "Choose who to swap with."
    : to < from
      ? "The last day is before the first."
      : reason.trim().length < 3
        ? "Say why, in a few words."
        : undefined;

  function send() {
    const range = { from, to, reason: reason.trim() };
    ask.mutate(kind === "change" ? { kind, shiftTemplateId: shiftId, ...range } : { kind, swapEmployeeId: colleagueId, ...range }, {
      onSuccess: () => {
        toast(
          kind === "swap"
            ? `Sent to ${colleague ? first(colleague.displayName) : "your colleague"}. A manager decides once they say yes.`
            : "Sent. Your shifts stay as they are until it is approved.",
          "ok",
        );
        onDone();
      },
    });
  }

  return (
    <Reveal>
      <Panel className="flex flex-col gap-3.5 px-5 py-4">
        <SectionHeading>Ask to change a shift</SectionHeading>
        <div role="radiogroup" aria-label="What you are asking for" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const on = k.key === kind;
            return (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={on}
                data-shift-kind={k.key}
                onClick={() => {
                  setKind(k.key);
                  ask.reset();
                }}
                className={cn(
                  "min-h-9 rounded-full border px-3.5 text-sm font-semibold",
                  on ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2 hover:bg-hover",
                )}
              >
                {k.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">{KINDS.find((k) => k.key === kind)?.how}</p>

        {options.isError ? (
          <FormError error={options.error} />
        ) : nothingToChoose ? (
          <p className="text-sm text-ink2">
            {kind === "change"
              ? "No shifts are set up for the branch you work at yet, so there is nothing to ask for. The office adds them under Staff, Schedule."
              : "Nobody else is on the staff list of your branch, so there is nobody to swap with."}
          </p>
        ) : (
          <>
            {/* The choice on a line of its own: the form sits in half the page beside the clock, and a date needs its width. */}
            {kind === "change" ? (
              <Field label="Which shift you want">
                <SelectField
                  label="Which shift you want"
                  value={shiftId}
                  onChange={setShiftId}
                  placeholder={options.isPending ? "Loading" : "Choose one"}
                  options={shifts.map((s) => ({ value: s.id, label: `${s.name} · ${s.startsAt} to ${s.endsAt}` }))}
                />
              </Field>
            ) : (
              <Field label="Swap with">
                <SelectField
                  label="Swap with"
                  value={colleagueId}
                  onChange={setColleagueId}
                  placeholder={options.isPending ? "Loading" : "Choose a colleague"}
                  options={colleagues.map((c) => ({
                    value: c.employeeId,
                    label: c.jobPositionTitle ? `${c.displayName} · ${c.jobPositionTitle}` : c.displayName,
                  }))}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="shift-ask-from">
                <Input
                  id="shift-ask-from"
                  type="date"
                  min={todayIso()}
                  value={from}
                  onChange={(ev) => {
                    setFrom(ev.target.value);
                    // One day is what most people ask for: the end follows the start until it is set later.
                    if (to < ev.target.value || to === from) setTo(ev.target.value);
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="To" htmlFor="shift-ask-to">
                <Input id="shift-ask-to" type="date" min={from} value={to} onChange={(ev) => setTo(ev.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Why" htmlFor="shift-ask-why" hint="Whoever decides reads this.">
              <Input
                id="shift-ask-why"
                maxLength={500}
                value={reason}
                placeholder="A clinic appointment that morning"
                onChange={(ev) => setReason(ev.target.value)}
                className={inputClass}
              />
            </Field>
          </>
        )}
        <FormError error={ask.error} />
        <div className="flex gap-2.5">
          {!nothingToChoose && !options.isError && (
            <ActionButton variant="primary" pending={ask.isPending} deniedReason={missing} onClick={send}>
              {kind === "swap" && colleague ? `Ask ${first(colleague.displayName)}` : "Send it"}
            </ActionButton>
          )}
          <ActionButton onClick={onDone}>Cancel</ActionButton>
        </div>
      </Panel>
    </Reveal>
  );
}

export function MyShifts({ employeeId, children }: { employeeId: string; children: ReactNode }) {
  const { toast } = usePms();
  const requests = useMyShiftRequests(employeeId);
  const answer = useAnswerMyShift(employeeId);
  const [asking, setAsking] = useState(false);

  const askedOfMe = requests.data?.askedOfMe ?? [];
  const mine = [...(requests.data?.mine ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const isOpen = (q: ShiftRequest) => q.status === "requested" || q.status === "awaiting_colleague";
  const shown = [...mine.filter(isOpen), ...mine.filter((q) => !isOpen(q)).slice(0, CLOSED_SHOWN)];
  const busy = (id: string) => answer.isPending && answer.variables?.id === id;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <SectionHeading action={!asking && <ActionButton onClick={() => setAsking(true)}>Ask to change a shift</ActionButton>}>
        Your shifts
      </SectionHeading>

      {askedOfMe.map((q) => (
        <Panel key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-warn bg-warn-bg px-[18px] py-3">
          <span className="flex min-w-44 flex-1 flex-col gap-0.5" data-swap-asked={q.id}>
            <span className="text-sm font-semibold text-ink">{q.employee.displayName} asks to swap shifts with you</span>
            <span className="pms-num text-sm text-ink2">{daysOf(q)}</span>
            <span className="text-2xs text-ink2">{q.reason}</span>
          </span>
          <ActionButton
            variant="primary"
            pending={busy(q.id) && answer.variables?.answer === "accept"}
            onClick={() =>
              answer.mutate({ id: q.id, answer: "accept" }, { onSuccess: () => toast("You said yes. A manager decides it now.", "ok") })
            }
          >
            Yes, swap
          </ActionButton>
          <ActionButton
            pending={busy(q.id) && answer.variables?.answer === "decline"}
            onClick={() => answer.mutate({ id: q.id, answer: "decline" }, { onSuccess: () => toast("You said no. The swap is off.", "ok") })}
          >
            No
          </ActionButton>
        </Panel>
      ))}

      {asking && <AskForm employeeId={employeeId} onDone={() => setAsking(false)} />}

      {children}

      <FormError error={answer.error} />

      {shown.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-0">
          <SectionHeading n={mine.filter(isOpen).length || undefined}>Changes you asked for</SectionHeading>
          <RowList>
            {shown.map((q, index) => {
              const state = stateOf(q);
              return (
                <div key={q.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`} data-my-shift-ask={q.id}>
                  <span className="flex min-w-40 flex-1 flex-col gap-0.5">
                    <span className="text-sm text-ink">
                      <span className="font-semibold">{whatOf(q)}</span> <span className="pms-num text-ink2">· {daysOf(q)}</span>
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {q.reason}
                      {q.decisionNote ? ` · ${q.decidedByName ?? "A manager"}: ${q.decisionNote}` : ""}
                    </span>
                  </span>
                  <Badge intent={state.intent}>{state.label}</Badge>
                  {isOpen(q) && (
                    <ActionButton
                      pending={busy(q.id)}
                      onClick={() => answer.mutate({ id: q.id, answer: "cancel" }, { onSuccess: () => toast("Taken back. Nothing changes.", "ok") })}
                    >
                      Take it back
                    </ActionButton>
                  )}
                </div>
              );
            })}
          </RowList>
        </div>
      )}
    </div>
  );
}
