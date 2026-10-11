"use client";

/**
 * My work · My leave (ADR-058, 058-leave AC-LV6; 058-self-service AC-SS6).
 *
 * The days a person has, where each came from, what they asked for and what
 * was answered, and a form to ask. The balances are the office's own
 * `BalanceDetail`, so a person and HR read one figure, with the same lots and
 * the same ledger under it.
 *
 * ASKING IS NOT TAKING. The server counts the working days in the range,
 * checks them against the balance on the first day, and routes the request to
 * the reporting manager; nothing is taken until the last step approves it.
 * Every rule it refuses on (too few days, a restricted period, a note the type
 * needs, a type only women or men may take) is said in its own words, and this
 * screen repeats none of them: a rule copied here would drift from the one
 * that decides.
 */

import type { LeaveRequest, LeaveType } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField } from "../../components/ui";
import {
  uploadMyNote,
  useAskLeave,
  useCancelMyLeave,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useMyLeaveTypes,
} from "../../data/my-work";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { BalanceDetail, TermsBadges, typeTermsText } from "../staff/leave-ui";
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

export function MyLeave({ employeeId }: { employeeId: string }) {
  const { toast, toastError } = usePms();
  const [asking, setAsking] = useState(false);
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
  const list = [...(requests.data?.requests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = todayIso();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Days are counted on the days you are rostered, or would normally work. Nothing is taken until a request is
          approved.
        </p>
        {!asking && (
          <ActionButton variant="primary" onClick={() => setAsking(true)}>
            Ask for leave
          </ActionButton>
        )}
      </div>

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

      <div className="flex flex-col gap-0">
        <SectionHeading n={list.length}>Your requests</SectionHeading>
        {requests.isPending ? (
          <div className="mt-2.5">
            <Loading rows={2} />
          </div>
        ) : requests.isError ? (
          <LoadFailed className="mt-2.5" onRetry={() => void requests.refetch()} retrying={requests.isFetching}>
            We couldn&apos;t load your requests. Nothing is lost. Try again.
          </LoadFailed>
        ) : list.length === 0 ? (
          <EmptyState className="mt-2.5">You have not asked for leave yet. When you do, the answer shows here.</EmptyState>
        ) : (
          <RowList>
            {list.map((r, index) => (
              <div key={r.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
                <span className="flex min-w-44 flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {r.leaveType.name}
                    <span className="pms-num font-normal text-ink2"> · {daysText(r.days)}</span>
                  </span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    {r.startsOn === r.endsOn ? dshortIso(r.startsOn) : `${dshortIso(r.startsOn)} to ${dshortIso(r.endsOn)}`}
                    {r.startHalf !== "full" ? ", from the afternoon" : ""}
                    {r.endHalf !== "full" ? ", until lunch" : ""}
                    {whoHasIt(r) ? ` · ${whoHasIt(r)}` : ""}
                  </span>
                  {r.decisionNote && <span className="text-2xs text-ink2">“{r.decisionNote}”</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge intent={STATUS_INTENT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  <TermsBadges
                    payment={r.payment}
                    paymentPercent={r.paymentPercent}
                    approvalSteps={r.approvalSteps}
                    currentStep={r.currentStep}
                    waiting={r.status === "requested"}
                  />
                </span>
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

      <div className="flex flex-col gap-2.5">
        <SectionHeading>Your days</SectionHeading>
        {balances.isPending ? (
          <Loading rows={2} />
        ) : balances.isError ? (
          <LoadFailed onRetry={() => void balances.refetch()} retrying={balances.isFetching}>
            We couldn&apos;t load your days. Nothing is lost. Try again.
          </LoadFailed>
        ) : kept.length === 0 ? (
          <EmptyState>No leave has been earned on your file yet. Days are added as you work.</EmptyState>
        ) : (
          kept.map((balance) => (
            <Panel key={balance.leaveType.id} className="px-5 py-4">
              <BalanceDetail balance={balance} />
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}
