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
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Radio,
  RadioGroup,
  Separator,
  TextArea,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import { KeyValue, MeterBar, PhoneSheet, PhoneTitle, SectionTitle, Segmented, StatusAlert } from "./ui";

type Tab = "shifts" | "leave" | "requests";

const STATUS: Record<
  RequestStatus,
  { chip: string; color: "default" | "warning" | "success" | "danger"; icon: string; canCancel: boolean }
> = {
  colleague: { chip: "Waiting for colleague", color: "default", icon: "Hourglass", canCancel: true },
  manager: { chip: "Pending line manager", color: "warning", icon: "Hourglass", canCancel: true },
  approved: { chip: "Approved", color: "success", icon: "Check", canCancel: false },
  declined: { chip: "Declined", color: "danger", icon: "Xmark", canCancel: false },
  cancelled: { chip: "Cancelled", color: "default", icon: "Xmark", canCancel: false },
};

function shiftHours(time: string | null): number {
  const m = time?.match(/(\d{2}):(\d{2})\s*[–—-]\s*(\d{2}):(\d{2})/);
  if (!m) return 0;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return (end - start) / 60;
}

const fmtDays = (n: number) => String(Number.isInteger(n) ? n : n.toFixed(1));

/** Shifts, leave and requests (artifact: StaffSchedule). */
export default function StaffScheduleScreen() {
  const { persona } = useSession();
  const profile =
    (persona ? getDocument<StaffProfile>("staff.profiles", persona.id) : undefined) ??
    getDocument<StaffProfile>("staff.profiles", "housekeeper");
  const shifts = getCollection<Shift>("staff.shifts");
  const colleagues = getCollection<SwapColleague>("staff.swapColleagues");
  const leaveTypes = getCollection<LeaveType>("staff.leaveTypes");
  const balance = getDocument<LeaveBalance>("staff.leaveBalances", "housekeeper");
  const approvers = getCollection<LeaveApprover>("staff.leaveApprovers");
  const draft = getDocument<LeaveDraft>("staff.leaveDrafts", "christmas");

  const [tab, setTab] = useState<Tab>("shifts");
  const [week, setWeek] = useState(0);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [mate, setMate] = useState(colleagues[0]?.id ?? "");
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.id ?? "annual");
  const [note, setNote] = useState(draft?.note ?? "");
  const [from, setFrom] = useState(draft?.from ?? "");
  const [to, setTo] = useState(draft?.to ?? "");
  const [justSent, setJustSent] = useState("");
  const [swapped, setSwapped] = useState<Record<string, string>>(() =>
    Object.fromEntries(shifts.filter((s) => s.swapPendingWith).map((s) => [s.id, s.swapPendingWith ?? ""])),
  );
  const [requests, setRequests] = useState<StaffRequest[]>(() => getCollection<StaffRequest>("staff.requests"));

  if (!persona || !profile || !balance || !draft || !leaveTypes.length) return null;

  const open = requests.filter((q) => q.status === "manager" || q.status === "colleague").length;
  const pendingDays = requests.filter((q) => q.status === "manager").reduce((a, q) => a + q.days, 0);
  const type = leaveTypes.find((t) => t.id === leaveType) ?? leaveTypes[0];
  const left = balance.left - pendingDays - draft.workingDays;
  const afterText = type.usesBalance
    ? `If approved, with the ${pendingDays} days already asked for, you have ${fmtDays(left)} days left.`
    : "This does not change your annual leave balance.";

  const weekShifts = shifts.filter((s) => s.week === 0);
  const working = weekShifts.filter((s) => !s.isOff);
  const next = weekShifts.find((s) => !s.isOff && !s.isToday);
  const hours = working.reduce((a, s) => a + shiftHours(s.time), 0);
  const swapShift = shifts.find((s) => s.id === swapFor);
  const mateDoc = colleagues.find((c) => c.id === mate) ?? colleagues[0];

  const pickTab = (t: string) => {
    setTab(t === "leave" || t === "requests" ? t : "shifts");
    setJustSent("");
  };

  const sendSwap = () => {
    if (!swapShift || !mateDoc) return;
    setSwapFor(null);
    setSwapped((s) => ({ ...s, [swapShift.id]: mateDoc.first }));
    setRequests((rs) => [
      {
        id: `n${Date.now()}`,
        shift: swapShift.id,
        type: "Shift swap",
        icon: "ArrowRightArrowLeft",
        title: `${swapShift.long} · ${swapShift.time}`,
        sub: `With ${mateDoc.name}`,
        status: "colleague",
        steps: `Waiting for ${mateDoc.first} · then Beatrice approves`,
        days: 0,
      },
      ...rs,
    ]);
    setTab("requests");
    setJustSent(`${mateDoc.first} gets a message now. You see the answer here.`);
  };

  const sendLeave = () => {
    const reason = note.trim().replace(/\.$/, "");
    setRequests((rs) => [
      {
        id: `n${Date.now()}`,
        shift: null,
        type: `${type.label} leave`,
        icon: "Suitcase",
        title: draft.title,
        sub: reason || "No note",
        status: "manager",
        steps: "Sent just now · Beatrice first, then Diane (HR)",
        days: type.usesBalance ? draft.workingDays : 0,
      },
      ...rs,
    ]);
    setTab("requests");
    setJustSent("Beatrice gets it first. Diane (HR) checks your balance after she approves.");
  };

  const cancel = (q: StaffRequest) => {
    setJustSent("");
    setRequests((rs) =>
      rs.map((x) => (x.id === q.id ? { ...x, status: "cancelled", steps: "You cancelled this request" } : x)),
    );
    if (q.shift) {
      const shiftId = q.shift;
      setSwapped((s) => {
        const nextSwapped = { ...s };
        delete nextSwapped[shiftId];
        return nextSwapped;
      });
    }
  };

  return (
    <View className="flex-1">
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent" alt={persona.name}>
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <PhoneTitle title="My schedule" sub={`${persona.name} · ${profile.department} · ${profile.site}`} />
      </PhoneTop>

      <View className="px-4 pb-2">
        <Segmented
          label="Show"
          value={tab}
          onChange={pickTab}
          items={[
            { id: "shifts", label: "Shifts" },
            { id: "leave", label: "Leave" },
            { id: "requests", label: open ? `Requests · ${open}` : "Requests" },
          ]}
        />
      </View>

      <PhoneBody>
        {tab === "shifts" ? (
          <>
            <View className="flex-row items-center justify-between">
              <Button
                variant="ghost"
                isIconOnly
                accessibilityLabel="Previous week"
                className="size-11"
                isDisabled={week === 0}
                onPress={() => setWeek(0)}
              >
                <Icon name="ChevronLeft" />
              </Button>
              <View className="items-center">
                <Text className="font-semibold text-foreground">{week === 0 ? "This week" : "Next week"}</Text>
                <Text className="text-xs text-muted">{week === 0 ? "12 – 18 October" : "19 – 25 October"}</Text>
              </View>
              <Button
                variant="ghost"
                isIconOnly
                accessibilityLabel="Next week"
                className="size-11"
                isDisabled={week === 1}
                onPress={() => setWeek(1)}
              >
                <Icon name="ChevronRight" />
              </Button>
            </View>

            {week === 0 ? (
              <>
                {next ? (
                  <Card accessibilityLabel="Next shift" className="gap-1 p-4">
                    <Text className="text-xs leading-4 text-muted">Next shift</Text>
                    <Text className="text-xl leading-[26px] font-semibold text-foreground">
                      {next.long} · {next.time}
                    </Text>
                    <Text className="text-[13px] leading-[18px] text-muted">
                      {next.area} · {working.length} shifts this week · {hours} hours
                    </Text>
                  </Card>
                ) : null}
                <Card accessibilityLabel="Shifts this week" className="gap-0 overflow-hidden p-0">
                  {weekShifts.map((d, index) => {
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
                      <View key={d.id}>
                        {index > 0 ? <Separator /> : null}
                        <View
                          className={`min-h-16 flex-row items-center gap-2 px-3 py-2 ${d.isToday ? "border-l-[3px] border-l-accent" : ""}`}
                        >
                          <View className="w-10 items-center">
                            <Text className="text-[11px] leading-[14px] font-semibold text-muted">{d.dow}</Text>
                            <Text className="text-lg leading-[22px] font-semibold text-foreground">{d.date}</Text>
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text className="font-medium text-foreground">{d.isOff ? "Off" : d.time}</Text>
                            <Text className="text-[13px] leading-[18px] text-muted">
                              {d.isOff ? "Rest day" : d.area}
                            </Text>
                          </View>
                          {canSwap ? (
                            <Button
                              variant="secondary"
                              className="min-h-11"
                              accessibilityLabel={`Swap ${d.long}`}
                              onPress={() => {
                                setSwapFor(d.id);
                                setMate(colleagues[0]?.id ?? "");
                              }}
                            >
                              <Button.Label>Swap</Button.Label>
                            </Button>
                          ) : null}
                          {chip ? (
                            <Chip size="sm" variant="soft" color={chip.color}>
                              <Chip.Label>{chip.label}</Chip.Label>
                            </Chip>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </Card>
                <Text className="text-xs leading-4 text-muted">
                  Need a day off instead? Use Leave. Swaps need your colleague to agree, then Beatrice approves.
                </Text>
              </>
            ) : (
              <Card variant="secondary" className="items-center gap-2 p-6">
                <Icon name="Calendar" size={28} tone="muted" />
                <Text className="text-base font-semibold text-foreground">Not published yet</Text>
                <Text className="text-center text-sm text-muted">
                  Beatrice publishes next week's roster by Thursday. You get a message when it is ready.
                </Text>
              </Card>
            )}
          </>
        ) : null}

        {tab === "leave" ? (
          <>
            <Card className="gap-3 p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View>
                  <Text accessibilityRole="header" className="text-xs leading-4 font-medium text-muted">
                    Annual leave left
                  </Text>
                  <Text className="text-[28px] leading-9 font-semibold text-foreground">
                    {fmtDays(balance.left)} days
                  </Text>
                </View>
                <Chip variant="soft" size="sm">
                  <Icon name="FileText" size={12} />
                  <Chip.Label>{balance.rules}</Chip.Label>
                </Chip>
              </View>
              <MeterBar
                label={`Used ${fmtDays(balance.used)} of ${balance.entitlement} days`}
                valueLabel={`${pendingDays} days asked for`}
                pct={Math.round((balance.used / balance.entitlement) * 100)}
                accessibilityLabel="Annual leave used"
              />
              <Text className="text-xs leading-4 text-muted">
                You earn {balance.accrual} days each month. Up to {balance.carryOver} days carry over into{" "}
                {balance.carryYear}.
              </Text>
              <KeyValue
                items={[
                  { label: "Sick leave", value: `${balance.sickUsed} days used this year` },
                  { label: "Next public holiday", value: balance.nextHoliday },
                ]}
              />
            </Card>

            <Card className="gap-3.5 p-4">
              <SectionTitle>Ask for leave</SectionTitle>
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">Type</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {leaveTypes.map((t) => (
                    <Button
                      key={t.id}
                      variant={leaveType === t.id ? "primary" : "secondary"}
                      className="h-11"
                      onPress={() => setLeaveType(t.id)}
                    >
                      <Button.Label>{t.label}</Button.Label>
                    </Button>
                  ))}
                </View>
                <Text className="text-xs leading-4 text-muted">{type.hint}</Text>
              </View>
              <View className="flex-row gap-2">
                <TextField className="flex-1">
                  <Label>From</Label>
                  <Input value={from} onChangeText={setFrom} />
                </TextField>
                <TextField className="flex-1">
                  <Label>To</Label>
                  <Input value={to} onChangeText={setTo} />
                </TextField>
              </View>
              <StatusAlert
                status="accent"
                icon="Calculator"
                title={`${draft.workingDays} working days`}
                description={afterText}
              />
              <TextField>
                <Label>Note (optional)</Label>
                <TextArea value={note} onChangeText={setNote} numberOfLines={2} />
              </TextField>
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">Who approves</Text>
                {approvers.map((a) => (
                  <View key={a.id} className="flex-row items-center gap-2.5">
                    <Avatar size="sm" variant="soft" color={toneColor(a.tone)} alt={a.name}>
                      <Avatar.Fallback>{a.initials}</Avatar.Fallback>
                    </Avatar>
                    <View>
                      <Text className="font-medium text-foreground">
                        {a.order}. {a.name}
                      </Text>
                      <Text className="text-xs text-muted">{a.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View className="flex-row items-start gap-2">
                <Icon name="CircleInfo" tone="muted" />
                <Text className="flex-1 text-xs leading-4 text-muted">{draft.busyDates}</Text>
              </View>
              <Button size="lg" className="min-h-14 w-full" onPress={sendLeave}>
                <Icon name="PaperPlane" tone="accent-foreground" />
                <Button.Label>Send leave request</Button.Label>
              </Button>
            </Card>
          </>
        ) : null}

        {tab === "requests" ? (
          <>
            {justSent ? (
              <StatusAlert status="success" icon="CircleCheck" title="Request sent" description={justSent} />
            ) : null}
            {requests.map((q) => {
              const s = STATUS[q.status];
              return (
                <Card key={q.id} accessibilityLabel={`${q.type}: ${q.title}`} className="gap-2 px-4 py-3.5">
                  <View className="flex-row items-start gap-2.5">
                    <Avatar size="sm" variant="soft" alt={q.type}>
                      <Avatar.Fallback>
                        <Icon name={q.icon} />
                      </Avatar.Fallback>
                    </Avatar>
                    <View className="min-w-0 flex-1">
                      <Text className="text-xs leading-4 text-muted">{q.type}</Text>
                      <Text className="font-semibold text-foreground">{q.title}</Text>
                      <Text className="text-[13px] leading-[18px] text-muted">{q.sub}</Text>
                    </View>
                    <Chip size="sm" variant="soft" color={s.color}>
                      <Chip.Label>{s.chip}</Chip.Label>
                    </Chip>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Icon name={s.icon} size={12} tone="muted" />
                    <Text className="flex-1 text-xs leading-4 text-muted">{q.steps}</Text>
                  </View>
                  {s.canCancel ? (
                    <Button variant="ghost" className="min-h-11 self-start" onPress={() => cancel(q)}>
                      <Button.Label>Cancel request</Button.Label>
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
        onOpenChange={(open) => !open && setSwapFor(null)}
        heading={swapShift ? `Swap ${swapShift.long} · ${swapShift.time}` : "Swap"}
        description="Pick a colleague who can take it. Only housekeeping staff with the same training are shown."
      >
        <RadioGroup accessibilityLabel="Colleague" value={mate} onValueChange={setMate} className="gap-2">
          {colleagues.map((c) => (
            <RadioGroup.Item
              key={c.id}
              value={c.id}
              isDisabled={c.busy}
              className="min-h-14 w-full flex-row items-center gap-3 rounded-2xl border border-separator bg-surface px-3.5 py-2.5"
            >
              <Avatar size="sm" variant="soft" color="accent" alt={c.name}>
                <Avatar.Fallback>{c.initials}</Avatar.Fallback>
              </Avatar>
              <View className="flex-1">
                <Text className="font-semibold text-foreground">{c.name}</Text>
                <Text className="text-xs leading-4 text-muted">{c.note}</Text>
              </View>
              <Radio />
            </RadioGroup.Item>
          ))}
        </RadioGroup>
        <Text className="text-xs leading-4 text-muted">
          {mateDoc?.first} says yes first, then Beatrice approves. The shift stays yours until then.
        </Text>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="min-h-14 flex-1" onPress={() => setSwapFor(null)}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Button size="lg" className="min-h-14 flex-[2]" onPress={sendSwap}>
            <Button.Label>Ask {mateDoc?.first}</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </View>
  );
}
