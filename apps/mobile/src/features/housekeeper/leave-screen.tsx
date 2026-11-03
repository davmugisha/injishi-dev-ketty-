import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  Dock,
  Field,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  PressArea,
  Screen,
  Segmented,
  Stepper,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useAskLeave, useLeave } from "./data";
import { dayNumber, isoOf, shortDay, workingDays } from "./dates";
import type { LeaveType, LeaveView } from "./types";
import { Bones, backOr, ListBones, useStaffApp } from "./ui";

const TYPES = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "other", label: "Other" },
] as const;

const TYPE_HINT: Record<LeaveType, string> = {
  annual: "Uses your annual leave balance.",
  sick: "Does not use your annual days. A doctor's note is needed after two days.",
  other: "Does not use your annual days. Unpaid unless your manager agrees otherwise.",
};

/** How far ahead leave can be asked: a year. */
const YEAR = 365;

interface Draft {
  type: LeaveType;
  from: string;
  to: string;
  note: string;
}

/**
 * `hk-leave` (also the technician's): counts working days as she picks the dates and names who
 * approves, in order.
 */
export function LeaveScreen() {
  const app = useStaffApp();
  const surface = useSurface();
  const query = useLeave(app);
  const ask = useAskLeave(app);
  const toast = useToast();
  const leave = query.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft | null =
    draft ?? (leave ? { type: "annual", from: leave.from, to: leave.to, note: "" } : null);
  const change = (patch: Partial<Draft>) => {
    if (current) setDraft({ ...current, ...patch });
  };
  const back = () => backOr(href("hk-schedule", undefined, { app: surface }));
  const days = current ? workingDays(current.from, current.to) : 0;

  const send = () => {
    if (!current || !leave) return;
    ask.mutate(
      { type: current.type, from: current.from, to: current.to, days, note: current.note.trim() },
      {
        onSuccess: () => {
          toast.show({ icon: "PaperPlane", message: `Leave request sent to ${leave.firstApprover}` });
          back();
        },
      },
    );
  };

  return (
    <Screen
      header={<NavBar title="Ask for leave" onBack={back} />}
      dock={
        leave ? (
          <Dock note={`You can cancel it until ${leave.firstApprover} answers.`}>
            <Button icon="PaperPlane" isDisabled={days === 0 || ask.isPending} onPress={send}>
              Send leave request
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={leave} loading={<LeaveLoading />}>
        {(view) => (current ? <LeaveForm leave={view} draft={current} days={days} onChange={change} /> : null)}
      </QueryView>
    </Screen>
  );
}

function LeaveForm({
  leave,
  draft,
  days,
  onChange,
}: {
  leave: LeaveView;
  draft: Draft;
  days: number;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const [editing, setEditing] = useState<"from" | "to">("to");
  const earliest = dayNumber(leave.earliest);
  const from = dayNumber(draft.from);
  const to = dayNumber(draft.to);
  const setDay = (day: number) => {
    if (editing === "from") onChange({ from: isoOf(day), to: isoOf(Math.max(day, to)) });
    else onChange({ to: isoOf(day) });
  };
  const annual = draft.type === "annual";
  const after = leave.balance - days;
  return (
    <View className="mt-2 gap-4 px-4">
      <Field label="Type" hint={TYPE_HINT[draft.type]}>
        <Segmented label="Type of leave" options={TYPES} value={draft.type} onChange={(type) => onChange({ type })} />
      </Field>
      <View className="gap-2">
        <View className="flex-row gap-2.5">
          <DateBox label="From" iso={draft.from} focused={editing === "from"} onPress={() => setEditing("from")} />
          <DateBox label="To" iso={draft.to} focused={editing === "to"} onPress={() => setEditing("to")} />
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Text role="callout" tone="muted" className="flex-1">
            {editing === "from" ? "Move the first day" : "Move the last day"}
          </Text>
          <Stepper
            label={editing === "from" ? "First day of leave" : "Last day of leave"}
            value={editing === "from" ? from : to}
            min={editing === "from" ? earliest : from}
            max={earliest + YEAR}
            onChange={setDay}
            format={(day) => shortDay(isoOf(day))}
          />
        </View>
      </View>
      <Card tone={annual && after < 0 ? "warning" : "accentSoft"} padding="sm">
        <View className="flex-row items-center gap-3" accessible>
          <Icon name="Calculator" size={24} />
          <View className="flex-1">
            <Text role="callout" strong>
              {`${days} working day${days === 1 ? "" : "s"}`}
            </Text>
            <Text role="callout">
              {annual
                ? after >= 0
                  ? `${leave.balance} days left now · ${after} after this`
                  : `That is more than the ${leave.balance} days you have left.`
                : "Your annual days stay as they are."}
            </Text>
          </View>
        </View>
      </Card>
      <Field label="Note (optional)">
        <TextArea value={draft.note} onChangeText={(note) => onChange({ note })} placeholder={leave.notePlaceholder} />
      </Field>
      <Field label="Who approves">
        <ListGroup>
          {leave.approvers.map((a) => (
            <ListItem
              key={a.name}
              leading={<Avatar size="s" initials={a.initials} tone={a.tone} />}
              title={a.name}
              subtitle={a.role}
            />
          ))}
        </ListGroup>
      </Field>
    </View>
  );
}

/** A date field (`.field` + `.input` with a calendar): pressed, the stepper below moves this date. */
function DateBox({
  label,
  iso,
  focused,
  onPress,
}: {
  label: string;
  iso: string;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text role="callout" strong>
        {label}
      </Text>
      <PressArea
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shortDay(iso)}`}
        accessibilityState={{ selected: focused }}
        className="overflow-hidden rounded-2xl"
      >
        <View
          className={`flex-row items-center gap-2.5 rounded-2xl border bg-field px-3.5 ${focused ? "border-accent" : "border-field-border"}`}
          style={{ minHeight: metrics.input }}
        >
          <Icon name="Calendar" tone="muted" />
          <Text role="body" className="flex-1">
            {shortDay(iso)}
          </Text>
        </View>
      </PressArea>
    </View>
  );
}

function LeaveLoading() {
  return (
    <LoadingView label="Loading">
      <Bones>
        <LoadingBone className="h-12 rounded-2xl" />
        <View className="flex-row gap-2.5">
          <LoadingBone className="h-14 flex-1 rounded-2xl" />
          <LoadingBone className="h-14 flex-1 rounded-2xl" />
        </View>
        <LoadingBone className="h-16 rounded-3xl" />
        <LoadingBone className="h-24 rounded-2xl" />
        <ListBones rows={2} />
      </Bones>
    </LoadingView>
  );
}
