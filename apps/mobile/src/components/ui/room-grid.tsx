import type { ReactNode } from "react";
import { Text as NativeText, View } from "react-native";
import { Glyph, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { type RoomStatus, roomStatusLook } from "./status-pill";
import { roleText } from "./text";
import { GridRows } from "./tile";

/** `.rcell b`: the room number, a bold figure that never jitters. */
const NUMBER = roleText("title3", false, { strong: true, tabular: true });
/** `.rcell small`: chrome, `micro` strong (the prototype's 10.5 bold) at its 1.5x cap. */
const NOTE = { ...roleText("micro", false, { strong: true }), maxFontSizeMultiplier: 1.5 };

export type RoomCellProps = {
  /** The room or tent ("206", "T-04"). */
  room: string;
  status: RoomStatus;
  /** `.rcell small`: the cell's short line ("12:00 · DND", "Mukamana"). Defaults to the status word. */
  note?: string;
  /** `.rcell .flag`: a small icon in the corner (a clock for an arrival, a wrench for a fault). */
  flag?: IconName;
  /** Say what the flag means, read aloud ("arrival at 12:00"). */
  flagLabel?: string;
  /** `.mx-tent.pick`: the cell chosen in a picker, with the accent line. */
  selected?: boolean;
  /** `.mx-tent.off`: not available here, dimmed and not pressable. */
  isDisabled?: boolean;
  onPress?: () => void;
};

/**
 * `.rcell`: a room on a floor board, at least 76 high: the number, then its note, on the state's
 * tint (the plain surface for a room with nothing to say, a dashed accent line for an arrival).
 * The state's word is always read aloud ("206, Dirty, 12:00 · DND"), so colour never carries it alone.
 */
export function RoomCell({
  room,
  status,
  note,
  flag,
  flagLabel,
  selected = false,
  isDisabled = false,
  onPress,
}: RoomCellProps) {
  const look = roomStatusLook[status];
  const shown = note ?? look.word;
  const spoken = [room, look.word, note && note !== look.word ? note : null, flagLabel].filter(Boolean).join(", ");
  // A tint needs no line; the plain surface takes a hairline, an arrival a dashed accent line.
  const line = selected
    ? "border-2 border-accent"
    : status === "arriving"
      ? "border border-dashed border-accent"
      : status === "vacant"
        ? "border border-separator"
        : "";
  const cell = (
    <View
      accessible={!onPress}
      accessibilityLabel={spoken}
      className={["gap-1 rounded-2xl px-2.5 pb-2 pt-2.5", look.root, line, isDisabled ? "opacity-40" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight: metrics.roomCell }}
    >
      <NativeText className={`${NUMBER.className} ${look.label}`} maxFontSizeMultiplier={1.5} style={NUMBER.style}>
        {room}
      </NativeText>
      <NativeText
        className={`${NOTE.className} ${look.label}`}
        maxFontSizeMultiplier={NOTE.maxFontSizeMultiplier}
        style={NOTE.style}
        numberOfLines={2}
      >
        {shown}
      </NativeText>
      {flag ? (
        <View className="absolute right-2 top-2">
          <Glyph name={flag} size={12} role={look.role} />
        </View>
      ) : null}
    </View>
  );
  if (!onPress || isDisabled) return cell;
  return (
    <PressArea
      onPress={onPress}
      accessibilityLabel={spoken}
      accessibilityState={{ selected }}
      className="overflow-hidden rounded-2xl"
    >
      {cell}
    </PressArea>
  );
}

export type RoomGridProps = {
  /** `RoomCell`s. */
  children: ReactNode;
  /** `.rgrid`: four columns. */
  columns?: 3 | 4;
  /** Layout only. */
  className?: string;
};

/** `.rgrid`: room cells in rows of four, 8 apart. */
export function RoomGrid({ children, columns = 4, className }: RoomGridProps) {
  return (
    <GridRows columns={columns} gap="sm" className={className}>
      {children}
    </GridRows>
  );
}
