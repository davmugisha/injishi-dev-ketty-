"use client";

import { FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  FormDialog,
  formatDay,
  formatMoney,
  formatNumber,
  formatPhone,
  KeyValueList,
  Money,
  SidePanel,
  StatusChip,
  type StatusTone,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveBookingRequest,
  cancelBooking,
  declineBookingRequest,
  recordNoShow,
} from "@/features/pms/front-desk-actions";

/** Where a booking or stay stands, as the panel acts on it. */
export type PanelState = "pending" | "confirmed" | "inhouse" | "left" | "closed";

export const PANEL_STATUS: Record<PanelState, { label: string; tone: StatusTone }> = {
  pending: { label: "Request", tone: "warning" },
  confirmed: { label: "Booked", tone: "info" },
  inhouse: { label: "In house", tone: "success" },
  left: { label: "Left", tone: "default" },
  closed: { label: "Closed", tone: "default" },
};

type Quote = { refundRwf: number; keptRwf: number; rule: string } | null;

/** One booking or stay, as the side panel shows it. */
export interface PanelStay {
  guest: string;
  /** The booking's reference; null for a walk in. */
  reference: string | null;
  /** The stay's reference, once checked in: its bill. */
  stayRef: string | null;
  state: PanelState;
  /** Overrides the state's chip words ("No show", "Cancelled"). */
  status?: { label: string; tone: StatusTone };
  checkIn: string;
  checkOut: string;
  guests: number | null;
  room: string | null;
  roomType: string;
  phone: string | null;
  channel?: string | null;
  eta?: string | null;
  totalRwf: number | null;
  paidRwf: number | null;
  /** Still owed on the bill. */
  balanceRwf?: number | null;
  guestMessage?: string | null;
  approvalExpiresAt?: string | null;
  cancellation: Quote;
  noShow?: Quote;
}

const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));

/**
 * A booking or a stay beside the page, with its next steps: answer a request, check in, check out, open
 * the bill, cancel (refunded on its policy) or mark a no show. The Bookings table and the calendar share it.
 */
export function BookingPanel({
  stay,
  today,
  can,
  onClose,
}: {
  stay: PanelStay | null;
  today: string;
  can: { approve: boolean; checkIn: boolean };
  onClose: () => void;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<"cancel" | "no_show" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
      onClose();
      router.refresh();
    });

  if (!stay) return null;
  const status = stay.status ?? PANEL_STATUS[stay.state];
  const ref = stay.reference;
  const bill = stay.stayRef ? `/stays/${encodeURIComponent(stay.stayRef)}` : null;
  const quote = asking === "no_show" ? (stay.noShow ?? null) : asking === "cancel" ? stay.cancellation : null;

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(o) => (o ? undefined : onClose())}
        title={stay.guest}
        description={ref ?? "Walk in"}
        headerExtra={<StatusChip tone={status.tone}>{status.label}</StatusChip>}
        footer={
          <>
            {stay.state === "pending" && can.approve && ref ? (
              <>
                <ActionButton
                  intent="danger-soft"
                  isDisabled={pending}
                  onPress={() => run(() => declineBookingRequest(ref), "Request declined")}
                >
                  Decline
                </ActionButton>
                <ActionButton
                  intent="primary"
                  icon="CircleCheck"
                  isPending={pending}
                  onPress={() => run(() => approveBookingRequest(ref), "Booking accepted")}
                >
                  Accept
                </ActionButton>
              </>
            ) : null}
            {stay.state === "confirmed" && can.approve && ref ? (
              <>
                {stay.checkIn <= today ? (
                  <ActionButton intent="ghost" onPress={() => setAsking("no_show")}>
                    No show
                  </ActionButton>
                ) : null}
                <ActionButton intent="danger-soft" onPress={() => setAsking("cancel")}>
                  Cancel booking
                </ActionButton>
              </>
            ) : null}
            {stay.state === "confirmed" && can.checkIn && ref && stay.checkIn <= today ? (
              <ActionLink
                href={`${screenHref("CheckIn")}?booking=${encodeURIComponent(ref)}`}
                icon="ArrowRightToSquare"
                intent="primary"
              >
                Check in
              </ActionLink>
            ) : null}
            {stay.state === "inhouse" && bill ? (
              <>
                <ActionLink href={bill} icon="Receipt">
                  Open the bill
                </ActionLink>
                <ActionLink href={bill} icon="ArrowRightFromSquare" intent="primary">
                  Check out
                </ActionLink>
              </>
            ) : null}
            {stay.state !== "inhouse" && bill ? (
              <ActionLink href={bill} icon="Receipt" intent="primary">
                Open the bill
              </ActionLink>
            ) : null}
          </>
        }
      >
        <KeyValueList
          items={[
            { label: "Dates", value: `${formatDay(stay.checkIn, "long")} to ${formatDay(stay.checkOut, "long")}` },
            { label: "Nights", value: formatNumber(nightsBetween(stay.checkIn, stay.checkOut)) },
            ...(stay.guests ? [{ label: "Guests", value: formatNumber(stay.guests) }] : []),
            { label: "Room", value: stay.room ? `${stay.room} (${stay.roomType})` : `${stay.roomType}, no room yet` },
            ...(stay.phone ? [{ label: "Phone", value: formatPhone(stay.phone) }] : []),
            ...(stay.channel ? [{ label: "Channel", value: stay.channel }] : []),
            ...(stay.eta ? [{ label: "Arrives", value: stay.eta }] : []),
            ...(stay.totalRwf != null ? [{ label: "Total", value: <Money value={stay.totalRwf} /> }] : []),
            ...(stay.paidRwf != null ? [{ label: "Paid", value: <Money value={stay.paidRwf} /> }] : []),
            ...(stay.state === "inhouse" && stay.balanceRwf != null
              ? [{ label: "Owed", value: <Money value={stay.balanceRwf} /> }]
              : []),
          ]}
        />
        {stay.guestMessage ? (
          <blockquote className="rounded-[var(--inner-radius)] bg-default/60 px-3 py-2 text-sm">
            {stay.guestMessage}
          </blockquote>
        ) : null}
        {stay.state === "pending" && stay.approvalExpiresAt ? (
          <p className="text-xs text-muted">Answer by {formatDay(stay.approvalExpiresAt.slice(0, 10), "long")}.</p>
        ) : null}
      </SidePanel>

      <FormDialog
        isOpen={asking !== null}
        onOpenChange={(o) => (o ? undefined : setAsking(null))}
        title={asking === "no_show" ? "Mark a no show?" : "Cancel this booking?"}
        size="sm"
        submitLabel={asking === "no_show" ? "Mark no show" : "Cancel booking"}
        isPending={pending}
        footerHint={quote ? `Refund ${formatMoney(quote.refundRwf)}, kept ${formatMoney(quote.keptRwf)}.` : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (!asking || !ref) return;
          if (!reason.trim()) {
            setReasonError("Say why.");
            return;
          }
          if (asking === "no_show") run(() => recordNoShow(ref, reason.trim()), "Marked as a no show");
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
    </>
  );
}
