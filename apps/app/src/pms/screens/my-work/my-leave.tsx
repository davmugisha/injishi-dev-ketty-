"use client";

/**
 * My work · My leave (ADR-058, 058-leave AC-LV6; 058-self-service AC-SS6).
 *
 * The days a person has left, what they asked for and what was answered, and
 * a form to ask.
 *
 * THREE THINGS, IN THAT ORDER. This opened on the office's own view of a
 * balance: every lot ("1.5 days earned 01 Feb, usable to 31 Dec", ten of them
 * for one kind of leave), the type's rules in a line, and a ledger. All true,
 * and none of it what somebody opens My leave for. It is a tile a kind now:
 * the days left, large, against the year's. Then the requests, each with its
 * answer. Where every day came from is still here, the office's own
 * `BalanceDetail` so the two can never disagree, behind one link at the foot.
 *
 * ASKING IS NOT TAKING. The server counts the working days in the range,
 * checks them against the balance on the first day, and routes the request to
 * the reporting manager; nothing is taken until the last step approves it.
 * Every rule it refuses on (too few days, a restricted period, a note the type
 * needs, a type only women or men may take) is said in its own words, and this
 * screen repeats none of them: a rule copied here would drift from the one
 * that decides.
 */

import type { LeaveBalance, LeaveRequest, LeaveType } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField } from "../../components/ui";
import {
  uploadMyNote,
  useAskExtraDays,
  useAskLeave,
  useCancelMyAllocation,
  useCancelMyLeave,
  useMyAllocations,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useMyLeaveTypes,
} from "../../data/my-work";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { BalanceDetail, paymentText, typeTermsText } from "../staff/leave-ui";
import { Field, FormError, RowList, daysText, inputClass, rowClass } from "../staff/staff-ui";
import { Loading, Panel } from "./my-work-ui";

const STATUS_INTENT: Record<LeaveRequest["status"], "info" | "ok" | "bad" | "neutral"> = {
  requested: "info",
  approved: "ok",
  rejected: "bad",
  cancelled: "neutral",
};
const STATUS_LABEL: Record<LeaveRequest["status"], string> = {
  requested: "Waiting",
  approved: "Approved",
  rejected: "Refused",
  cancelled: "Cancelled",
};

interface Draft {
  leaveTypeId: string;
  startsOn: string;
  endsOn: string;
  /** Start after lunch on the first day. */
  fromAfternoon: boolean;
  /** End at lunch on the last day. */
  untilLunch: boolean;
  reason: string;
  note: File | null;
}

function emptyDraft(): Draft {
  const day = addDaysIso(todayIso(), 7);
  return { leaveTypeId: "", startsOn: day, endsOn: day, fromAfternoon: false, untilLunch: false, reason: "", note: null };
}

/** Who has the request now, in a few words. */
function whoHasIt(r: LeaveRequest): string {
  if (r.status !== "requested") return "";
  const step = r.approvalSteps === 2 ? `step ${r.currentStep} of 2` : null;
  const who = r.routedToName ? `with ${r.routedToName}` : "with whoever decides leave";
  return [who, step].filter(Boolean).join(", ");
}

