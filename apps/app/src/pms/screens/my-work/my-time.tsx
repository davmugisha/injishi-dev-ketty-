"use client";

/**
 * My work · My time (ADR-058, 058-time AC-TM6, AC-TM13).
 *
 * A person's own month: what the clock recorded, day by day, and what it came
 * to. The figures are theirs alone; no colleague's are on any route this page
 * calls.
 *
 * Nobody edits their own times. A day that is wrong, or was never recorded, is
 * ASKED for here and decided by a supervisor under Staff, Attendance requests;
 * what was asked and what was answered stay listed under the month.
 */

import type { AttendanceRecord, AttendanceRequest } from "@injishi/contracts";
import { Button, Input } from "@injishi/ui";
import { useState } from "react";

import { Icon } from "../../components/icon";
import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, StatCard } from "../../components/ui";
import { useAskAttendanceFix, useMyAttendance, useMyMonth } from "../../data/my-work";
import { todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, clock, fromLocalInput, hoursText, inputClass, rowClass, toLocalInput } from "../staff/staff-ui";
import { Loading, Panel, dayText, monthEnd, monthText, shiftMonth } from "./my-work-ui";

type Asking = { recordId: string | null; workDate: string; clockInAt: string; clockOutAt: string; reason: string };

const REQUEST_INTENT: Record<AttendanceRequest["status"], "info" | "ok" | "bad" | "neutral"> = {
  requested: "info",
  approved: "ok",
  rejected: "bad",
  cancelled: "neutral",
};
const REQUEST_LABEL: Record<AttendanceRequest["status"], string> = {
  requested: "Waiting",
  approved: "Put right",
  rejected: "Refused",
  cancelled: "Withdrawn",
};

/** How a record came to be, when it was not simply clocked. */
function recordNote(r: AttendanceRecord): string | null {
  if (r.supersedesId) return "corrected by a supervisor";
  if (r.autoClosed) return "you never clocked out, so it was closed for you";
  if (r.source === "supervisor") return "recorded by a supervisor";
  if (r.source === "kiosk") return "at the kiosk";
  return null;
}

