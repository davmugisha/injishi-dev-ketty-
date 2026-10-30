import type { MyWorkTodayShift } from "@injishi/contracts";
import { Card } from "heroui-native";
import { View } from "react-native";
import { Chip, Icon, LoadingBone, LoadingView, Text } from "@/components/ui";
import { kigaliTime } from "@/lib/kigali";
import { type ShiftCardState, startWords } from "./shift-state";

/** "07:00 – 15:00". */
function span(shift: MyWorkTodayShift): string {
  return `${kigaliTime(shift.startsAt)} – ${kigaliTime(shift.endsAt)}`;
}

/** "Morning · 30 min break". */
function details(shift: MyWorkTodayShift): string {
  return [shift.shiftName, shift.breakMinutes > 0 ? `${shift.breakMinutes} min break` : "no break"].join(" · ");
}

/**
 * The shift card (mobile spec 0003, prototype `housekeeper-01-clockin`, the clock in child's card table):
 * today's rostered shift and where the person stands on it. The punch button sits under it, in the
 * screen's action bar.
 */
export function ShiftCard({ state }: { state: ShiftCardState }) {
  return (
    <Card>
      <Card.Body className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text role="micro" tone="muted" caps>
            Your shift
          </Text>
          <StateChip state={state} />
        </View>
        <ShiftBody state={state} />
      </Card.Body>
    </Card>
  );
}

function StateChip({ state }: { state: ShiftCardState }) {
  switch (state.kind) {
    case "before":
      return <Chip label={startWords(state.minutes)} tone="accent" />;
    case "on_shift":
      return <Chip label="On shift" tone="success" icon="CircleCheck" />;
    case "clocked_out":
      return <Chip label="Clocked out" tone="default" />;
    case "no_shift":
      return null;
  }
}

function ShiftBody({ state }: { state: ShiftCardState }) {
  switch (state.kind) {
    case "before":
      return (
        <View className="gap-1">
          <Text role="display">{span(state.shift)}</Text>
          <Text role="callout" tone="muted">
            {details(state.shift)}
          </Text>
        </View>
      );
    case "no_shift":
      return (
        <View className="gap-1">
          <Text role="title2">No shift on the roster today</Text>
          <Text role="callout" tone="muted">
            You can still clock in. Your manager sees it.
          </Text>
        </View>
      );
    case "on_shift":
      return (
        <View className="gap-2">
          <View className="gap-1">
            <Text role="title1">On shift since {kigaliTime(state.since)}</Text>
            {state.shift ? (
              <Text role="callout" tone="muted">
                {`${details(state.shift)} · ends at ${kigaliTime(state.shift.endsAt)}`}
              </Text>
            ) : null}
          </View>
          {state.saved ? <SavedLine words="Saved on this phone · sends when there's signal" /> : null}
          {state.confirmLater ? (
            <Text role="caption" tone="muted">
              Your manager will confirm this clock in.
            </Text>
          ) : null}
        </View>
      );
    case "clocked_out":
      return (
        <View className="gap-2">
          <Text role="title1">Clocked out at {kigaliTime(state.at)}</Text>
          {state.saved ? <SavedLine words="Saved on this phone · sends when there's signal" /> : null}
        </View>
      );
  }
}

function SavedLine({ words }: { words: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon name="FloppyDisk" size={16} tone="warning" />
      <Text role="caption" tone="warning">
        {words}
      </Text>
    </View>
  );
}

/** The card while it first loads: bones in its shape. */
export function ShiftCardLoading() {
  return (
    <LoadingView label="Loading your shift">
      <LoadingBone className="h-48 rounded-3xl" />
    </LoadingView>
  );
}

/** No employee file for this workspace: nothing to punch on (AC-2). */
export function ShiftNotSetUp() {
  return (
    <Card>
      <Card.Body className="gap-2">
        <Text role="micro" tone="muted" caps>
          Your shift
        </Text>
        <Text role="title3">Clock in isn't set up here.</Text>
        <Text role="callout" tone="muted">
          Ask your manager.
        </Text>
      </Card.Body>
    </Card>
  );
}
