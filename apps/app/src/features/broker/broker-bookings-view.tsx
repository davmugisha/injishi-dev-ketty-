"use client";

import type { BrokerBookingGroup, BrokerBookingList, BrokerGroupStatus } from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pollBooking } from "./actions";

const STATUS: Record<BrokerGroupStatus, { tone: StatusTone; label: string }> = {
  awaiting_payment: { tone: "warning", label: "Waiting for payment" },
  booked: { tone: "success", label: "Booked" },
  failed: { tone: "default", label: "Not booked" },
};

export function GroupChip({ status }: { status: BrokerGroupStatus }) {
  const s = STATUS[status];
  return <StatusChip tone={s.tone}>{s.label}</StatusChip>;
}

const dates = (g: BrokerBookingGroup) =>
  `${formatDay(g.checkIn, "short")} – ${formatDay(g.checkOut, "short")} · ${g.nights} ${g.nights === 1 ? "night" : "nights"}`;

/** Every group of rooms the broker booked (0125), newest first. */
export function BrokerBookingsView({ data }: { data: BrokerBookingList }) {
  const router = useRouter();
  const booked = data.groups.filter((g) => g.status === "booked");
  const columns: DataColumn<BrokerBookingGroup>[] = [
    {
      id: "hotel",
      header: "Booking",
      cell: (g) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{g.hotel.name}</span>
          <span className="text-xs text-muted tabular">{g.reference}</span>
        </span>
      ),
      sortValue: (g) => g.hotel.name,
      isRowHeader: true,
    },
    { id: "dates", header: "Stay", cell: dates, sortValue: (g) => g.checkIn },
    {
      id: "rooms",
      header: "Rooms",
      cell: (g) => <span className="tabular">{g.rooms.length}</span>,
      sortValue: (g) => g.rooms.length,
      hideBelow: "lg",
    },
    {
      id: "total",
      header: "Total",
      align: "end",
      cell: (g) => <span className="tabular">{formatMoney(g.totalRwf)}</span>,
      sortValue: (g) => g.totalRwf,
      hideBelow: "lg",
    },
    {
      id: "yours",
      header: "Your commission",
      align: "end",
      cell: (g) =>
        g.status === "booked" ? <span className="tabular">{formatMoney(g.commission.brokerRwf)}</span> : "-",
      sortValue: (g) => g.commission.brokerRwf,
    },
    { id: "status", header: "Status", cell: (g) => <GroupChip status={g.status} /> },
  ];

  return (
    <PageContent>
      <PageHeader
        title="Bookings"
        description="The rooms you booked at hotels for your clients. Your commission is paid after each stay."
      />
      <KpiStrip
        label="Your bookings"
        items={[
          { id: "booked", label: "Booked", value: booked.length, format: "count", icon: "CircleCheck" },
          {
            id: "rooms",
            label: "Rooms booked",
            value: booked.reduce((s, g) => s + g.rooms.length, 0),
            format: "count",
            icon: "House",
          },
          {
            id: "commission",
            label: "Commission to come",
            value: booked.reduce((s, g) => s + g.commission.brokerRwf, 0),
            format: "money",
            icon: "Wallet",
          },
        ]}
      />
      <DataTable
        label="Bookings"
        rows={data.groups}
        rowKey={(g) => g.id}
        columns={columns}
        defaultSort={{ column: "dates", direction: "descending" }}
        rowActions={(g) => (
          <ActionButton size="sm" icon="Magnifier" onPress={() => router.push(`/broker/bookings/${g.id}`)}>
            Open
          </ActionButton>
        )}
        mobile={{
          title: (g) => g.hotel.name,
          description: dates,
          trailing: (g) => <GroupChip status={g.status} />,
        }}
        empty={
          <EmptyBlock
            icon="House"
            title="No bookings yet"
            description="Open a hotel you have a running deal with on Hotels, and book its rooms for your clients."
          />
        }
      />
    </PageContent>
  );
}

/** One group: its rooms and their bookings; while its MoMo prompt is out, it asks every few seconds. */
export function BrokerBookingView({ group: initial }: { group: BrokerBookingGroup }) {
  const [group, setGroup] = useState(initial);
  const waiting = group.status === "awaiting_payment";

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const result = await pollBooking(group.id);
      if (result.ok) setGroup(result.value);
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, group.id]);

  return (
    <PageContent>
      <PageHeader
        eyebrow={`Bookings · ${group.reference}`}
        title={group.hotel.name}
        description={`${dates(group)} · ${group.payment === "momo" ? "Paid by MoMo" : "Guests pay at the hotel"}`}
        actions={<GroupChip status={group.status} />}
      />
      <div className="flex max-w-[960px] flex-col gap-5">
        {waiting ? (
          <SectionCard title="Approve the payment on the phone">
            <p className="text-sm text-muted">
              A prompt for {formatMoney(group.totalRwf)} went to {group.attempt?.payerMasked ?? "the phone"}. Approve it
              there with the PIN. The rooms are confirmed as soon as it lands; this page updates by itself.
            </p>
          </SectionCard>
        ) : null}
        {group.status === "failed" ? (
          <SectionCard title="Nothing was booked">
            <p className="text-sm text-muted">
              {group.failureReason ?? group.attempt?.failureReason ?? "This booking did not go through."}
            </p>
          </SectionCard>
        ) : null}
        <KpiStrip
          label="This booking"
          items={[
            { id: "total", label: "Total", value: group.totalRwf, format: "money", icon: "Receipt" },
            {
              id: "commission",
              label: "Commission",
              value: group.commission.commissionRwf,
              format: "money",
              icon: "Sack",
            },
            {
              id: "yours",
              label: "Yours, after Injishi's 15%",
              value: group.commission.brokerRwf,
              format: "money",
              icon: "Wallet",
            },
          ]}
        />
        {group.commission.note ? <p className="text-sm text-muted">{group.commission.note}</p> : null}
        <SectionCard title={`${group.rooms.length} ${group.rooms.length === 1 ? "room" : "rooms"}`}>
          <ul className="flex flex-col divide-y divide-border">
            {group.rooms.map((r, i) => (
              <li
                key={`${r.roomTypeId}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.guestName}</span>
                  <span className="text-xs text-muted">
                    {r.roomTypeName} · {r.adults} {r.adults === 1 ? "adult" : "adults"}
                    {r.children ? `, ${r.children} ${r.children === 1 ? "child" : "children"}` : ""}
                    {r.guestPhone ? ` · ${r.guestPhone}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {r.booking ? <span className="tabular text-xs text-muted">{r.booking.reference}</span> : null}
                  <span className="tabular">{formatMoney(r.grossRwf)}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <p className="text-sm text-muted">
          The hotel calls {group.contactPhone} about this booking.{group.note ? ` Your note: “${group.note}”` : ""}
        </p>
      </div>
    </PageContent>
  );
}