export function MyTime({ employeeId }: { employeeId: string }) {
  const { toast } = usePms();
  const current = todayIso().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [asking, setAsking] = useState<Asking | null>(null);

  const attendance = useMyAttendance(employeeId, `${month}-01`, monthEnd(month));
  const summary = useMyMonth(employeeId, month);
  const ask = useAskAttendanceFix(employeeId);

  const s = summary.data?.summary ?? null;
  // A corrected record is history; the one that replaced it is the day.
  const records = (attendance.data?.records ?? [])
    .filter((r) => r.status !== "superseded")
    .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt));
  const requests = attendance.data?.requests ?? [];

  function startAsk(record: AttendanceRecord | null) {
    ask.reset();
    const day = record?.workDate ?? todayIso();
    setAsking({
      recordId: record?.id ?? null,
      workDate: day,
      clockInAt: record ? toLocalInput(record.clockInAt) : `${day}T07:00`,
      clockOutAt: record?.clockOutAt ? toLocalInput(record.clockOutAt) : `${day}T15:00`,
      reason: "",
    });
  }

  function send() {
    if (!asking) return;
    ask.mutate(
      {
        workDate: asking.workDate,
        clockInAt: fromLocalInput(asking.clockInAt),
        clockOutAt: fromLocalInput(asking.clockOutAt),
        recordId: asking.recordId,
        reason: asking.reason,
      },
      {
        onSuccess: () => {
          toast("Sent. A supervisor will decide it.", "ok");
          setAsking(null);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="icon" shape="rounded" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <Icon name="chevron-left" size={16} />
        </Button>
        <h2 className="min-w-36 text-center text-base font-bold text-ink">{monthText(month)}</h2>
        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label="Next month"
          disabled={month >= current}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <Icon name="chevron-right" size={16} />
        </Button>
        <span className="ml-auto">
          {!asking && <ActionButton onClick={() => startAsk(null)}>Ask for a missing day</ActionButton>}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <StatCard n={s ? String(s.daysWorked) : "…"} label="Days worked" />
        <StatCard n={s ? hoursText(s.workedMinutes) : "…"} label={s ? `Worked, of ${hoursText(s.expectedMinutes)} rostered` : "Worked"} />
        <StatCard n={s ? String(s.lateCount) : "…"} label="Late arrivals" />
        <StatCard n={s ? hoursText(s.approvedOvertimeMinutes) : "…"} label="Overtime approved" />
      </div>

      {asking && (
        <Panel className="flex flex-col gap-3.5 px-5 py-4">
          <SectionHeading>{asking.recordId ? `Ask for ${dayText(asking.workDate)} to be put right` : "Ask for a day that was not recorded"}</SectionHeading>
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
            <Field label="Day" htmlFor="fix-day">
              <Input
                id="fix-day"
                type="date"
                max={todayIso()}
                value={asking.workDate}
                disabled={asking.recordId !== null}
                onChange={(ev) => setAsking({ ...asking, workDate: ev.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Came in" htmlFor="fix-in">
              <Input
                id="fix-in"
                type="datetime-local"
                value={asking.clockInAt}
                onChange={(ev) => setAsking({ ...asking, clockInAt: ev.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Left" htmlFor="fix-out">
              <Input
                id="fix-out"
                type="datetime-local"
                value={asking.clockOutAt}
                onChange={(ev) => setAsking({ ...asking, clockOutAt: ev.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="What happened" htmlFor="fix-why" hint="A supervisor reads this before deciding.">
            <Input
              id="fix-why"
              value={asking.reason}
              placeholder="I forgot to clock out after the evening shift"
              onChange={(ev) => setAsking({ ...asking, reason: ev.target.value })}
              className={inputClass}
            />
          </Field>
          <FormError error={ask.error} />
          <div className="flex gap-2.5">
            <ActionButton variant="primary" pending={ask.isPending} onClick={send}>
              Send to a supervisor
            </ActionButton>
            <ActionButton onClick={() => setAsking(null)}>Cancel</ActionButton>
          </div>
        </Panel>
      )}

      <div className="flex flex-col gap-0">
        <SectionHeading n={records.length}>Day by day</SectionHeading>
        {attendance.isPending ? (
          <div className="mt-2.5">
            <Loading />
          </div>
        ) : attendance.isError ? (
          <LoadFailed className="mt-2.5" onRetry={() => void attendance.refetch()} retrying={attendance.isFetching}>
            We couldn&apos;t load your days. Nothing is lost. Try again.
          </LoadFailed>
        ) : records.length === 0 ? (
          <EmptyState className="mt-2.5">
            Nothing was recorded for you in {monthText(month)}. If you worked, ask for the missing day and a supervisor
            will add it.
          </EmptyState>
        ) : (
          <RowList>
            {records.map((r, index) => {
              const note = recordNote(r);
              return (
                <div key={r.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
                  <span className="pms-num w-24 shrink-0 text-sm font-semibold text-ink">{dayText(r.workDate)}</span>
                  <span className="flex min-w-40 flex-1 flex-col">
                    <span className="pms-num text-sm text-ink">
                      {clock(r.clockInAt)} to {r.clockOutAt ? clock(r.clockOutAt) : "now"}
                      {r.figures ? <span className="text-ink2"> · {hoursText(r.figures.workedMinutes)}</span> : null}
                    </span>
                    {note && <span className="text-2xs text-muted-foreground">{note}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.status === "open" && <Badge intent="ok">At work</Badge>}
                    {(r.figures?.lateMinutes ?? 0) > 0 && <Badge intent="warn">Late {r.figures?.lateMinutes} min</Badge>}
                    {(r.figures?.earlyMinutes ?? 0) > 0 && <Badge intent="neutral">Left {r.figures?.earlyMinutes} min early</Badge>}
                    {(r.figures?.overtimeMinutes ?? 0) > 0 && (
                      <Badge intent="info">
                        Overtime {r.figures?.overtimeMinutes} min
                        {r.figures?.approvedOvertimeMinutes === null ? ", to decide" : `, ${r.figures?.approvedOvertimeMinutes} approved`}
                      </Badge>
                    )}
                    {!r.validated && r.status !== "open" && <Badge intent="warn">Waiting for a supervisor</Badge>}
                  </span>
                  {r.status === "closed" && asking?.recordId !== r.id && (
                    <ActionButton onClick={() => startAsk(r)}>Not right?</ActionButton>
                  )}
                </div>
              );
            })}
          </RowList>
        )}
      </div>

      {requests.length > 0 && (
        <div className="flex flex-col gap-0">
          <SectionHeading n={requests.length}>What you asked to be put right</SectionHeading>
          <RowList>
            {requests.map((q, index) => (
              <div key={q.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`}>
                <span className="pms-num w-24 shrink-0 text-sm font-semibold text-ink">{dayText(q.workDate)}</span>
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="pms-num text-sm text-ink">
                    {clock(q.clockInAt)} to {clock(q.clockOutAt)}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {q.reason}
                    {q.decisionNote ? ` · ${q.decidedByName ?? "A supervisor"}: ${q.decisionNote}` : ""}
                  </span>
                </span>
                <Badge intent={REQUEST_INTENT[q.status]}>{REQUEST_LABEL[q.status]}</Badge>
              </div>
            ))}
          </RowList>
        </div>
      )}
    </div>
  );
}
