// Parts the manager screens share: a request's row, the flash report's week columns and share bars,
// small headings, and skeleton pieces. Drawn for the dark theme the manager layout scopes them in;
// every colour is a role, so they read in light too.

import { View } from "react-native";
import { Chip, ListItem, LoadingBone, ProgressBar, Text, type Tone } from "@/components/ui";
import type { Approval } from "./types";

/** How a decided request ended, as its tag says it. */
function outcome(approval: Approval): { label: string; tone: Tone } | null {
  if (approval.state === "approved") return { label: "Approved", tone: "success" };
  if (approval.state === "declined") return { label: "Declined", tone: "default" };
  return null;
}

/** `apRow()`: one request. Waiting ones open their detail; decided ones say how it went. */
export function ApprovalRow({ approval, onOpen }: { approval: Approval; onOpen?: () => void }) {
  const ended = outcome(approval);
  const detail = ended
    ? [approval.detail, `${ended.label} ${approval.decidedAt ?? ""}`.trim(), approval.reason]
        .filter(Boolean)
        .join(" · ")
    : approval.detail;
  const tag = ended ?? approval.tag;
  return (
    <ListItem
      icon={approval.icon}
      tone={approval.tone}
      title={approval.title}
      subtitle={detail}
      trailing={tag ? <Chip label={tag.label} tone={tag.tone} /> : undefined}
      onPress={onOpen}
    />
  );
}

/** `.eyebrow mb8`: a small capitals heading over a card. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Text role="micro" tone="muted" caps strong accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * `.mx-cols`: a week of revenue as columns, the last (yesterday) at full strength and the rest faint,
 * each with its day under it. Read aloud as one line of figures.
 */
export function WeekColumns({ week }: { week: { day: string; value: number }[] }) {
  const max = Math.max(...week.map((w) => w.value), 1);
  const last = week.length - 1;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Room revenue by day, as a share of the best: ${week.map((w) => `${w.day} ${w.value}%`).join(", ")}`}
      className="h-28 flex-row items-end gap-2 pt-1.5"
    >
      {week.map((w, i) => (
        <View key={w.day} className="h-full flex-1 items-center justify-end gap-1.5">
          <View
            className={`w-full rounded-t-lg rounded-b-sm bg-accent ${i === last ? "" : "opacity-35"}`}
            style={{ height: `${Math.round((w.value / max) * 78)}%` }}
          />
          <Text role="caption" tone={i === last ? "default" : "muted"} strong maxScale={1.3}>
            {w.day}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** `.mx-hbar`: a payment method, a bar of its share, and the share. */
export function ShareBar({ name, share }: { name: string; share: number }) {
  return (
    <View className="flex-row items-center gap-2.5 py-1.5">
      <Text role="callout" className="w-24">
        {name}
      </Text>
      <View className="flex-1">
        <ProgressBar value={share} label={`${name}, ${share}% of money in`} />
      </View>
      <Text role="callout" strong tabular className="w-10 text-right">
        {`${share}%`}
      </Text>
    </View>
  );
}

/** Two figure tiles side by side, as `.mx-pulse` and `.grid2` lay them. */
export function KpiBones() {
  return (
    <View className="flex-row gap-2.5">
      <LoadingBone className="h-28 flex-1 rounded-3xl" />
      <LoadingBone className="h-28 flex-1 rounded-3xl" />
    </View>
  );
}

/** A list block's skeleton. */
export function RowBones({ rows }: { rows: number }) {
  return (
    <View className="gap-px overflow-hidden rounded-3xl">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a bone is a position, not an item
        <LoadingBone key={i} className="h-16 rounded-none" />
      ))}
    </View>
  );
}
