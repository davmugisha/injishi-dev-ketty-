"use client";

/**
 * Leave, as HR sees it (HR module, Phase 4).
 *
 * Ordered by what somebody opens this tab to DO. A request waiting for a
 * decision is the job, so it is first and carries the only primary buttons on
 * the page. Everything decided sits under it as history. The rules for each
 * leave type are set once and then left alone, so they come last.
 *
 * ALLOWANCES WORK THEMSELVES OUT. Each leave type has a rule (days a year,
 * more for long service, whether unused days carry over), and a person's
 * allowance follows from it and from the day they started; nobody types
 * eighteen beside every name each January. The row says how each figure was
 * reached. Typing a number still sets one person's allowance by hand, and
 * "Back to automatic" hands it back to the rule.
 *
 * ALLOWANCES ARE PER PERSON. Somebody in two departments has two records; here
 * they are one row, their days added up, because that is how many days the
 * person has. A figure typed by hand goes on their first record and clears the
 * others, so the sum stays what was typed.
 *
 * A type's rules are workspace configuration, not per-request. The server
 * works every allowance out from them each time it is asked, so changing a
 * rule changes everybody's allowance at once, and it enforces the waiting
 * period when a request is made.
 */

import { Checkbox, Input } from "@injishi/ui";
import { CalendarClock, CalendarCheck, CalendarDays, Plus, RotateCcw, Scale } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useCreateLeaveRequest,
  useDecideLeaveRequest,
  useEmployees,
  useLeaveBalances,
  useLeaveRequests,
  useLeaveTypeSettings,
  useResetLeaveBalances,
  useSetLeaveBalance,
  useSetLeaveTypeSettings,
  type AllowanceSource,
  type EmployeeRow,
  type LeaveBalanceRow,
  type LeaveRequestRow,
  type LeaveTypeSettingsRow,
} from "../data/ops";
import { usePms } from "../store";
import {
  Field,
  FormError,
  Person as PersonCell,
  RowList,
  dayCount,
  dayRange,
  daysText,
  figureInputClass,
  inputClass,
  panelClass,
  rowClass,
} from "./hr-ui";

type LeaveType = LeaveTypeSettingsRow["leaveType"];

const LEAVE_TYPES: readonly LeaveType[] = ["annual", "sick", "unpaid", "other"];

const TYPE_LABEL: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
  other: "Other leave",
};

const STATUS = {
  pending: { text: "Waiting", intent: "info" },
  approved: { text: "Approved", intent: "ok" },
  rejected: { text: "Rejected", intent: "neutral" },
} as const;

/** A tick box that saves the moment it moves: there is no Save button on a rule. */
const ruleBoxClass = "flex w-full items-center gap-2.5 text-sm font-normal text-ink";

/** A whole number typed into a rule, or null when the box is left empty. */
function wholeOrNull(text: string, max: number): number | null {
  if (text.trim() === "") return null;
  return Math.min(max, Math.max(0, Math.round(Number(text) || 0)));
}

