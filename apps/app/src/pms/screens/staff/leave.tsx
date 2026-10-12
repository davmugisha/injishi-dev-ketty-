"use client";

/**
 * Staff · Leave (ADR-058 AC-L1, AC-L4, AC-L5; 058-leave AC-LV13).
 *
 * Five sections, each a route segment under `/staff/leave`: Requests (with
 * the dashboard above the queue), Extra days, Balances, Restricted periods and
 * Leave types. Holidays and weekly days off are 058-time's and live in Time
 * settings, so the row links there rather than keeping a second copy. A
 * section the grant does not reach is not offered, and typed by URL it says
 * so rather than opening empty.
 *
 * The queue is the shared `DataView` over `LEAVE_REQUEST_LIST`, routed to you
 * first. Approving decides the step a request is at: a two step type waits
 * for a second, different decider, unless nobody else at the branch decides
 * leave, when the server records the second step as skipped. Only the final
 * step counts the days again and checks what the person will have on the
 * first day; the balance is the sum of the ledger and nothing else. Nobody
 * decides their own leave: the server refuses it (403), and the row says so
 * rather than offering a button that will fail.
 */

import { LEAVE_REQUEST_LIST, type LeaveRequest, type LeaveRequestStatus } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { CalendarDays, CalendarOff, CalendarPlus, Hourglass } from "lucide-react";
import { useState, type ComponentType } from "react";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useLeaveDashboard } from "../../data/leave";
import { readListIds, runBulkAction, useListUrl, useSavedViewsFor } from "../../data/lists";
import { openFileLink } from "../../data/people-file";
import {
  useDecideLeave,
  useEmployees,
  useLeaveBalances,
  useLeavePage,
  useRequestLeave,
  type LeaveDecision,
} from "../../data/people";
import { dshortIso, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { HrFileInput } from "./hr-file-input";
import { LeaveAllocations } from "./leave-allocations";
import { LeaveBalancesSection } from "./leave-balances";
import { RestrictedPeriods } from "./leave-restricted";
import { LeaveTypes } from "./leave-types";
import { LEAVE_SECTIONS, LeaveNav, TermsBadges, paymentText, typeTermsText, type LeaveSection } from "./leave-ui";
import { Avatar, FACE, Figure, WITH_FACE } from "./staff-look";
import { Field, FormError, daysText, inputClass } from "./staff-ui";

const STATUS: Record<LeaveRequestStatus, { label: string; intent: "ok" | "warn" | "bad" | "neutral" }> = {
  requested: { label: "Waiting", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
  cancelled: { label: "Cancelled", intent: "neutral" },
};

const SECTION_SCREEN: Record<LeaveSection, ComponentType> = {
  requests: Requests,
  allocations: LeaveAllocations,
  balances: LeaveBalancesSection,
  restricted: RestrictedPeriods,
  types: LeaveTypes,
};

export function Leave({ section = "requests" }: { section?: string }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const permissions = currentGrant(state)?.permissions ?? [];
  const reachable = LEAVE_SECTIONS.filter((s) => s.anyPermission.some((p) => permissions.includes(p)));
  const asked = LEAVE_SECTIONS.find((s) => s.key === section)?.key ?? "requests";
  // `/staff/leave` itself is Requests. Somebody who keeps the files but does not
  // decide leave lands on their first section instead of a refusal at the door.
  const active = asked === "requests" && !reachable.some((s) => s.key === "requests") ? (reachable[0]?.key ?? asked) : asked;
  const allowed = reachable.some((s) => s.key === active);
  const Screen = SECTION_SCREEN[active];

  return (
    <div className="flex flex-col gap-4">
      <LeaveNav base={`${workspaceBase(workspaceId)}/staff`} active={active} sections={reachable} />
      {allowed ? (
        <Screen />
      ) : (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          Your role does not open this part of Leave. An owner can change what your role allows in Team &amp;
          Departments.
        </EmptyState>
      )}
    </div>
  );
}

// --- Requests, with the dashboard above them -------------------------------------------------

function Requests() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const decide = useDecideLeave(workspaceId);
  const [filing, setFiling] = useState(false);
  const branches = currentGrant(state)?.branches ?? [];
  const mayDecide = can("leave.approve");

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, LEAVE_REQUEST_LIST.key);
  const list = useListUrl(LEAVE_REQUEST_LIST, "basic", defaultView);
  const page = useLeavePage(workspaceId, list.state.query);

  const act = (r: LeaveRequest, decision: LeaveDecision) =>
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: (out) =>
          toast(
            decision === "approve"
              ? out.status === "requested"
                ? `Step 1 approved for ${out.employee.displayName}. It waits for a second decider.`
                : `${daysText(out.days)} of ${out.leaveType.name.toLowerCase()} approved for ${out.employee.displayName}`
              : decision === "reject"
                ? `Refused ${out.employee.displayName}'s request`
                : `Cancelled ${out.employee.displayName}'s leave`,
            "ok",
          ),
      },
    );

  // Built each render: every cell reads the decision state of its own row.
  const columns: DataColumn<LeaveRequest>[] = [
    {
      key: "employee",
      header: "Person",
      // The reason is a sentence: it takes a second line before it makes the table scroll.
      wrap: true,
      cell: (r) => (
        <span className={`${WITH_FACE}`} data-leave={r.id}>
          <Avatar name={r.employee.displayName} className={FACE} />
          <span className="font-semibold whitespace-nowrap text-foreground">{r.employee.displayName}</span>
          {r.reason ? <span className="text-2xs text-muted-foreground">{r.reason}</span> : null}
          {r.hasAttachment && workspaceId ? (
            <button
              type="button"
              className="w-fit text-2xs font-semibold text-accent-text underline-offset-2 hover:underline"
              onClick={() => void openFileLink(workspaceId, `/ops/leave/requests/${r.id}/attachment`)}
            >
              Open the note
            </button>
          ) : null}
        </span>
      ),
    },
    {
      key: "leaveType",
      header: "Type",
      wrap: true,
      cell: (r) => <span className="whitespace-nowrap @max-4xl:whitespace-normal">{r.leaveType.name}</span>,
    },
    {
      key: "startsOn",
      header: "From",
      wrap: true,
      // Two dates break between them, never inside one, and only on a narrow page.
      cell: (r) => (
        <span className="pms-num flex gap-x-1 @max-4xl:flex-wrap">
          <span className="whitespace-nowrap">{dshortIso(r.startsOn)}</span>
          {r.endsOn !== r.startsOn ? <span className="whitespace-nowrap">to {dshortIso(r.endsOn)}</span> : null}
        </span>
      ),
    },
    {
      key: "days",
      header: "Days",
      align: "end",
      cell: (r) => (
        <span className="flex flex-col items-end">
          {daysText(r.days)}
          {r.status === "requested" ? <span className="text-2xs text-muted-foreground">estimated</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      wrap: true,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap gap-1.5">
            <Badge intent={STATUS[r.status].intent}>{STATUS[r.status].label}</Badge>
            <TermsBadges
              payment={r.payment}
              paymentPercent={r.paymentPercent}
              approvalSteps={r.approvalSteps}
              currentStep={r.currentStep}
              waiting={r.status === "requested"}
            />
            {r.routedToMe && r.status === "requested" && <Badge intent="info">Routed to you</Badge>}
          </span>
          {r.approvals.length > 0 && (
            <span className="text-2xs text-muted-foreground">
              {r.approvals
                .map((a) =>
                  a.decision === "skipped"
                    ? `Step ${a.step} skipped: nobody else decides here`
                    : `Step ${a.step} ${a.decision === "approved" ? "approved" : "refused"}${a.decidedByName ? ` by ${a.decidedByName}` : ""}`,
                )
                .join(" · ")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      // On a narrow page the two buttons stack before the table scrolls.
      wrap: true,
      cell: (r) => {
        const busy = decide.isPending && decide.variables?.id === r.id;
        if (!mayDecide) return null;
        if (r.status === "requested") {
          return (
            <span className="flex justify-end gap-2 @max-4xl:flex-wrap">
              <ActionButton pending={busy && decide.variables?.decision === "reject"} onClick={() => act(r, "reject")}>
                Refuse
              </ActionButton>
              <ActionButton variant="primary" pending={busy && decide.variables?.decision === "approve"} onClick={() => act(r, "approve")}>
                {r.approvalSteps === 2 ? `Approve step ${r.currentStep}` : "Approve"}
              </ActionButton>
            </span>
          );
        }
        if (r.status === "approved") {
          return (
            <ActionButton pending={busy} onClick={() => act(r, "cancel")}>
              Cancel leave
            </ActionButton>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <Dashboard />

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Days are counted on the days a person is rostered, or, where they are not, on the days that are not the
          branch&apos;s weekly days off. Holidays never count, unless the type counts them, as maternity leave does. A
          request is checked against what the person will have on its first day.
        </span>
        {(can("leave.approve") || can("people.manage")) && !filing && (
          <ActionButton variant="primary" onClick={() => setFiling(true)}>
            File leave for someone
          </ActionButton>
        )}
      </div>

      {filing && <FileLeave onDone={() => setFiling(false)} />}

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Requests</SectionHeading>
        <DataView
          spec={LEAVE_REQUEST_LIST}
          reader="basic"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.id}
          labelOf={(r) => r.employee.displayName}
          groupKeyOf={leaveGroupKey}
          caption="Leave requests"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          bulk={
            mayDecide && workspaceId
              ? {
                  actions: [
                    { key: "approve", label: "Approve" },
                    { key: "reject", label: "Refuse", danger: true },
                  ],
                  onSelectAll: () => readListIds(workspaceId, "/ops/leave/requests", list.state.query),
                  onAction: async (key, ids) => {
                    const answer = await runBulkAction(workspaceId, "/ops/leave/requests", key, ids);
                    void page.refetch();
                    return answer;
                  },
                }
              : undefined
          }
          savedViews={savedViews}
          empty={{ title: "No leave here yet", body: "Requests filed for anyone at your branches appear here." }}
        />
        <FormError error={decide.error} />
      </section>
    </div>
  );
}

/** Who is off today, who starts this week, and what waits for a decision (AC-LV13). */
function Dashboard() {
  const workspaceId = useWorkspaceId();
  const dash = useLeaveDashboard(workspaceId);
  if (!dash.data) return null;
  const d = dash.data;
  const names = (rows: typeof d.onLeaveToday) =>
    rows.map((r) => `${r.employee.displayName} (${r.leaveTypeName.toLowerCase()}, to ${dshortIso(r.endsOn)})`).join(", ");
  return (
    <section aria-label="Leave at a glance" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure icon={CalendarOff} n={String(d.onLeaveToday.length)} label="On leave today" tone={d.onLeaveToday.length > 0 ? "info" : "neutral"} />
        <Figure icon={CalendarDays} n={String(d.startingThisWeek.length)} label="Starting this week" />
        <Figure
          icon={Hourglass}
          n={String(d.waiting.requests)}
          label="Waiting for a decision"
          hint={d.waiting.routedToMe ? `${d.waiting.routedToMe} routed to you` : undefined}
          tone={d.waiting.requests > 0 ? "warn" : "neutral"}
        />
        <Figure icon={CalendarPlus} n={String(d.waiting.allocations)} label="Asks for extra days" tone={d.waiting.allocations > 0 ? "warn" : "neutral"} />
      </div>
      {d.onLeaveToday.length > 0 && <p className="text-sm text-ink2">Off today: {names(d.onLeaveToday)}.</p>}
      {d.startingThisWeek.length > 0 && <p className="text-sm text-ink2">Starting this week: {names(d.startingThisWeek)}.</p>}
      {d.waiting.atStepTwo > 0 && (
        <p className="text-sm text-ink2">
          {d.waiting.atStepTwo} request{d.waiting.atStepTwo === 1 ? " waits" : "s wait"} for a second decider.
        </p>
      )}
    </section>
  );
}

/** How the server keys each groupable field of a request. */
function leaveGroupKey(r: LeaveRequest, field: string): string | null {
  switch (field) {
    case "status":
      return r.status;
    case "leaveType":
      return r.leaveType.id;
    case "branch":
      return r.branchId;
    default:
      return null;
  }
}

function FileLeave({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const request = useRequestLeave(workspaceId);
  const [draft, setDraft] = useState({
    employeeId: "",
    leaveTypeId: "",
    startsOn: todayIso(),
    endsOn: todayIso(),
    startHalf: "full",
    endHalf: "full",
    reason: "",
  });
  const [note, setNote] = useState<{ key: string; name: string } | null>(null);
  const balances = useLeaveBalances(workspaceId, draft.employeeId || null);
  const offered = (balances.data?.balances ?? []).filter((b) => b.leaveType.status === "active");
  const chosen = offered.find((b) => b.leaveType.id === draft.leaveTypeId);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!draft.employeeId || !draft.leaveTypeId) return;
        request.mutate(
          {
            employeeId: draft.employeeId,
            leaveTypeId: draft.leaveTypeId,
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
            startHalf: draft.startHalf as "full" | "second_half",
            endHalf: draft.endHalf as "full" | "first_half",
            reason: draft.reason.trim() || null,
            attachmentKey: note?.key ?? null,
          },
          {
            onSuccess: (r) => {
              toast(
                r.status === "approved"
                  ? `${daysText(r.days)} of ${r.leaveType.name.toLowerCase()} approved for ${r.employee.displayName}: this type needs no approval`
                  : `${daysText(r.days)} of leave requested for ${r.employee.displayName}`,
                "ok",
              );
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>File leave</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Person">
          <SelectField
            label="Person"
            value={draft.employeeId}
            onChange={(v) => setDraft({ ...draft, employeeId: v, leaveTypeId: "" })}
            placeholder="Choose someone"
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
          />
        </Field>
        <Field
          label="Type"
          hint={
            chosen
              ? `${typeTermsText(chosen.leaveType)}. ${
                  chosen.balanceDays === null ? "No balance is kept." : `${daysText(chosen.balanceDays)} left today.`
                }`
              : balances.isError
                ? "Leave cannot be counted until the leave rules are set up."
                : undefined
          }
        >
          <SelectField
            label="Leave type"
            value={draft.leaveTypeId}
            onChange={(v) => setDraft({ ...draft, leaveTypeId: v })}
            placeholder={draft.employeeId ? (balances.isPending ? "Reading their balances" : "Choose a type") : "Choose a person first"}
            disabled={!draft.employeeId || balances.isPending}
            options={offered.map((b) => ({ value: b.leaveType.id, label: `${b.leaveType.name} (${paymentText(b.leaveType).toLowerCase()})` }))}
          />
        </Field>
        <Field label="From" htmlFor="leave-from">
          <Input
            id="leave-from"
            required
            type="date"
            value={draft.startsOn}
            onChange={(e) => setDraft({ ...draft, startsOn: e.target.value, endsOn: draft.endsOn < e.target.value ? e.target.value : draft.endsOn })}
            className={inputClass}
          />
        </Field>
        <Field label="To" htmlFor="leave-to">
          <Input id="leave-to" required type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} className={inputClass} />
        </Field>
        <Field label="First day">
          <SelectField
            label="First day"
            value={draft.startHalf}
            onChange={(v) => setDraft({ ...draft, startHalf: v })}
            options={[
              { value: "full", label: "Whole day" },
              { value: "second_half", label: "Afternoon only" },
            ]}
          />
        </Field>
        <Field label="Last day">
          <SelectField
            label="Last day"
            value={draft.endHalf}
            onChange={(v) => setDraft({ ...draft, endHalf: v })}
            options={[
              { value: "full", label: "Whole day" },
              { value: "first_half", label: "Morning only" },
            ]}
          />
        </Field>
        <Field label="Reason" hint="Optional." htmlFor="leave-reason">
          <Input id="leave-reason" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Note" hint={chosen?.leaveType.needsAttachment ? "This type needs one, such as a doctor's note." : "Optional: a PDF or a photo."}>
          <span className="flex flex-wrap items-center gap-2">
            <HrFileInput
              workspaceId={workspaceId}
              purpose="attachment"
              label={note ? "Replace the note" : "Attach a note"}
              onUploaded={(up, name) => setNote({ key: up.objectKey, name })}
            />
            {note && <span className="text-2xs text-muted-foreground">{note.name}</span>}
          </span>
        </Field>
      </div>
      <FormError error={request.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={request.isPending}>
          {request.isPending ? "Filing" : "File leave"}
        </ActionButton>
      </div>
    </form>
  );
}
