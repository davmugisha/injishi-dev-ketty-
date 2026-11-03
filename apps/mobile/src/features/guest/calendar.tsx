// `.gx-cal`: a month of days, Monday first, for picking a stay's nights. Past days are struck through,
// today is ringed, the stay's first and last days are accent discs joined by a soft band, and a sold
// out night carries a small red dot (and says "sold out" to a screen reader).

import { rnSpace } from "@injishi/design-tokens";
import { View } from "react-native";
import { IconButton, metrics, PressArea, Text } from "@/components/ui";
import { dayLong, type Month, monthWeeks, monthWords } from "./dates";

const WEEK = [
  { key: "mon", letter: "M" },
  { key: "tue", letter: "T" },
  { key: "wed", letter: "W" },
  { key: "thu", letter: "T" },
  { key: "fri", letter: "F" },
  { key: "sat", letter: "S" },
  { key: "sun", letter: "S" },
] as const;

/** `.gx-cal .d.sold::after`: the sold out dot under the day. */
const SOLD_DOT = metrics.liveDot / 2;

export function MonthHeader({
  month,
  canBack,
  canForward,
  onShift,
}: {
  month: Month;
  canBack: boolean;
  canForward: boolean;
  onShift: (by: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text role="callout" strong accessibilityRole="header" accessibilityLiveRegion="polite">
        {monthWords(month)}
      </Text>
      <View className="-mr-2 flex-row">
        <IconButton
          icon="ChevronLeft"
          label="Previous month"
          variant="plain"
          tone="muted"
          isDisabled={!canBack}
          onPress={() => onShift(-1)}
        />
        <IconButton
          icon="ChevronRight"
          label="Next month"
          variant="plain"
          tone="muted"
          isDisabled={!canForward}
          onPress={() => onShift(1)}
        />
      </View>
    </View>
  );
}

export function MonthCalendar({
  month,
  today,
  checkIn,
  checkOut,
  soldOut,
  onPick,
}: {
  month: Month;
  today: string;
  checkIn: string | null;
  checkOut: string | null;
  soldOut: readonly string[];
  onPick: (day: string) => void;
}) {
  const weeks = monthWeeks(month);
  return (
    // A little wider than the sheet's padding, so seven 48 press areas fit a 360 wide phone.
    <View className="-mx-2" accessibilityLabel={`Calendar, ${monthWords(month)}`}>
      <View className="flex-row pb-1">
        {WEEK.map((d) => (
          <View key={d.key} className="flex-1 items-center">
            <Text role="caption" strong tone="muted" importantForAccessibility="no">
              {d.letter}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week.find(Boolean) ?? "blank"} className="flex-row">
          {week.map((day, i) =>
            day ? (
              <Day
                key={day}
                day={day}
                past={day < today}
                today={day === today}
                start={day === checkIn}
                end={day === checkOut}
                inside={checkIn !== null && checkOut !== null && day > checkIn && day < checkOut}
                joined={checkIn !== null && checkOut !== null}
                sold={soldOut.includes(day)}
                onPick={onPick}
              />
            ) : (
              <View key={WEEK[i]?.key ?? i} className="flex-1" />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Day({
  day,
  past,
  today,
  start,
  end,
  inside,
  joined,
  sold,
  onPick,
}: {
  day: string;
  past: boolean;
  today: boolean;
  start: boolean;
  end: boolean;
  inside: boolean;
  /** Both ends are picked, so the ends join the band. */
  joined: boolean;
  sold: boolean;
  onPick: (day: string) => void;
}) {
  const edge = start || end;
  const band = inside || (joined && edge);
  const words = [dayLong(day), sold ? "sold out" : null, start ? "check-in" : null, end ? "check-out" : null]
    .filter(Boolean)
    .join(", ");
  return (
    <PressArea
      onPress={() => onPick(day)}
      isDisabled={past}
      feedback="none"
      accessibilityLabel={words}
      accessibilityState={{ selected: edge, disabled: past }}
      className="flex-1 items-center justify-center"
    >
      {band ? (
        <View
          className="absolute bg-accent-soft"
          style={{
            top: rnSpace[1],
            bottom: rnSpace[1],
            left: start ? "50%" : 0,
            right: end ? "50%" : 0,
          }}
        />
      ) : null}
      <View
        className={`items-center justify-center rounded-full ${edge ? "bg-accent" : ""} ${today && !edge ? "border-2 border-foreground" : ""} ${past ? "opacity-50" : ""}`}
        style={{ width: metrics.iconTile, height: metrics.iconTile }}
      >
        <Text
          role="callout"
          strong
          tabular
          tone={edge ? "onAccent" : past || sold ? "muted" : undefined}
          className={past ? "line-through" : undefined}
        >
          {Number(day.slice(8))}
        </Text>
      </View>
      {sold ? (
        <View
          className="absolute rounded-full bg-danger"
          style={{ bottom: rnSpace[1], width: SOLD_DOT, height: SOLD_DOT }}
        />
      ) : null}
    </PressArea>
  );
}
