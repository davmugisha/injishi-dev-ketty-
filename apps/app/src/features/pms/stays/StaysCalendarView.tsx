"use client";

import type { StayActivityItem, StaysActivity } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  EmptyBlock,
  formatDay,
  formatMoney,
  formatNumber,
  PageContent,
  Schedule,
  type ScheduleEvent,
  type ScheduleKind,
} from "@injishi/ui";
import { useMemo } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";

const KINDS: ScheduleKind[] = [
  { id: "requested", label: "Request", color: "var(--warning)", tentative: true },
  { id: "confirmed", label: "Booked", color: "var(--accent)" },
  { id: "in_house", label: "In house", color: "var(--success)" },
  { id: "checked_out", label: "Left", color: "var(--chart-other)" },
];

const STATUS_WORD: Record<StayActivityItem["status"], string> = {
  requested: "Request waiting",
  confirmed: "Booked",
  in_house: "In house",
  checked_out: "Left",
  cancelled: "Cancelled",
  no_show: "No show",
};

const nightsOf = (s: StayActivityItem) =>
  Math.max(1, Math.round((Date.parse(`${s.checkOut}T00:00:00Z`) - Date.parse(`${s.checkIn}T00:00:00Z`)) / 86_400_000));

const lastNight = (s: StayActivityItem) =>
  new Date(Date.parse(`${s.checkOut}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Where a stay opens: its booking on the Bookings tab, or a walk in's own stay and bill. */
function openHref(s: StayActivityItem): string | null {
  if (s.source === "walk_in") return `/stays/${encodeURIComponent(s.reference ?? s.id)}`;
  if (!s.reference || s.status === "checked_out") return null;
  return `${screenHref("Reservations")}?booking=${encodeURIComponent(s.reference)}`;
}

/**
 * A stay business's calendar (2026-10-30): every booking and walk in as a bar from its first night to its
 * last, coloured by where it stands. Read only: the API has no way to change a booking's dates yet, so
 * choosing a bar shows its detail and a link to the booking.
 */
export function StaysCalendarView({ activity }: { activity: StaysActivity | null }) {
  const events = useMemo<ScheduleEvent[]>(
    () =>
      (activity?.stays ?? [])
        .filter((s) => s.status !== "cancelled" && s.status !== "no_show")
        .map((s) => {
          const href = openHref(s);
          const nights = nightsOf(s);
          return {
            id: s.id,
            kind: s.status,
            title: `${s.guestName.split(/\s+/)[0]}${s.roomLabel ? ` · ${s.roomLabel}` : ""}`,
            heading: s.guestName,
            start: s.checkIn,
            end: lastNight(s),
            details: [
              { label: "Room", value: s.roomLabel ? `${s.roomLabel} (${s.roomTypeName})` : s.roomTypeName },
              { label: "Nights", value: `${formatNumber(nights)}, leaving ${formatDay(s.checkOut)}` },
              { label: "Status", value: STATUS_WORD[s.status] },
              ...(s.totalRwf > 0 ? [{ label: "Total", value: formatMoney(s.totalRwf) }] : []),
              ...(s.reference ? [{ label: "Reference", value: s.reference }] : []),
            ],
            actions: href ? (
              <ActionLink href={href} size="sm" icon="ArrowRight">
                {s.source === "walk_in" ? "Open stay" : "Open booking"}
              </ActionLink>
            ) : undefined,
          };
        }),
    [activity],
  );
  return (
    <PageContent>
      <AreaHeader />
      {activity ? (
        <Schedule label="Bookings calendar" events={events} kinds={KINDS} today={activity.today} />
      ) : (
        <EmptyBlock icon="Calendar" title="No bookings to show" />
      )}
    </PageContent>
  );
}
