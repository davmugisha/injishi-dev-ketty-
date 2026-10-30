"use client";

import { FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatMoney,
  formatNumber,
  formatPhone,
  IconAction,
  KeyValueList,
  Money,
  PageContent,
  PersonCell,
  RowActions,
  SidePanel,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import {
  approveBookingRequest,
  cancelBooking,
  declineBookingRequest,
  recordNoShow,
} from "@/features/pms/front-desk-actions";
import type { BookingRow, BookingState } from "@/server/stays/desk";

const STATE: Record<BookingState, { label: string; tone: StatusTone }> = {
  pending: { label: "Request", tone: "warning" },
  confirmed: { label: "Booked", tone: "info" },
  inhouse: { label: "In house", tone: "success" },
  checked_out: { label: "Left", tone: "default" },
  declined: { label: "Declined", tone: "default" },
  cancelled: { label: "Cancelled", tone: "default" },
  no_show: { label: "No show", tone: "danger" },
};

type Asking = { kind: "cancel" | "no_show"; booking: BookingRow } | null;

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
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = rows.find((r) => r.id === openId) ?? null;

  const close = () => {
    setOpenId(null);
    if (openRef) router.replace(pathname, { scroll: false });
  };

  const run = (call: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await call();
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(done);
      setAsking(null);
      setReason("");
      router.refresh();
    });

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

      {open ? (
        <SidePanel
          isOpen
          onOpenChange={(o) => (o ? undefined : close())}
          title={open.guest}
          description={open.reference}
          headerExtra={<StatusChip tone={STATE[open.state].tone}>{STATE[open.state].label}</StatusChip>}
          footer={
            <>
              {open.state === "pending" && can.approve ? (
                <>
                  <ActionButton
                    intent="danger-soft"
                    isDisabled={pending}
                    onPress={() => run(() => declineBookingRequest(open.reference), "Request declined")}
                  >
                    Decline
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    icon="CircleCheck"
                    isPending={pending}
                    onPress={() => run(() => approveBookingRequest(open.reference), "Booking accepted")}
                  >
                    Accept
                  </ActionButton>
                </>
              ) : null}
              {open.state === "confirmed" && can.approve ? (
                <>
                  {open.checkIn <= today ? (
                    <ActionButton intent="ghost" onPress={() => setAsking({ kind: "no_show", booking: open })}>
                      No show
                    </ActionButton>
                  ) : null}
                  <ActionButton intent="danger-soft" onPress={() => setAsking({ kind: "cancel", booking: open })}>
                    Cancel booking
                  </ActionButton>
                </>
              ) : null}
              {open.state === "confirmed" && can.checkIn && open.checkIn <= today ? (
                <ActionLink
                  href={`${screenHref("CheckIn")}?booking=${encodeURIComponent(open.reference)}`}
                  icon="ArrowRightToSquare"
                  intent="primary"
                >
                  Check in
                </ActionLink>
              ) : null}
              {open.stayRef ? (
                <ActionLink href={`/stays/${encodeURIComponent(open.stayRef)}`} icon="Receipt" intent="primary">
                  Open the bill
                </ActionLink>
              ) : null}
            </>
          }
        >
          <KeyValueList
            items={[
              {
                label: "Dates",
                value: `${formatDay(open.checkIn, "long")} to ${formatDay(open.checkOut, "long")}`,
              },
              { label: "Nights", value: formatNumber(open.nights) },
              { label: "Guests", value: formatNumber(open.guests) },
              { label: "Room", value: open.room ? `${open.room} (${open.roomType})` : open.roomType },
              ...(open.phone ? [{ label: "Phone", value: formatPhone(open.phone) }] : []),
              { label: "Channel", value: open.channel },
              ...(open.eta ? [{ label: "Arrives", value: open.eta }] : []),
              { label: "Total", value: <Money value={open.totalRwf} /> },
              { label: "Paid", value: <Money value={open.paidRwf} /> },
            ]}
          />
          {open.guestMessage ? (
            <blockquote className="rounded-xl bg-default/60 px-3 py-2 text-sm">{open.guestMessage}</blockquote>
          ) : null}
          {open.state === "pending" && open.approvalExpiresAt ? (
            <p className="text-xs text-muted">Answer by {formatDay(open.approvalExpiresAt.slice(0, 10), "long")}.</p>
          ) : null}
        </SidePanel>
      ) : null}

      <FormDialog
        isOpen={asking !== null}
        onOpenChange={(o) => (o ? undefined : setAsking(null))}
        title={asking?.kind === "no_show" ? "Mark a no show?" : "Cancel this booking?"}
        size="sm"
        submitLabel={asking?.kind === "no_show" ? "Mark no show" : "Cancel booking"}
        isPending={pending}
        footerHint={(() => {
          const q = asking ? (asking.kind === "no_show" ? asking.booking.noShow : asking.booking.cancellation) : null;
          return q ? `Refund ${formatMoney(q.refundRwf)}, kept ${formatMoney(q.keptRwf)}.` : undefined;
        })()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!asking) return;
          if (!reason.trim()) {
            setReasonError("Say why.");
            return;
          }
          const ref = asking.booking.reference;
          if (asking.kind === "no_show") run(() => recordNoShow(ref, reason.trim()), "Marked as a no show");
          else run(() => cancelBooking(ref, reason.trim()), "Booking cancelled");
        }}
      >
        <TextField
          name="reason"
          isRequired
          value={reason}
          onChange={(v) => {
            setReason(v);
            setReasonError(null);
          }}
          isInvalid={reasonError !== null}
        >
          <Label>Reason</Label>
          <TextArea rows={2} />
          <FieldError>{reasonError}</FieldError>
        </TextField>
      </FormDialog>
    </PageContent>
  );
}