function RuleCard({
  rule,
  onSave,
}: {
  rule: LeaveTypeSettingsRow;
  onSave: (next: LeaveTypeSettingsRow) => void;
}) {
  const [waitDays, setWaitDays] = useState(String(rule.applicableAfterDays));
  const [yearly, setYearly] = useState(rule.yearlyDays === null ? "" : String(rule.yearlyDays));
  const [every, setEvery] = useState(rule.seniorityEveryYears === null ? "" : String(rule.seniorityEveryYears));
  const [extra, setExtra] = useState(rule.seniorityExtraDays === null ? "" : String(rule.seniorityExtraDays));
  const [cap, setCap] = useState(rule.seniorityCapDays === null ? "" : String(rule.seniorityCapDays));
  const id = (part: string) => `leave-rule-${part}-${rule.leaveType}`;
  const name = TYPE_LABEL[rule.leaveType];
  const allotted = rule.yearlyDays !== null && rule.yearlyDays > 0;

  // Saved as each box is left, like every other part of a rule: only when it changed.
  const saveNumber = (key: "yearlyDays" | "seniorityEveryYears" | "seniorityExtraDays" | "seniorityCapDays", text: string, max: number) => {
    const value = wholeOrNull(text, max);
    if (value !== rule[key]) onSave({ ...rule, [key]: value });
  };

  return (
    <div className={cn(panelClass, "flex flex-col gap-3 p-4")}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-ink">{name}</span>
        <Badge intent={rule.isUnpaid ? "neutral" : "ok"}>{rule.isUnpaid ? "Unpaid" : "Paid"}</Badge>
      </div>

      <Field
        label="Days a year"
        hint={
          allotted
            ? "Everybody's allowance is worked out from this."
            : "Empty or 0: asked for when needed, with no allowance kept."
        }
        htmlFor={id("yearly")}
      >
        <Input
          id={id("yearly")}
          type="number"
          min={0}
          max={366}
          value={yearly}
          onChange={(e) => setYearly(e.target.value)}
          onBlur={() => saveNumber("yearlyDays", yearly, 366)}
          className={inputClass}
        />
      </Field>

      {allotted && (
        <>
          {/* One sentence with its three numbers in place, since that is how the rule is said aloud. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Long service</span>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs text-ink2">
              <Input
                type="number"
                size="sm"
                min={0}
                max={30}
                aria-label={`${name}: days added for long service`}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                onBlur={() => saveNumber("seniorityExtraDays", extra, 30)}
                className="h-8 w-12 rounded border-line2 bg-card px-1 text-center text-sm"
              />
              more every
              <Input
                type="number"
                size="sm"
                min={1}
                max={50}
                aria-label={`${name}: years of service for each addition`}
                value={every}
                onChange={(e) => setEvery(e.target.value)}
                onBlur={() => saveNumber("seniorityEveryYears", every, 50)}
                className="h-8 w-12 rounded border-line2 bg-card px-1 text-center text-sm"
              />
              years, up to
              <Input
                type="number"
                size="sm"
                min={0}
                max={366}
                aria-label={`${name}: the most long service can add`}
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                onBlur={() => saveNumber("seniorityCapDays", cap, 366)}
                className="h-8 w-12 rounded border-line2 bg-card px-1 text-center text-sm"
              />
              more
            </div>
            <span className="text-2xs text-muted-foreground">Leave these empty for no long service days.</span>
          </div>
          <Checkbox
            isSelected={rule.carryForward}
            onChange={(carryForward: boolean) => onSave({ ...rule, carryForward })}
            className={ruleBoxClass}
          >
            Unused days carry over to next year
          </Checkbox>
        </>
      )}

      <Checkbox
        isSelected={!rule.isUnpaid}
        onChange={(paid: boolean) => onSave({ ...rule, isUnpaid: !paid })}
        className={ruleBoxClass}
      >
        Paid while away
      </Checkbox>
      <Field label="Available after" hint="Days of employment before it can be taken." htmlFor={id("wait")}>
        <Input
          id={id("wait")}
          type="number"
          min={0}
          value={waitDays}
          onChange={(e) => setWaitDays(e.target.value)}
          onBlur={() => {
            const days = Math.max(0, Math.round(Number(waitDays) || 0));
            setWaitDays(String(days));
            if (days !== rule.applicableAfterDays) onSave({ ...rule, applicableAfterDays: days });
          }}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/** The leave types somebody is GIVEN days of. Unpaid and other leave are asked for, not allotted. */
const ALLOTTED: readonly LeaveType[] = ["annual", "sick"];

interface Person {
  key: string;
  name: string;
  detail: string;
  /** Their department records. The first holds the allowance. */
  records: string[];
}

/** One person per account; somebody with no account is their own record. */
function peopleOf(employees: readonly EmployeeRow[]): Person[] {
  const people = new Map<string, Person>();
  for (const e of [...employees].sort((a, b) => (a.departmentName ?? "").localeCompare(b.departmentName ?? ""))) {
    const key = e.userId ?? e.departmentMemberId;
    const person = people.get(key);
    if (person) {
      person.records.push(e.departmentMemberId);
      person.detail = `${person.detail} · ${e.departmentName ?? ""}`;
    } else {
      people.set(key, {
        key,
        name: e.name ?? "Unknown",
        detail: [e.jobTitle, e.departmentName].filter(Boolean).join(" · "),
        records: [e.departmentMemberId],
      });
    }
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const SHORT_LABEL: Record<LeaveType, string> = { annual: "Annual", sick: "Sick", unpaid: "Unpaid", other: "Other" };

/** One person's allowance of one leave type, added across their records, and where it came from. */
function totalFor(balances: readonly LeaveBalanceRow[], person: Person, type: LeaveType) {
  const rows = balances.filter((b) => b.leaveType === type && person.records.includes(b.departmentMemberId));
  const source: AllowanceSource = rows.some((b) => b.source === "manual")
    ? "manual"
    : rows.some((b) => b.source === "automatic")
      ? "automatic"
      : "none";
  return {
    allocated: rows.reduce((n, b) => n + b.allocated, 0),
    used: rows.reduce((n, b) => n + b.used, 0),
    source,
    basis: rows.find((b) => b.basis)?.basis ?? null,
  };
}

/**
 * One person's days of one leave type: the allowance, what is used, and under
 * them how the allowance was reached. The box can still be typed in, which
 * sets this one person's allowance by hand.
 */
function AllowanceCell({
  label,
  allocated,
  used,
  source,
  basis,
  saving,
  onSave,
  onReset,
}: {
  label: string;
  allocated: number;
  used: number;
  source: AllowanceSource;
  basis: string | null;
  saving: boolean;
  onSave: (days: number) => void;
  /** Hand a figure set by hand back to the rule. */
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(String(allocated));
  const over = allocated > 0 && used > allocated;
  return (
    <div className="flex w-64 max-w-full flex-col gap-1">
      <label className="flex items-center gap-2 text-2xs text-muted-foreground">
        <span className="w-12 shrink-0">{label}</span>
        <Input
          type="number"
          size="sm"
          min={0}
          aria-label={`${label} days allowed`}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const days = Math.max(0, Math.round(Number(draft) || 0));
            setDraft(String(days));
            if (days !== allocated) onSave(days);
          }}
          className={figureInputClass}
        />
        <span className={cn("pms-num", over ? "font-semibold text-warn" : "text-muted-foreground")}>
          {used} used · {Math.max(allocated - used, 0)} left
        </span>
      </label>
      {source === "manual" ? (
        <span className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
          <Badge intent="neutral">Set by hand</Badge>
          <button
            type="button"
            disabled={saving}
            onClick={onReset}
            className="inline-flex cursor-pointer items-center gap-1 bg-transparent font-semibold text-accent-text underline-offset-2 hover:underline"
          >
            <RotateCcw aria-hidden="true" className="size-3" strokeWidth={2.2} />
            Back to automatic
          </button>
        </span>
      ) : source === "automatic" ? (
        <span className="text-2xs text-muted-foreground">{basis}</span>
      ) : (
        <span className="text-2xs text-faint">No days a year set for this leave</span>
      )}
    </div>
  );
}

/** How many days each person may take this year: worked out from the rules below, or set by hand. */
function Allowances({ employees, rules }: { employees: readonly EmployeeRow[]; rules: readonly LeaveTypeSettingsRow[] }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const year = new Date().getFullYear();
  const balances = useLeaveBalances(workspaceId, year);
  const setOne = useSetLeaveBalance(workspaceId);
  const reset = useResetLeaveBalances(workspaceId);

  const [savingFor, setSavingFor] = useState<string | null>(null);
  // Asked twice before every hand-set figure is dropped at once.
  const [confirmingAll, setConfirmingAll] = useState(false);

  const people = peopleOf(employees);
  const rows = balances.data?.balances ?? [];
  const byHand = rows.filter((b) => b.source === "manual").length;
  // A column for each type that gives days: annual and sick always, and any other
  // the business gave days a year to, or set by hand for somebody.
  const shown = LEAVE_TYPES.filter(
    (t) =>
      ALLOTTED.includes(t) ||
      (rules.find((r) => r.leaveType === t)?.yearlyDays ?? 0) > 0 ||
      rows.some((b) => b.leaveType === t && b.source === "manual"),
  );

  const save = async (person: Person, leaveType: LeaveType, value: number) => {
    setSavingFor(`${person.key}|${leaveType}`);
    try {
      // The whole figure on their first record, nothing on the others: read
      // back, the person's records add up to exactly what was typed.
      for (const [i, departmentMemberId] of person.records.entries()) {
        await setOne.mutateAsync({ departmentMemberId, leaveType, year, allocatedDays: i === 0 ? value : 0 });
      }
      toast(`${person.name}: ${value} days of ${TYPE_LABEL[leaveType].toLowerCase()}, set by hand`, "ok");
    } catch (error) {
      toastError(error);
    } finally {
      setSavingFor(null);
    }
  };

  const backToAutomatic = (person: Person, leaveType: LeaveType) => {
    setSavingFor(`${person.key}|${leaveType}`);
    reset.mutate(
      { year, leaveType, departmentMemberIds: person.records },
      {
        onSuccess: () => toast(`${person.name}: ${TYPE_LABEL[leaveType].toLowerCase()} is worked out again`, "ok"),
        onError: toastError,
        onSettled: () => setSavingFor(null),
      },
    );
  };

  return (
    <section>
      <SectionHeading
        n={people.length}
        icon={CalendarDays}
        action={
          byHand === 0 ? null : confirmingAll ? (
            <span className="flex items-center gap-2">
              <ActionButton
                pending={reset.isPending}
                onClick={() =>
                  reset.mutate(
                    { year },
                    {
                      onSuccess: () => toast("Every allowance is worked out from the rules again", "ok"),
                      onError: toastError,
                      onSettled: () => setConfirmingAll(false),
                    },
                  )
                }
              >
                Yes, work them all out
              </ActionButton>
              <ActionButton onClick={() => setConfirmingAll(false)}>Keep them</ActionButton>
            </span>
          ) : (
            <ActionButton icon={RotateCcw} onClick={() => setConfirmingAll(true)}>
              Back to automatic for everyone
            </ActionButton>
          )
        }
      >
        Allowances · {year}
      </SectionHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Each allowance is worked out from the leave rules below and the day the person started. Type a number to set
        one person&apos;s by hand.
        {byHand > 0 ? ` ${byHand} ${byHand === 1 ? "figure is" : "figures are"} set by hand this year.` : ""}
      </p>

      {balances.isPending ? (
        <Skeleton height={60} style={{ marginTop: 10 }} />
      ) : people.length === 0 ? (
        <EmptyState icon={CalendarDays} className="mt-2.5">
          Nobody to give leave to yet.
        </EmptyState>
      ) : (
        <RowList>
          {people.map((person, i) => (
            <div key={person.key} className={cn(rowClass(i), "flex flex-wrap items-start gap-x-4 gap-y-2")}>
              <PersonCell name={person.name} detail={person.detail} className="basis-44 self-center" />
              {shown.map((t) => {
                const total = totalFor(rows, person, t);
                return (
                  <AllowanceCell
                    // Re-seeds the field when the figure changes under it.
                    key={`${t}-${total.allocated}-${total.source}`}
                    label={SHORT_LABEL[t]}
                    allocated={total.allocated}
                    used={total.used}
                    source={total.source}
                    basis={total.basis}
                    saving={savingFor === `${person.key}|${t}`}
                    onSave={(value) => void save(person, t, value)}
                    onReset={() => backToAutomatic(person, t)}
                  />
                );
              })}
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

/** Put a request on file for somebody else: the one form on this tab. */
function AddLeave({ employees, onDone }: { employees: readonly EmployeeRow[]; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const createRequest = useCreateLeaveRequest(workspaceId);
  const [draft, setDraft] = useState({
    departmentMemberId: "",
    leaveType: "annual" as LeaveType,
    startDate: "",
    endDate: "",
    reason: "",
  });

  return (
    <form
      className={cn(panelClass, "mt-2.5 flex flex-col gap-4 p-5")}
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.departmentMemberId) return;
        createRequest.mutate(
          {
            departmentMemberId: draft.departmentMemberId,
            leaveType: draft.leaveType,
            startDate: draft.startDate,
            endDate: draft.endDate,
            reason: draft.reason.trim() || undefined,
          },
          {
            onSuccess: () => {
              toast("Leave request added", "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Add leave for someone</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.departmentMemberId}
            onChange={(v) => setDraft({ ...draft, departmentMemberId: v })}
            placeholder="Choose someone"
            options={employees.map((e) => ({
              value: e.departmentMemberId,
              label: `${e.name ?? "Unknown"}${e.departmentName ? ` · ${e.departmentName}` : ""}`,
            }))}
          />
        </Field>
        <Field label="Type">
          <SelectField
            label="Leave type"
            value={draft.leaveType}
            onChange={(v) => setDraft({ ...draft, leaveType: v as LeaveType })}
            options={LEAVE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
        </Field>
        <Field label="From" htmlFor="leave-add-from">
          <Input
            id="leave-add-from"
            required
            type="date"
            value={draft.startDate}
            onChange={(e) =>
              setDraft({
                ...draft,
                startDate: e.target.value,
                endDate: draft.endDate && draft.endDate < e.target.value ? e.target.value : draft.endDate,
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="To" htmlFor="leave-add-to">
          <Input
            id="leave-add-to"
            required
            type="date"
            min={draft.startDate || undefined}
            value={draft.endDate}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Reason" hint="Optional." htmlFor="leave-add-reason">
            <Input
              id="leave-add-reason"
              maxLength={300}
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      <FormError error={createRequest.error} />
      <div className="flex justify-end gap-2">
        <ActionButton onClick={onDone}>Cancel</ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={createRequest.isPending}
          deniedReason={draft.departmentMemberId ? undefined : "Choose a person first"}
        >
          Add request
        </ActionButton>
      </div>
    </form>
  );
}

export function Leave() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();

  const requests = useLeaveRequests(workspaceId);
  const employees = useEmployees(workspaceId);
  const decide = useDecideLeaveRequest(workspaceId);
  const typeSettings = useLeaveTypeSettings(workspaceId);
  const setTypeSettings = useSetLeaveTypeSettings(workspaceId);
  const balances = useLeaveBalances(workspaceId, new Date().getFullYear());

  const [adding, setAdding] = useState(false);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (requests.isPending || employees.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (requests.isError || employees.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void requests.refetch();
          void employees.refetch();
        }}
        retrying={requests.isFetching || employees.isFetching}
      >
        We couldn&apos;t load leave requests. This is on our side.
      </LoadFailed>
    );
  }

  const requestList = requests.data ?? [];
  const employeeList = employees.data?.employees ?? [];
  const settingsList = typeSettings.data ?? [];
  const waiting = requestList.filter((r) => r.status === "pending");
  const decided = requestList.filter((r) => r.status !== "pending");

  const ruleFor = (type: LeaveType): LeaveTypeSettingsRow =>
    settingsList.find((s) => s.leaveType === type) ?? {
      leaveType: type,
      isUnpaid: type === "unpaid",
      carryForward: false,
      applicableAfterDays: 0,
      maxConsecutiveDays: null,
      yearlyDays: null,
      seniorityEveryYears: null,
      seniorityExtraDays: null,
      seniorityCapDays: null,
    };

  // What approving a request would leave the person with, when they have an
  // allowance of that type: the fact a decision most often turns on.
  const people = peopleOf(employeeList);
  const daysLeft = (r: LeaveRequestRow): number | null => {
    const person = people.find((p) => p.records.includes(r.departmentMemberId));
    if (!person) return null;
    const total = totalFor(balances.data?.balances ?? [], person, r.leaveType);
    return total.allocated > 0 ? total.allocated - total.used : null;
  };

  const answer = (r: LeaveRequestRow, status: "approved" | "rejected") =>
    decide.mutate(
      { requestId: r.id, status },
      {
        onSuccess: () => toast(`${r.name ?? "Request"}: leave ${status}`, "ok"),
        onError: toastError,
      },
    );

  const summary = (r: LeaveRequestRow) => (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-semibold text-ink">{r.name ?? "Unknown"}</span>
      <span className="text-2xs text-muted-foreground">
        {TYPE_LABEL[r.leaveType]} · <span className="pms-num">{dayRange(r)}</span> · {daysText(dayCount(r))}
        {r.reason ? ` · ${r.reason}` : ""}
      </span>
    </span>
  );

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      {/* --- Waiting for a decision --- */}
      <section>
        <SectionHeading
          n={waiting.length}
          icon={CalendarClock}
          action={
            !adding && (
              <ActionButton variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add leave for someone
              </ActionButton>
            )
          }
        >
          Waiting for a decision
        </SectionHeading>

        {adding && <AddLeave employees={employeeList} onDone={() => setAdding(false)} />}

        {waiting.length === 0 ? (
          <EmptyState icon={CalendarCheck} className="mt-2.5">
            Nothing is waiting for you.
          </EmptyState>
        ) : (
          <RowList>
            {waiting.map((r, i) => {
              const left = daysLeft(r);
              const busy = decide.isPending && decide.variables?.requestId === r.id;
              return (
                <div key={r.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                  {summary(r)}
                  {left === null ? null : left >= dayCount(r) ? (
                    <Badge intent="neutral">{daysText(left)} left</Badge>
                  ) : (
                    <Badge intent="warn">Only {daysText(Math.max(left, 0))} left</Badge>
                  )}
                  <span className="flex gap-2">
                    <ActionButton pending={busy && decide.variables?.status === "rejected"} onClick={() => answer(r, "rejected")}>
                      Reject
                    </ActionButton>
                    <ActionButton
                      variant="primary"
                      pending={busy && decide.variables?.status === "approved"}
                      onClick={() => answer(r, "approved")}
                    >
                      Approve
                    </ActionButton>
                  </span>
                </div>
              );
            })}
          </RowList>
        )}
      </section>

      {/* --- Decided --- */}
      {decided.length > 0 && (
        <section>
          <SectionHeading n={decided.length} icon={CalendarCheck}>
            Decided
          </SectionHeading>
          <RowList>
            {decided.map((r, i) => (
              <div key={r.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                {summary(r)}
                <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].text}</Badge>
              </div>
            ))}
          </RowList>
        </section>
      )}

      <Allowances employees={employeeList} rules={LEAVE_TYPES.map(ruleFor)} />

      {/* --- Rules --- */}
      <section>
        <SectionHeading icon={Scale}>Leave rules</SectionHeading>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LEAVE_TYPES.map((type) => {
            const rule = ruleFor(type);
            return (
              <RuleCard
                // Re-seeds the number fields when the saved rule changes under them.
                key={`${type}-${rule.applicableAfterDays}-${rule.yearlyDays}-${rule.seniorityEveryYears}-${rule.seniorityExtraDays}-${rule.seniorityCapDays}`}
                rule={rule}
                onSave={(next) =>
                  setTypeSettings.mutate(
                    {
                      leaveType: next.leaveType,
                      isUnpaid: next.isUnpaid,
                      carryForward: next.carryForward,
                      applicableAfterDays: next.applicableAfterDays,
                      yearlyDays: next.yearlyDays,
                      seniorityEveryYears: next.seniorityEveryYears,
                      seniorityExtraDays: next.seniorityExtraDays,
                      seniorityCapDays: next.seniorityCapDays,
                    },
                    {
                      onSuccess: () => toast(`${TYPE_LABEL[next.leaveType]} rules saved`, "ok"),
                      onError: toastError,
                    },
                  )
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
