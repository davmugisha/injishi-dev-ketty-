"use client";

import {
  Calculator,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleCheckFill,
  CircleInfo,
  FileText,
  Hourglass,
  PaperPlane,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Meter,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { EmptyState, ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type {
  LeaveApprover,
  LeaveBalance,
  LeaveDraft,
  LeaveType,
  RequestStatus,
  Shift,
  StaffProfile,
  StaffRequest,
  SwapColleague,
} from "@injishi/data/fixtures/staff";
import { GateChip, Icon, KeyValueList, PhoneBody, PhoneTop, toneColor } from "@injishi/ui";
import { type ReactNode, useState, useTransition } from "react";
import { reported } from "../operations/shared";
import { askLeaveAction, cancelRequestAction } from "./actions";
import { PhoneSheet, PhoneTitle, renderArticle, renderSection } from "./parts";

export interface StaffScheduleData {
  profile: StaffProfile;
  shifts: Shift[];
  colleagues: SwapColleague[];
  requests: StaffRequest[];
  leaveTypes: LeaveType[];
  balance: LeaveBalance;
  approvers: LeaveApprover[];
  draft: LeaveDraft;
}

type Tab = "shifts" | "leave" | "requests";

const STATUS: Record<
  RequestStatus,
  { chip: string; color: "default" | "warning" | "success" | "danger"; icon: ReactNode; canCancel: boolean }
> = {
  colleague: { chip: "Waiting for colleague", color: "default", icon: <Hourglass />, canCancel: true },
  manager: { chip: "Pending line manager", color: "warning", icon: <Hourglass />, canCancel: true },
  approved: { chip: "Approved", color: "success", icon: <Check />, canCancel: false },
  declined: { chip: "Declined", color: "danger", icon: <Xmark />, canCancel: false },
  cancelled: { chip: "Cancelled", color: "default", icon: <Xmark />, canCancel: false },
};

/** Hours of a "07:00 – 15:00" shift. */
function shiftHours(time: string | null): number {
  const m = time?.match(/(\d{2}):(\d{2})\s*–\s*(\d{2}):(\d{2})/);
  if (!m) return 0;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return (end - start) / 60;
}

const fmtDays = (n: number) => String(Number.isInteger(n) ? n : n.toFixed(1));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A shift's "Mon 12 Oct" as a date in the current year. */
function dayOf(long: string): Date | null {
  const [, d, m] = long.split(" ");
  const month = MONTHS.indexOf(m ?? "");
  return month < 0 ? null : new Date(Date.UTC(new Date().getUTCFullYear(), month, Number(d)));
}

/** "12 – 18 October" (or "29 September – 5 October") for a run of days. */
function spanLabel(from: Date | null, to: Date | null): string {
  if (!from || !to) return "";
  const end = `${to.getUTCDate()} ${MONTH_NAMES[to.getUTCMonth()]}`;
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${from.getUTCDate()} – ${end}`
    : `${from.getUTCDate()} ${MONTH_NAMES[from.getUTCMonth()]} – ${end}`;
}

const NOT_YET_SWAP = "Swaps cannot be asked from the phone yet. Ask Beatrice to arrange it.";

/** "15 Dec 2026" or "Tue 15 Dec 2026", as the leave form shows a date, at noon UTC; null when unreadable. */
function formDay(text: string): Date | null {
  const m = text.trim().match(/(\d{1,2}) ([A-Z][a-z]{2})[a-z]* (\d{4})$/);
  const month = m ? MONTHS.indexOf(m[2] as string) : -1;
  if (!m || month < 0) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]), 12));
}

/** Monday to Friday from one date to another, both counted; null when either is unreadable or they run backwards. */
function weekdaysBetween(from: string, to: string): number | null {
  const a = formDay(from);
  const b = formDay(to);
  if (!a || !b || b < a) return null;
  let n = 0;
  for (let d = a.getTime(); d <= b.getTime(); d += 86_400_000) {
    const day = new Date(d).getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

/** Shifts, leave and requests of a staff member (artifact: StaffSchedule). */
export function StaffScheduleView({ persona, data }: { persona: Persona; data: StaffScheduleData }) {
  const { profile, shifts, colleagues, leaveTypes, balance, approvers, draft } = data;
  const [tab, setTab] = useState<Tab>("shifts");
  const [week, setWeek] = useState(0);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [mate, setMate] = useState(colleagues[0]?.id ?? "");
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.id ?? "annual");
  const [note, setNote] = useState(draft.note);
  const [from, setFrom] = useState(draft.from);
  const [to, setTo] = useState(draft.to);
  const [justSent, setJustSent] = useState("");
  const swapped: Record<string, string> = Object.fromEntries(
    shifts.filter((s) => s.swapPendingWith).map((s) => [s.id, s.swapPendingWith ?? ""]),
  );
  const { requests } = data;
  const [pending, startTransition] = useTransition();

  const open = requests.filter((q) => q.status === "manager" || q.status === "colleague").length;
  const pendingDays = requests.filter((q) => q.status === "manager").reduce((a, q) => a + q.days, 0);
  const type = leaveTypes.find((t) => t.id === leaveType) ?? leaveTypes[0];
  // Counted here from the dates typed; HR counts again on approval (rostered days, public holidays).
  const asked = weekdaysBetween(from, to);
  const left = balance.left - pendingDays - (asked ?? 0);
  const afterText =
    asked === null
      ? "Write both dates as “15 Dec 2026” to see the days."
      : type.usesBalance
        ? `About ${asked} weekdays. If approved, with the ${pendingDays} days already asked for, you have ${fmtDays(left)} days left. HR counts your rostered days and public holidays.`
        : "This does not change your annual leave balance.";

  const weekShifts = shifts.filter((s) => s.week === 0);
  const firstDay = dayOf(weekShifts[0]?.long ?? "");
  const lastDay = dayOf(weekShifts[weekShifts.length - 1]?.long ?? "");
  const plusDays = (d: Date | null, n: number) => (d ? new Date(d.getTime() + n * 86_400_000) : null);
  const weekLabel = week === 0 ? spanLabel(firstDay, lastDay) : spanLabel(plusDays(lastDay, 1), plusDays(lastDay, 7));
  const working = weekShifts.filter((s) => !s.isOff);
  const next = weekShifts.find((s) => !s.isOff && !s.isToday);
  const hours = working.reduce((a, s) => a + shiftHours(s.time), 0);
  const swapShift = shifts.find((s) => s.id === swapFor);
  const mateDoc = colleagues.find((c) => c.id === mate) ?? colleagues[0];

  const pickTab = (t: Tab) => {
    setTab(t);
    setJustSent("");
  };

  const sendSwap = () => {
    setSwapFor(null);
    toast.danger(NOT_YET_SWAP);
  };

  const sendLeave = () => {
    const reason = note.trim().replace(/\.$/, "");
    startTransition(async () => {
      if (!reported(await askLeaveAction({ leaveTypeId: type.id, from, to, reason }))) return;
      setTab("requests");
      setJustSent(
        approvers.length ? `Sent for approval: ${approvers.map((a) => a.name).join(", then ")}.` : "Sent for approval.",
      );
    });
  };

  const cancel = (q: StaffRequest) => {
    setJustSent("");
    startTransition(async () => {
      reported(await cancelRequestAction(q.id));
    });
  };

  return (
    <>
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent">
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <PhoneTitle title="My schedule" sub={`${persona.name} · ${profile.department} · ${profile.site}`} />
      </PhoneTop>

      <div className="shrink-0 px-[16px] pb-[8px]">
        <Segment
          aria-label="Show"
          size="lg"
          selectedKey={tab}
          onSelectionChange={(k) => pickTab(String(k) as Tab)}
          className="w-full"
        >
          <Segment.Item id="shifts" className="h-11 flex-1">
            Shifts
          </Segment.Item>
          <Segment.Item id="leave" className="h-11 flex-1">
            <Segment.Separator />
            Leave
          </Segment.Item>
          <Segment.Item id="requests" className="h-11 flex-1">
            <Segment.Separator />
            {open ? `Requests · ${open}` : "Requests"}
          </Segment.Item>
        </Segment>
      </div>

      <PhoneBody key={tab}>
        {tab === "shifts" ? (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Previous week"
                className="size-11"
                isDisabled={week === 0}
                onPress={() => setWeek(0)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex flex-col items-center">
                <span className="font-semibold">{week === 0 ? "This week" : "Next week"}</span>
                <span className="text-xs text-muted">{weekLabel}</span>
              </div>
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Next week"
                className="size-11"
                isDisabled={week === 1}
                onPress={() => setWeek(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {week === 0 ? (
              <>
                {next ? (
                  <Card render={renderSection} aria-label="Next shift" className="gap-[4px] p-[16px]">
                    <span className="text-xs leading-4 text-muted">Next shift</span>
                    <span className="text-xl leading-[26px] font-semibold">
                      {next.long} · {next.time}
                    </span>
                    <span className="text-[13px] leading-[18px] text-muted">
                      {next.area} · {working.length} shifts this week · {hours} hours
                    </span>
                  </Card>
                ) : null}

                <ListView aria-label="Shifts this week" items={weekShifts} className="shrink-0">
                  {(d) => {
                    const pendingWith = swapped[d.id];
                    const chip = d.isToday
                      ? { label: "Today", color: "accent" as const }
                      : d.isOff
                        ? { label: "Day off", color: "default" as const }
                        : pendingWith
                          ? { label: "Swap pending", color: "warning" as const }
                          : null;
                    const canSwap = !d.isToday && !d.isOff && !pendingWith;
                    return (
                      <ListView.Item
                        id={d.id}
                        textValue={`${d.dow} ${d.date}`}
                        className={`min-h-16 ${d.isToday ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}
                      >
                        <ListView.ItemContent>
                          <span className="flex w-10 shrink-0 flex-col items-center">
                            <span className="text-[11px] leading-[14px] font-semibold text-muted">{d.dow}</span>
                            <span className="text-lg leading-[22px] font-semibold tabular">{d.date}</span>
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title>{d.isOff ? "Off" : d.time}</ListView.Title>
                            <ListView.Description>{d.isOff ? "Rest day" : d.area}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction>
                          {canSwap ? (
                            <Button
                              variant="secondary"
                              className="min-h-11"
                              aria-label={`Swap ${d.long}`}
                              onPress={() => {
                                setSwapFor(d.id);
                                setMate(colleagues[0]?.id ?? "");
                              }}
                            >
                              Swap
                            </Button>
                          ) : null}
                          {chip ? (
                            <Chip size="sm" variant="soft" color={chip.color}>
                              {chip.label}
                            </Chip>
                          ) : null}
                        </ListView.ItemAction>
                      </ListView.Item>
                    );
                  }}
                </ListView>
                <p className="text-xs leading-4 text-muted">
                  Need a day off instead? Use Leave. Swaps need your colleague to agree, then Beatrice approves.
                </p>
              </>
            ) : (
              <Card variant="secondary">
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Calendar />
                    </EmptyState.Media>
                    <EmptyState.Title>Not published yet</EmptyState.Title>
                    <EmptyState.Description>
                      Next week's shifts show here once the roster is published.
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              </Card>
            )}
          </>
        ) : null}

        {tab === "leave" ? (
          <>
            <Card render={renderSection} aria-labelledby="bal-h" className="gap-[12px] p-[16px]">
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex flex-col">
                  <h2 id="bal-h" className="text-xs leading-4 font-medium text-muted">
                    Annual leave left
                  </h2>
                  <span className="text-[28px] leading-9 font-semibold tabular">{fmtDays(balance.left)} days</span>
                </div>
                <GateChip icon={<FileText className="size-3" />}>{balance.rules}</GateChip>
              </div>
              <Meter
                aria-label="Annual leave used"
                value={Math.round((balance.used / balance.entitlement) * 100)}
                valueLabel={`${pendingDays} days asked for`}
                className="flex flex-col gap-[6px]"
              >
                <div className="flex items-center justify-between gap-[8px]">
                  <Label>
                    Used {fmtDays(balance.used)} of {balance.entitlement} days
                  </Label>
                  <Meter.Output className="text-muted" />
                </div>
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>
              <p className="text-xs leading-4 text-muted">
                You earn {balance.accrual} days each month. Up to {balance.carryOver} days carry over into{" "}
                {balance.carryYear}.
              </p>
              <KeyValueList
                items={[
                  { label: "Sick leave", value: `${balance.sickUsed} days used this year` },
                  { label: "Next public holiday", value: balance.nextHoliday },
                ]}
              />
            </Card>

            <Card render={renderSection} aria-labelledby="ask-h" className="gap-[14px] p-[16px]">
              <h2 id="ask-h" className="text-[15px] leading-[22px] font-semibold">
                Ask for leave
              </h2>
              <div className="flex flex-col gap-[6px]">
                <span className="text-sm font-medium" id="lt-l">
                  Type
                </span>
                <ToggleButtonGroup
                  aria-labelledby="lt-l"
                  aria-describedby="lt-d"
                  selectionMode="single"
                  disallowEmptySelection
                  isDetached
                  selectedKeys={[leaveType]}
                  onSelectionChange={(keys) => {
                    const k = [...keys][0];
                    if (k) setLeaveType(String(k));
                  }}
                  className="flex-wrap justify-start gap-[6px]"
                >
                  {leaveTypes.map((t) => (
                    <ToggleButton key={t.id} id={t.id} className="h-11">
                      {t.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <p id="lt-d" className="text-xs leading-4 text-muted">
                  {type.hint}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-[8px]">
                <TextField value={from} onChange={setFrom} fullWidth className="flex flex-col gap-1">
                  <Label>From</Label>
                  <Input className="min-h-11" />
                </TextField>
                <TextField value={to} onChange={setTo} fullWidth className="flex flex-col gap-1">
                  <Label>To</Label>
                  <Input className="min-h-11" />
                </TextField>
              </div>
              <Alert>
                <Alert.Indicator>
                  <Calculator />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{asked === null ? "Working days" : `${asked} working days`}</Alert.Title>
                  <Alert.Description>{afterText}</Alert.Description>
                </Alert.Content>
              </Alert>
              <TextField value={note} onChange={setNote} fullWidth className="flex flex-col gap-1">
                <Label>Note (optional)</Label>
                <TextArea rows={2} />
              </TextField>
              <div className="flex flex-col gap-[6px]">
                <span className="text-sm font-medium" id="ap-l">
                  Who approves
                </span>
                <ol aria-labelledby="ap-l" className="flex flex-col gap-[6px]">
                  {approvers.map((a) => (
                    <li key={a.id} className="flex items-center gap-[10px]">
                      <Avatar size="sm" variant="soft" color={toneColor(a.tone)}>
                        <Avatar.Fallback>{a.initials}</Avatar.Fallback>
                      </Avatar>
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {a.order}. {a.name}
                        </span>
                        <span className="text-xs text-muted">{a.role}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
                <CircleInfo className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                <span>{draft.busyDates}</span>
              </p>
              <Button size="lg" fullWidth className="min-h-14" isDisabled={pending} onPress={sendLeave}>
                <PaperPlane className="size-4" />
                Send leave request
              </Button>
            </Card>
          </>
        ) : null}

        {tab === "requests" ? (
          <>
            {justSent ? (
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Request sent</Alert.Title>
                  <Alert.Description>{justSent}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {requests.map((q) => {
              const s = STATUS[q.status];
              return (
                <Card
                  key={q.id}
                  render={renderArticle}
                  aria-label={`${q.type}: ${q.title}`}
                  className="gap-[8px] px-[16px] py-[14px]"
                >
                  <div className="flex items-start gap-[10px]">
                    <Avatar size="sm" variant="soft">
                      <Avatar.Fallback>
                        <Icon name={q.icon} className="size-4" />
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs leading-4 text-muted">{q.type}</span>
                      <span className="font-semibold">{q.title}</span>
                      <span className="text-[13px] leading-[18px] text-muted">{q.sub}</span>
                    </div>
                    <Chip size="sm" variant="soft" color={s.color} className="shrink-0">
                      {s.chip}
                    </Chip>
                  </div>
                  <p className="flex items-center gap-[6px] text-xs leading-4 text-muted [&>svg]:size-3 [&>svg]:shrink-0">
                    {s.icon}
                    <span>{q.steps}</span>
                  </p>
                  {s.canCancel ? (
                    <Button
                      variant="ghost"
                      className="min-h-11 self-start"
                      isDisabled={pending}
                      onPress={() => cancel(q)}
                    >
                      Cancel request
                    </Button>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </PhoneBody>

      <PhoneSheet
        isOpen={!!swapShift}
        onOpenChange={(o) => !o && setSwapFor(null)}
        heading={swapShift ? `Swap ${swapShift.long} · ${swapShift.time}` : "Swap"}
        description="Pick a colleague who can take it. Only housekeeping staff with the same training are shown."
      >
        <RadioButtonGroup aria-label="Colleague" value={mate} onChange={setMate} className="flex flex-col gap-[8px]">
          {colleagues.map((c) => (
            <RadioButtonGroup.Item
              key={c.id}
              value={c.id}
              isDisabled={c.busy}
              className="min-h-14 w-full flex-row items-center gap-[12px] px-[14px] py-[10px]"
            >
              <Avatar size="sm" variant="soft" color="accent">
                <Avatar.Fallback>{c.initials}</Avatar.Fallback>
              </Avatar>
              <RadioButtonGroup.ItemContent className="flex-1">
                <Label className="font-semibold">{c.name}</Label>
                <Description className="text-xs leading-4">{c.note}</Description>
              </RadioButtonGroup.ItemContent>
              <RadioButtonGroup.Indicator className="static">
                <CircleCheckFill className="size-4 text-accent" />
              </RadioButtonGroup.Indicator>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        <p className="text-xs leading-4 text-muted">
          {mateDoc?.first} says yes first, then Beatrice approves. The shift stays yours until then.
        </p>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSwapFor(null)}>
            Cancel
          </Button>
          <Button size="lg" fullWidth className="min-h-14" onPress={sendSwap}>
            Ask {mateDoc?.first}
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}
