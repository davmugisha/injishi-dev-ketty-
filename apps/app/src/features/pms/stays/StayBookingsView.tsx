"use client";

import { screenHref } from "@injishi/data";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  formatNumber,
  IconAction,
  Money,
  PageContent,
  PersonCell,
  RowActions,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import type { BookingRow, BookingState } from "@/server/stays/desk";
import { BookingPanel, type PanelStay } from "./BookingPanel";

const STATE: Record<BookingState, { label: string; tone: StatusTone }> = {
  pending: { label: "Request", tone: "warning" },
  confirmed: { label: "Booked", tone: "info" },
  inhouse: { label: "In house", tone: "success" },
  checked_out: { label: "Left", tone: "default" },
  declined: { label: "Declined", tone: "default" },
  cancelled: { label: "Cancelled", tone: "default" },
  no_show: { label: "No show", tone: "danger" },
};

const PANEL_STATE: Record<BookingState, PanelStay["state"]> = {
  pending: "pending",
  confirmed: "confirmed",
  inhouse: "inhouse",
  checked_out: "left",
  declined: "closed",
  cancelled: "closed",
  no_show: "closed",
};

const panelStay = (b: BookingRow): PanelStay => ({
  guest: b.guest,
  reference: b.reference,
  stayRef: b.stayRef,
  state: PANEL_STATE[b.state],
  status: STATE[b.state],
  checkIn: b.checkIn,
  checkOut: b.checkOut,
  guests: b.guests,
  room: b.room,
  roomType: b.roomType,
  phone: b.phone,
  channel: b.channel,
  eta: b.eta,
  totalRwf: b.totalRwf,
  paidRwf: b.paidRwf,
  guestMessage: b.guestMessage,
  approvalExpiresAt: b.approvalExpiresAt,
  cancellation: b.cancellation,
  noShow: b.noShow,
});

/**
 * A stay business's bookings (2026-10-30): one table of what is to come and under way, with a status and
 * a channel filter and a search. A booking opens in a side panel with its next step: answer a request,
 * check in, cancel (refunded on its policy) or mark a no show.
 */
export function StayBookingsView({
  rows,
  today,
  openRef,
  can,
}: {
  rows: BookingRow[];
  today: string;
  /** `?booking=` opens that booking's panel. */
  openRef: string | null;
  can: { approve: boolean; checkIn: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(rows.find((r) => r.reference === openRef)?.id ?? null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const close = () => {
    setOpenId(null);
    if (openRef) router.replace(pathname, { scroll: false });
  };

  const columns: DataColumn<BookingRow>[] = [
    {
      id: "guest",
      header: "Guest",
      isRowHeader: true,
      sortValue: (b) => b.guest,
      cell: (b) => <PersonCell name={b.guest} secondary={b.reference} />,
    },
    {
      id: "dates",
      header: "Dates",
      sortValue: (b) => b.checkIn,
      cell: (b) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap tabular">
            <DateText value={b.checkIn} /> to <DateText value={b.checkOut} />
          </span>
          <span className="text-xs text-muted">
            {formatNumber(b.nights)} {b.nights === 1 ? "night" : "nights"}
          </span>
        </span>
      ),
    },
    {
      id: "room",
      header: "Room",
      sortValue: (b) => b.room ?? b.roomType,
      cell: (b) => (
        <span className="flex flex-col">
          <span>{b.roomType}</span>
          {b.room ? <span className="text-xs text-muted">{b.room}</span> : null}
        </span>
      ),
    },
    { id: "channel", header: "Channel", hideBelow: "lg", sortValue: (b) => b.channel, cell: (b) => b.channel },
    {
      id: "total",
      header: "Total",
      align: "end",
      sortValue: (b) => b.totalRwf,
      cell: (b) => <Money value={b.totalRwf} />,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (b) => b.state,
      cell: (b) => <StatusChip tone={STATE[b.state].tone}>{STATE[b.state].label}</StatusChip>,
    },
  ];
  const count = (s: BookingState) => rows.filter((r) => r.state === s).length;
  const channels = [...new Set(rows.map((r) => r.channel))].sort();

  return (
    <PageContent>
      <AreaHeader
        actions={
          <ActionLink href={screenHref("WalkIn")} icon="PersonPlus" intent="primary">
            Walk in
          </ActionLink>
        }
      />
      <DataTable
        label="Bookings"
        noun={{ one: "booking", many: "bookings" }}
        rows={rows}
        rowKey={(b) => b.id}
        columns={columns}
        columnToggle
        defaultSort={{ column: "dates", direction: "ascending" }}
        search={{
          placeholder: "Guest, phone or reference",
          text: (b) => `${b.guest} ${b.phone ?? ""} ${b.reference}`,
        }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All", count: rows.length },
              ...(Object.keys(STATE) as BookingState[])
                .filter((s) => count(s) > 0)
                .map((s) => ({ id: s, label: STATE[s].label, count: count(s) })),
            ],
            match: (b, v) => b.state === v,
          },
          ...(channels.length > 1
            ? [
                {
                  id: "channel",
                  name: "Channel",
                  icon: "Globe" as const,
                  options: [{ id: "all", label: "All" }, ...channels.map((c) => ({ id: c, label: c }))],
                  match: (b: BookingRow, v: string) => b.channel === v,
                },
              ]
            : []),
        ]}
        onRowAction={(b) => setOpenId(b.id)}
        rowActions={(b) => (
          <RowActions>
            {b.state === "pending" && can.approve ? (
              <IconAction icon="CircleCheck" label="Accept the request" onPress={() => setOpenId(b.id)} />
            ) : null}
            {b.state === "confirmed" && can.checkIn && b.checkIn <= today ? (
              <IconAction
                icon="ArrowRightToSquare"
                label="Check in"
                onPress={() => router.push(`${screenHref("CheckIn")}?booking=${encodeURIComponent(b.reference)}`)}
              />
            ) : null}
            <IconAction icon="ChevronRight" label={`Open ${b.reference}`} onPress={() => setOpenId(b.id)} />
          </RowActions>
        )}
        mobile={{
          title: (b) => b.guest,
          description: (b) => `${formatDay(b.checkIn)} to ${formatDay(b.checkOut)} · ${b.roomType}`,
          trailing: (b) => <StatusChip tone={STATE[b.state].tone}>{STATE[b.state].label}</StatusChip>,
        }}
        empty={<EmptyBlock icon="Calendar" title="No bookings yet" />}
      />

      <BookingPanel stay={open ? panelStay(open) : null} today={today} can={can} onClose={close} />
    </PageContent>
  );
}