function AskForm({ employeeId, types, onDone }: { employeeId: string; types: readonly LeaveType[]; onDone: () => void }) {
  const { toast } = usePms();
  const ask = useAskLeave(employeeId);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const type = types.find((t) => t.id === draft.leaveTypeId) ?? null;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function send() {
    if (!type || ask.isPending || uploading) return;
    setUploadError(null);
    let attachmentKey: string | null = null;
    if (draft.note) {
      setUploading(true);
      try {
        attachmentKey = (await uploadMyNote(employeeId, draft.note)).key;
      } catch (error) {
        setUploadError(error);
        return;
      } finally {
        setUploading(false);
      }
    }
    ask.mutate(
      {
        leaveTypeId: type.id,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        startHalf: draft.fromAfternoon ? "second_half" : "full",
        endHalf: draft.untilLunch ? "first_half" : "full",
        reason: draft.reason.trim() || null,
        attachmentKey,
      },
      {
        onSuccess: (request) => {
          toast(
            request.status === "approved"
              ? `${request.leaveType.name}: ${daysText(request.days)}, approved.`
              : `Sent: ${daysText(request.days)} of ${request.leaveType.name.toLowerCase()}. You will see the answer here.`,
            "ok",
          );
          onDone();
        },
      },
    );
  }

  return (
    <Panel className="flex flex-col gap-3.5 px-5 py-4">
      <SectionHeading>Ask for leave</SectionHeading>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
        <Field label="Kind of leave" hint={type ? typeTermsText(type) : undefined}>
          <SelectField
            label="Kind of leave"
            value={draft.leaveTypeId}
            onChange={(leaveTypeId) => set({ leaveTypeId })}
            placeholder="Choose one"
            options={types.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="First day" htmlFor="leave-from">
          <Input
            id="leave-from"
            type="date"
            value={draft.startsOn}
            onChange={(ev) => set({ startsOn: ev.target.value, endsOn: draft.endsOn < ev.target.value ? ev.target.value : draft.endsOn })}
            className={inputClass}
          />
        </Field>
        <Field label="Last day" htmlFor="leave-to">
          <Input
            id="leave-to"
            type="date"
            min={draft.startsOn}
            value={draft.endsOn}
            onChange={(ev) => set({ endsOn: ev.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox
          isSelected={draft.fromAfternoon}
          onChange={(on: boolean) => set({ fromAfternoon: on })}
          className="flex items-center gap-2.5 text-sm font-normal text-ink2"
        >
          I work the morning of the first day
        </Checkbox>
        <Checkbox
          isSelected={draft.untilLunch}
          onChange={(on: boolean) => set({ untilLunch: on })}
          className="flex items-center gap-2.5 text-sm font-normal text-ink2"
        >
          I am back for the afternoon of the last day
        </Checkbox>
      </div>
      <Field label="Reason" htmlFor="leave-why" hint="Your manager reads this. Leave it empty if you would rather say it in person.">
        <Input
          id="leave-why"
          value={draft.reason}
          maxLength={300}
          onChange={(ev) => set({ reason: ev.target.value })}
          className={inputClass}
        />
      </Field>
      {type?.needsAttachment && (
        <Field label="The note" htmlFor="leave-note" hint="A photo or a PDF of the doctor's note, 10 MB at most. Only whoever decides leave can open it.">
          <input
            id="leave-note"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(ev) => set({ note: ev.target.files?.[0] ?? null })}
            className="text-sm text-ink2"
          />
        </Field>
      )}
      <FormError error={uploadError ?? ask.error} />
      <div className="flex gap-2.5">
        <ActionButton
          variant="primary"
          pending={ask.isPending || uploading}
          deniedReason={type ? undefined : "Choose the kind of leave first."}
          onClick={() => void send()}
        >
          {uploading ? "Sending the note" : "Send the request"}
        </ActionButton>
        <ActionButton onClick={onDone}>Cancel</ActionButton>
      </div>
    </Panel>
  );
}

/**
 * Ask for days on top of what a kind of leave gives: a wedding that needs two
 * more, a course. The office decides; nothing is added until it does.
 */
function ExtraDaysForm({ employeeId, types, onDone }: { employeeId: string; types: readonly LeaveType[]; onDone: () => void }) {
  const { toast } = usePms();
  const ask = useAskExtraDays(employeeId);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const n = Number(days);
  const missing = !leaveTypeId
    ? "Choose the kind of leave first."
    : !(n > 0) || Math.round(n * 2) !== n * 2
      ? "Days are whole or half: 1, 1.5, 2."
      : reason.trim().length < 3
        ? "Say why you need them."
        : undefined;
  return (
    <Panel className="flex flex-col gap-3.5 px-5 py-4">
      <SectionHeading>Ask for extra days</SectionHeading>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
        <Field label="On which leave">
          <SelectField label="On which leave" value={leaveTypeId} onChange={setLeaveTypeId} placeholder="Choose one" options={types.map((t) => ({ value: t.id, label: t.name }))} />
        </Field>
        <Field label="How many days" htmlFor="extra-days">
          <Input id="extra-days" type="number" min={0.5} step={0.5} value={days} onChange={(ev) => setDays(ev.target.value)} className={`${inputClass} pms-num`} />
        </Field>
        <Field label="Why" htmlFor="extra-why">
          <Input id="extra-why" maxLength={300} value={reason} onChange={(ev) => setReason(ev.target.value)} className={inputClass} />
        </Field>
      </div>
      <FormError error={ask.error} />
      <div className="flex gap-2.5">
        <ActionButton
          variant="primary"
          pending={ask.isPending}
          deniedReason={missing}
          onClick={() =>
            ask.mutate(
              { kind: "extra", leaveTypeId, days: n, reason: reason.trim() },
              {
                onSuccess: (r) => {
                  toast(`Sent: ${daysText(r.days)} more of ${r.leaveType.name.toLowerCase()}. You will see the answer here.`, "ok");
                  onDone();
                },
              },
            )
          }
        >
          Send the request
        </ActionButton>
        <ActionButton onClick={onDone}>Cancel</ActionButton>
      </div>
    </Panel>
  );
}

/** One kind of leave: the days left, large, against what a year gives. */
function DaysTile({ balance }: { balance: LeaveBalance }) {
  const t = balance.leaveType;
  const left = balance.balanceDays ?? 0;
  const yearly = t.yearlyEntitlementDays ?? 0;
  return (
    <Panel className="flex flex-col gap-2 px-5 py-4">
      <span className="text-sm font-semibold text-ink">{t.name}</span>
      <span className="flex items-baseline gap-1.5" data-days-left={t.name}>
        <span className="pms-num text-xl leading-tight font-bold tracking-[-0.3px] text-ink">{Number.isInteger(left) ? left : left.toFixed(1)}</span>
        <span className="text-sm text-ink2">{left === 1 ? "day left" : "days left"}</span>
      </span>
      {yearly > 0 && (
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[var(--chart-track)]">
          <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, Math.round((left / yearly) * 100)))}%` }} />
        </span>
      )}
      <span className="text-2xs text-muted-foreground">
        {yearly > 0 ? `of ${daysText(yearly)} a year · ` : ""}
        {paymentText(t)}
      </span>
    </Panel>
  );
}

export function MyLeave({ employeeId }: { employeeId: string }) {
  const { toast, toastError } = usePms();
  const [asking, setAsking] = useState(false);
  const [showingWhere, setShowingWhere] = useState(false);
  const [askingMore, setAskingMore] = useState(false);
  const allocations = useMyAllocations(employeeId);
  const cancelMore = useCancelMyAllocation(employeeId);
  const more = [...(allocations.data?.requests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const balances = useMyLeaveBalances(employeeId);
  const requests = useMyLeaveRequests(employeeId);
  // The kinds this person may ask for today: the server leaves out a type for
  // the other sex, one that needs more service than they have, and a once only
  // type already taken.
  const types = useMyLeaveTypes(employeeId);
  const cancel = useCancelMyLeave(employeeId);

  // A balance is shown for a kind they may take, or have taken: paternity
  // leave's four days are not a woman's days, though the ledger keeps the row.
  const open = types.data ? new Set(types.data.types.map((t) => t.id)) : null;
  const kept = (balances.data?.balances ?? []).filter(
    (b) =>
      (b.balanceDays !== null || b.entries.length > 0) &&
      (open === null || open.has(b.leaveType.id) || b.entries.some((e) => e.kind === "taken")),
  );
  // A tile is for days there are, or a kind a year gives days of: time in lieu at nought is not one.
  const tiles = kept.filter((b) => b.balanceDays !== null && (b.balanceDays > 0 || (b.leaveType.yearlyEntitlementDays ?? 0) > 0));
  const list = [...(requests.data?.requests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = todayIso();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Your days off, and what you have asked for. Nothing is taken until a request is approved.</p>
        {!asking && !askingMore && (
          <>
            <ActionButton onClick={() => setAskingMore(true)}>Ask for extra days</ActionButton>
            <ActionButton variant="primary" onClick={() => setAsking(true)}>
              Ask for leave
            </ActionButton>
          </>
        )}
      </div>

      {askingMore && (
        <ExtraDaysForm
          employeeId={employeeId}
          // Days are added to a kind that keeps a count: unpaid leave has none to add to.
          types={(types.data?.types ?? []).filter((t) => t.status === "active" && t.yearlyEntitlementDays !== null && !t.compensatory)}
          onDone={() => setAskingMore(false)}
        />
      )}

      {asking &&
        (types.isPending ? (
          <Loading rows={1} />
        ) : types.isError ? (
          <LoadFailed onRetry={() => void types.refetch()} retrying={types.isFetching}>
            We couldn&apos;t load the kinds of leave. Try again.
          </LoadFailed>
        ) : (
          <AskForm
            employeeId={employeeId}
            types={types.data.types.filter((t) => t.status === "active")}
            onDone={() => setAsking(false)}
          />
        ))}

      <div className="flex flex-col gap-2.5">
        <SectionHeading>Days you have left</SectionHeading>
        {balances.isPending ? (
          <Loading rows={1} />
        ) : balances.isError ? (
          <LoadFailed onRetry={() => void balances.refetch()} retrying={balances.isFetching}>
            We couldn&apos;t load your days. Nothing is lost. Try again.
          </LoadFailed>
        ) : tiles.length === 0 ? (
          <EmptyState>No leave has been earned on your file yet. Days are added as you work.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @3xl:grid-cols-4">
            {tiles.map((balance) => (
              <DaysTile key={balance.leaveType.id} balance={balance} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0">
        <SectionHeading n={list.length + more.length}>What you asked for</SectionHeading>
        {requests.isPending ? (
          <div className="mt-2.5">
            <Loading rows={2} />
          </div>
        ) : requests.isError ? (
          <LoadFailed className="mt-2.5" onRetry={() => void requests.refetch()} retrying={requests.isFetching}>
            We couldn&apos;t load your requests. Nothing is lost. Try again.
          </LoadFailed>
        ) : list.length + more.length === 0 ? (
          <EmptyState className="mt-2.5">You have not asked for leave yet. When you do, the answer shows here.</EmptyState>
        ) : (
          <RowList>
            {more.map((a, index) => (
              <div key={a.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`} data-my-extra={a.id}>
                <span className="flex min-w-44 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    {daysText(a.days)} more of {a.leaveType.name.toLowerCase()}
                  </span>
                  <span className="text-2xs text-muted-foreground">{a.reason}</span>
                  {a.decisionNote && <span className="text-2xs text-ink2">“{a.decisionNote}”</span>}
                </span>
                <Badge intent={STATUS_INTENT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                {a.status === "requested" && (
                  <ActionButton
                    pending={cancelMore.isPending && cancelMore.variables?.id === a.id}
                    onClick={() => cancelMore.mutate({ id: a.id }, { onError: toastError })}
                  >
                    Cancel
                  </ActionButton>
                )}
              </div>
            ))}
            {list.map((r, index) => (
              <div key={r.id} className={`${rowClass(index + more.length)} flex flex-wrap items-center gap-x-4 gap-y-1.5`} data-my-request={r.id}>
                <span className="flex min-w-44 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    {r.leaveType.name}, {daysText(r.days)}
                  </span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    {r.startsOn === r.endsOn ? dshortIso(r.startsOn) : `${dshortIso(r.startsOn)} to ${dshortIso(r.endsOn)}`}
                    {r.startHalf !== "full" ? ", from the afternoon" : ""}
                    {r.endHalf !== "full" ? ", until lunch" : ""}
                    {whoHasIt(r) ? ` · ${whoHasIt(r)}` : ""}
                  </span>
                  {r.decisionNote && <span className="text-2xs text-ink2">“{r.decisionNote}”</span>}
                </span>
                <Badge intent={STATUS_INTENT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                {/* Waiting, or approved and not begun: the two a person can still take back. */}
                {(r.status === "requested" || (r.status === "approved" && r.startsOn > today)) && (
                  <ActionButton
                    pending={cancel.isPending && cancel.variables?.id === r.id}
                    onClick={() =>
                      cancel.mutate(
                        { id: r.id },
                        { onSuccess: () => toast("Cancelled. The days are yours again.", "ok"), onError: toastError },
                      )
                    }
                  >
                    Cancel
                  </ActionButton>
                )}
              </div>
            ))}
          </RowList>
        )}
      </div>

      {kept.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            aria-expanded={showingWhere}
            onClick={() => setShowingWhere((v) => !v)}
            className="self-start text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
          >
            {showingWhere ? "Hide where each day came from" : "See where each day came from"}
          </button>
          {showingWhere &&
            kept.map((balance) => (
              <Panel key={balance.leaveType.id} className="px-5 py-4">
                <BalanceDetail balance={balance} />
              </Panel>
            ))}
        </div>
      )}
    </div>
  );
}
