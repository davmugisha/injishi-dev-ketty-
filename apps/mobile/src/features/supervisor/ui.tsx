// Pieces the supervisor screens share: the room row of the queue (`.sx-room`), a figure tile
// (`.kpi` with a tinted figure) and back with a fallback.

import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Chip, metrics, PressArea, Text } from "@/components/ui";
import { href, type ScreenId } from "@/proto/screens";
import type { QueueRoom } from "./types";

/** Back to the screen below, or to `id` when the screen was opened on its own (a deep link). */
export function backTo(id: ScreenId, params?: Record<string, string>) {
  if (router.canGoBack()) router.back();
  else router.replace(href(id, params));
}

/**
 * `.sx-room`: the room number large on the left, what it is and when below a bold line, and a chip
 * or a status at the end. Pressable when it opens the room.
 */
export function RoomRow({
  room,
  title,
  detail,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  room: string;
  title: string;
  detail: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <View className="flex-row items-center gap-3 px-3.5 py-2.5" style={{ minHeight: metrics.rowLarge }}>
      <View className="w-12">
        <Text role="title2" tabular>
          {room}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text role="callout" strong>
          {title}
        </Text>
        <Text role="caption" tone="muted">
          {detail}
        </Text>
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
  if (!onPress) return <View accessible>{body}</View>;
  return (
    <PressArea
      onPress={onPress}
      feedback="native"
      accessibilityLabel={accessibilityLabel ?? `Room ${room}, ${title}, ${detail}`}
      className="overflow-hidden"
    >
      {body}
    </PressArea>
  );
}

/** A queue row: the room, its arrival and wait, and the chip that says how soon. */
export function QueueRow({ item, onPress }: { item: QueueRoom; onPress: () => void }) {
  return (
    <RoomRow
      room={item.room}
      title={item.title}
      detail={item.detail}
      trailing={<Chip label={item.chip.label} tone={item.chip.tone} icon={item.chip.icon} />}
      onPress={onPress}
      accessibilityLabel={`Inspect room ${item.room}, ${item.title}, ${item.detail}, ${item.chip.label}`}
    />
  );
}

/**
 * `.kpi` with the figure in a tone (the prototype's accent "Waiting you"): a small label, the figure
 * in `title2 tabular` with a quieter unit. Pressable when it opens the detail.
 */
export function StatTile({
  label,
  value,
  unit,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "accent" | "danger";
  onPress?: () => void;
}) {
  const spoken = `${label}, ${value}${unit ? ` ${unit}` : ""}`;
  const body = (
    <View
      accessible={!onPress}
      accessibilityLabel={spoken}
      className="grow rounded-3xl border border-separator bg-surface px-3.5 py-3"
    >
      <Text role="caption" tone="muted" strong numberOfLines={1}>
        {label}
      </Text>
      <View className="mt-0.5 flex-row items-baseline gap-0.5">
        <Text role="title2" tabular tone={tone}>
          {value}
        </Text>
        {unit ? (
          <Text role="callout" tone="muted" strong tabular>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress)
    return (
      <View className="flex-1" style={{ minHeight: metrics.touch }}>
        {body}
      </View>
    );
  return (
    <PressArea onPress={onPress} accessibilityLabel={spoken} className="flex-1">
      {body}
    </PressArea>
  );
}
