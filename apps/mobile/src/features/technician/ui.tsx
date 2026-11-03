// Pieces the technician screens share: a job row (`.li.big` with its photo), a figure tile with a
// caption (`.kpi`), back with a fallback, and the repair timer's clock.

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, ListItem, metrics, Photo, Text } from "@/components/ui";
import { href, type ScreenId } from "@/proto/screens";
import type { JobDetail, JobRow } from "./types";

/** Back to the screen below, or to `id` when the screen was opened on its own (a deep link). */
export function backTo(id: ScreenId, params?: Record<string, string>) {
  if (router.canGoBack()) router.back();
  else router.replace(href(id, params));
}

/** `.li.big`: the reporter's photo, where and what, the reference and who, and a priority or parts chip. */
export function JobRowItem({ row, onPress }: { row: JobRow; onPress: () => void }) {
  return (
    <ListItem
      size="lg"
      leading={<Photo source={row.photo} width={metrics.thumb} height={metrics.thumb} radius="sm" />}
      title={row.title}
      subtitle={row.detail}
      trailing={<Chip label={row.tag.label} tone={row.tag.tone} icon={row.tag.icon} />}
      chevron={false}
      onPress={onPress}
      accessibilityLabel={`${row.title}, ${row.detail}, ${row.tag.label}`}
    />
  );
}

/** `.kpi` with a caption under the figure, the figure in a tone when it is a warning ("Faults 3"). */
export function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "danger";
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}, ${caption}`}
      className="flex-1 rounded-3xl border border-separator bg-surface px-3.5 py-3"
    >
      <Text role="caption" tone="muted" strong numberOfLines={1}>
        {label}
      </Text>
      <Text role="title2" tabular tone={tone} className="mt-0.5">
        {value}
      </Text>
      <Text role="caption" tone="muted" numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** The repair timer's seconds, ticking once a second while it runs. */
export function useTimerSeconds(timer: JobDetail["timer"]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer.since) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [timer.since]);
  return timer.seconds + (timer.since ? Math.max(0, Math.floor((now - timer.since) / 1000)) : 0);
}

/** 12:04, or 1:02:09 past an hour. */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
