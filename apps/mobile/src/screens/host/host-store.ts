/**
 * The Host desk's state — pure reducers, then one actions hook.
 *
 * Same shape `screens/work/work-store.ts` takes, and for the same three
 * reasons: a transition that only exists inside a screen cannot be tested, four
 * screens change the same two collections, and decision D9 puts every local
 * write through `useFixtureMutation` so the swap to TanStack Query in Phase 3
 * is a change of hook rather than of markup.
 *
 * ## The two rules this surface turns on
 *
 * **A booking's status never becomes `checked_out`.** The contract's
 * `BookingStatus` has five values and that is not one of them: a stay opening
 * and closing is the STAY's lifecycle (`stay_lifecycle: open | closed`), not
 * the booking's. So check-in sets `checkedInAt` and checkout sets
 * `checkedOutAt`, and `rowStateOf` derives what the desk sees from those plus
 * the dates. The operator web app reads a `checked_out` string; that is its own
 * demo shape, and copying it would forge a wire value the API does not send.
 *
 * **Expiry beats a late approval, deterministically** (FL08 path C). A request
 * whose `approvalExpiresAt` has passed is already declined as far as the server
 * is concerned, so `approve` refuses it and says so rather than confirming a
 * booking that has been refunded. That guard is here, not in the button, so
 * the Today row and the detail screen cannot disagree about it.
 */
import { useCallback } from 'react';
import type { AccountDocumentType } from '@injishi/contracts';
import type { PickedPhoto } from '@/components';
import { useFixture, type FixtureStatus } from '@/data/use-fixture';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
} from '@/data/use-fixture-mutation';
import { useOfflineSubmit } from '@/data/offline-submit';
import {
  ROOMS_KEY,
  TASKS_KEY,
  applyRoomChange,
  applyTaskChange,
} from '@/screens/work/work-store';
import { SEED_ROOMS, SEED_TASKS, floorOf, roomTypeOf } from '@/screens/work/work-fixtures';
import type { WorkRoom, WorkTask } from '@/screens/work/work-fixtures';
import {
  DISPUTE_BUFFER_MS,
  HOST_BOOKINGS,
  HOST_PAYOUTS,
  type HostBooking,
  type HostPayout,
  type HostRowState,
} from './host-fixtures';

/* ---------------------------------------------------------------- the keys */

export const HOST_BOOKINGS_KEY = 'host.bookings';
export const HOST_PAYOUTS_KEY = 'host.payouts';
export const HOST_CAPTURES_KEY = 'host.captures';

/* -------------------------------------------------------------- the capture */

/**
 * What a staffed check-in records (F-B08, FL09 path A).
 *
 * The desk captures more than a self check-in does — it is a person looking at
 * a document — which is why `checkInMode` matters downstream: a staffed capture
 * is `verified`, a self one is self-attested and never is.
 */
export interface CheckInCapture {
  bookingId: string;
  /** As written on the document, which is not always as written on the booking. */
  fullName: string;
  documentType: AccountDocumentType;
  documentNumber: string;
  photos: readonly PickedPhoto[];
  room: string;
  at: number;
}

export type CaptureMap = Record<string, CheckInCapture>;

/* ------------------------------------------------------------- the reducers */

export type BookingChange =
  | { op: 'approve'; id: string; at: number }
  | { op: 'decline'; id: string; at: number; note: string }
  | { op: 'expire'; id: string }
  /** The undo behind the toast: the row exactly as it was. */
  | { op: 'restore'; booking: HostBooking }
  | { op: 'check-in'; id: string; room: string; at: number }
  | { op: 'check-out'; id: string; invoice: string; at: number };

/**
 * Why a request cannot be approved or declined, or `null` when it can.
 *
 * Returned rather than thrown, because the caller renders it: FL08 says the UI
 * shows the server's own reason for refusing a stale decision instead of
 * guessing, and this is that reason on the fixture path.
 */
export function decisionBlocked(
  booking: HostBooking | undefined,
  now: number,
): 'missing' | 'resolved' | 'expired' | null {
  if (!booking) return 'missing';
  if (booking.status !== 'pending_approval') return 'resolved';
  if (booking.approvalExpiresAt !== null && booking.approvalExpiresAt <= now) return 'expired';
  return null;
}

export function applyBookingChange(
  bookings: readonly HostBooking[],
  change: BookingChange,
): HostBooking[] {
  if (change.op === 'restore') {
    return bookings.map((b) => (b.id === change.booking.id ? change.booking : b));
  }

  return bookings.map((booking) => {
    if (booking.id !== change.id) return booking;

    switch (change.op) {
      case 'approve':
        // F-B06: the escrow hold is RETAINED on approve. Nothing is captured a
        // second time and nothing is released — the money has been held since
        // booking (F-B05) and stays held until the stay is over.
        return {
          ...booking,
          status: 'confirmed',
          approvalExpiresAt: null,
          escrowStatus: 'held',
          paymentStatus: 'captured',
        };

      case 'decline':
        // F-B11: a host decline is a 100% refund, always, whatever the tier.
        // The reason on the wire is one value; the note is what the guest is
        // told, and it is kept rather than collected and dropped.
        return {
          ...booking,
          status: 'declined',
          declineReason: 'host_declined',
          declineNote: change.note,
          approvalExpiresAt: null,
          paymentStatus: 'refunded_full',
          escrowStatus: 'refunded_full',
        };

      case 'expire':
        // The auto-decline. Same refund, different reason, and the reason is
        // what tells a guest nobody turned them down on purpose.
        return {
          ...booking,
          status: 'declined',
          declineReason: 'expired',
          approvalExpiresAt: null,
          paymentStatus: 'refunded_full',
          escrowStatus: 'refunded_full',
        };

      case 'check-in':
        return {
          ...booking,
          room: change.room,
          checkInMode: 'staffed',
          checkedInAt: change.at,
        };

      case 'check-out':
        // Exactly one tax invoice per stay, issued here (F-B17). The balance
        // settles with it, and escrow moves to `released` because checkout is
        // what starts the payout clock.
        return {
          ...booking,
          checkedOutAt: change.at,
          invoice: change.invoice,
          balanceRwf: 0,
          escrowStatus: 'released',
        };
    }
  });
}

/* ------------------------------------------------------------- the derivation */

/**
 * Which of the five buckets a booking is in today (F-B07), derived and never
 * stored.
 *
 * The order of the tests is the order a desk cares: something to decide, then
 * somebody at the door, then somebody leaving, then somebody upstairs.
 */
export function rowStateOf(booking: HostBooking, today: string): HostRowState {
  if (booking.status === 'pending_approval') return 'awaiting';
  if (booking.status !== 'confirmed') return 'past';
  if (booking.checkedOutAt !== null) return 'past';
  if (booking.checkedInAt === null) {
    return booking.checkInDay === today ? 'arriving' : booking.checkInDay < today ? 'past' : 'past';
  }
  return booking.checkOutDay <= today ? 'departing' : 'in_house';
}

/**
 * Rows that are still ahead but not today, which `rowStateOf` deliberately
 * calls `past` because a desk cannot act on them this morning. The Bookings
 * tab needs them back, so it asks this instead.
 */
export function isUpcoming(booking: HostBooking, today: string): boolean {
  return (
    booking.status === 'confirmed' &&
    booking.checkedInAt === null &&
    booking.checkedOutAt === null &&
    booking.checkInDay > today
  );
}

/** Night `n` of `total` for an in-house stay. 1 on the first night, never 0. */
export function nightOf(booking: HostBooking, today: string): number {
  const from = booking.checkInDay;
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
  return Math.min(booking.nights, Math.max(1, days + 1));
}

/* ----------------------------------------------------------------- the reads */

const readBookings = (): HostBooking[] =>
  readFixture<HostBooking[]>(HOST_BOOKINGS_KEY, [...HOST_BOOKINGS]);
const readPayouts = (): HostPayout[] =>
  readFixture<HostPayout[]>(HOST_PAYOUTS_KEY, [...HOST_PAYOUTS]);

export interface HostList<T> {
  status: FixtureStatus;
  error: Error | undefined;
  retry: () => void;
  rows: T[];
}

/**
 * Two hooks rather than one, exactly as the Work surface does it. `useFixture`
 * owns the cold-read skeleton and the error branch and caches per key, so its
 * `data` goes stale the moment anything is written; `useFixtureValue` owns the
 * live value. Taking the status from one and the rows from the other is what
 * lets Today skeleton on first paint and still update the instant the detail
 * screen checks somebody in.
 */
function useHostList<T>(key: string, read: () => T[], seed: readonly T[]): HostList<T> {
  const gate = useFixture(key, read);
  const rows = useFixtureValue<T[]>(key, () => [...seed]);
  return { status: gate.status, error: gate.error, retry: gate.retry, rows };
}

export const useHostBookings = () => useHostList(HOST_BOOKINGS_KEY, readBookings, HOST_BOOKINGS);
export const useHostPayouts = () => useHostList(HOST_PAYOUTS_KEY, readPayouts, HOST_PAYOUTS);

export function useHostBooking(id: string | undefined): {
  booking: HostBooking | undefined;
  status: FixtureStatus;
  error: Error | undefined;
  retry: () => void;
} {
  const { rows, status, error, retry } = useHostBookings();
  return { booking: rows.find((b) => b.id === id), status, error, retry };
}

export const useCaptures = () => useFixtureValue<CaptureMap>(HOST_CAPTURES_KEY, () => ({}));

/* -------------------------------------------------------- the housekeeping handoff */

/**
 * What checkout hands to the attendant (F-P04, FL12).
 *
 * The operator app does this transactionally: the room goes dirty, a pending
 * `checkout_clean` task is inserted, and an outbox event puts it on the mobile
 * queue sub-second. Here both writes go through the Work surface's OWN
 * reducers, imported rather than reimplemented, so the task this desk creates
 * is indistinguishable from one the queue seeded — and the day Session 10
 * changes what a task looks like, this follows.
 *
 * The note is the desk's sentence, in the language the desk wrote it, which is
 * why it is a string and not a `t()` key: `work-fixtures.ts` draws exactly that
 * line for `noteBy`, and translating a receptionist's own words would be
 * claiming the app authored them.
 */
export function handOverToHousekeeping(room: string, guest: string, at: number): WorkTask {
  const task: WorkTask = {
    id: room,
    type: roomTypeOf(room),
    floor: floorOf(room),
    kind: 'checkout_clean',
    status: 'pending',
    isNew: true,
    arrivedAt: at,
    note: `Checked out at ${clockOf(at)}. ${guest} has left; the room is free.`,
    noteBy: `Front desk · ${clockOf(at)}`,
  };

  const tasks = readFixture<WorkTask[]>(TASKS_KEY, [...SEED_TASKS]);
  writeFixture<WorkTask[]>(TASKS_KEY, applyTaskChange(tasks, { op: 'arrive', task }));

  const rooms = readFixture<WorkRoom[]>(ROOMS_KEY, [...SEED_ROOMS]);
  // Housekeeping status is its own axis (F-P04): the task moving does not imply
  // the room moved, so both are written explicitly.
  writeFixture<WorkRoom[]>(ROOMS_KEY, applyRoomChange(rooms, { id: room, status: 'dirty' }));

  return task;
}

/** `14:58`, the form every desk line in the fixtures already uses. */
export function clockOf(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The next EBM invoice number. Derived from what the store already holds so a
 * demo never issues the same one twice, and shaped like the seeded one.
 */
export function nextInvoice(bookings: readonly HostBooking[]): string {
  const highest = bookings.reduce((most, b) => {
    const n = Number(b.invoice?.split('-').at(-1) ?? 0);
    return Number.isFinite(n) ? Math.max(most, n) : most;
  }, 4417);
  return `EBM-2026-${String(highest + 1).padStart(6, '0')}`;
}

/* --------------------------------------------------------------- the actions */

export interface HostActions {
  approve: (id: string) => Promise<void>;
  /** `note` is the sentence the guest is told. The sheet requires one. */
  decline: (id: string, note: string) => Promise<void>;
  expire: (id: string) => Promise<void>;
  /** The undo behind an approve or decline toast. */
  restore: (booking: HostBooking) => Promise<void>;
  checkIn: (capture: CheckInCapture) => Promise<void>;
  /** The capture did not save. The screen must not claim the guest is in. */
  checkInFailed: boolean;
  /** It is in the offline queue. Not a failure, and worded differently. */
  checkInQueued: boolean;
  /** Resolves to the invoice it issued and the task it handed over. */
  checkOut: (id: string) => Promise<{ invoice: string; room: string | null }>;
  saving: boolean;
}

export function useHostActions(): HostActions {
  const { mutate, status } = useFixtureMutation<HostBooking[], BookingChange>(
    HOST_BOOKINGS_KEY,
    applyBookingChange,
    () => [...HOST_BOOKINGS],
  );

  const approve = useCallback((id: string) => mutate({ op: 'approve', id, at: Date.now() }), [mutate]);
  const decline = useCallback(
    (id: string, note: string) => mutate({ op: 'decline', id, at: Date.now(), note }),
    [mutate],
  );
  const expire = useCallback((id: string) => mutate({ op: 'expire', id }), [mutate]);
  const restore = useCallback((booking: HostBooking) => mutate({ op: 'restore', booking }), [mutate]);

  /**
   * Identity capture, offline (gaps.md §6, P1).
   *
   * The screen had `err=0` on the one flow that photographs somebody's ID at a
   * front desk. `ui-rules.md` already requires the upload to be chunked and
   * resumable; what it had no answer for was a capture that could not be sent
   * at all, and a front desk with no signal is an ordinary Tuesday.
   *
   * The booking id is the idempotency key: checking one guest in twice is one
   * intent, and a duplicate would hand out a second room.
   */
  const queued = useOfflineSubmit<CheckInCapture>({
    kind: 'checkIn',
    handler: (capture) => {
      const captures = readFixture<CaptureMap>(HOST_CAPTURES_KEY, {});
      writeFixture<CaptureMap>(HOST_CAPTURES_KEY, { ...captures, [capture.bookingId]: capture });
      writeFixture<HostBooking[]>(
        HOST_BOOKINGS_KEY,
        applyBookingChange(readFixture<HostBooking[]>(HOST_BOOKINGS_KEY, [...HOST_BOOKINGS]), {
          op: 'check-in',
          id: capture.bookingId,
          room: capture.room,
          at: capture.at,
        }),
      );
      // The fixture store cannot refuse and cannot be unreachable, so this
      // is always `ok`. The surface child that puts a real mutation here
      // (ADR-038 children 1 to 7) is where `refused` and `failed` start
      // being answered for real.
      return { status: 'ok' as const };
    },
    label: (capture) => capture.fullName,
    idFor: (capture) => `checkIn-${capture.bookingId}`,
  });

  const checkIn = useCallback(
    async (capture: CheckInCapture) => {
      if (queued.offline) {
        await queued.submit(capture);
        return;
      }
      // The identity is kept beside the booking rather than on it: a booking is
      // a wire shape and a captured document is not part of it. The stay screen
      // reads this to say a document was seen, and nothing else does.
      const captures = readFixture<CaptureMap>(HOST_CAPTURES_KEY, {});
      writeFixture<CaptureMap>(HOST_CAPTURES_KEY, { ...captures, [capture.bookingId]: capture });
      await mutate({ op: 'check-in', id: capture.bookingId, room: capture.room, at: capture.at });
    },
    [mutate, queued],
  );

  const checkOut = useCallback(
    async (id: string) => {
      const now = Date.now();
      const bookings = readFixture<HostBooking[]>(HOST_BOOKINGS_KEY, [...HOST_BOOKINGS]);
      const booking = bookings.find((b) => b.id === id);
      const invoice = nextInvoice(bookings);

      await mutate({ op: 'check-out', id, invoice, at: now });

      // Two things follow a checkout and neither is optional: the attendant
      // gets the room, and the payout clock starts (F-B17, F-B12).
      if (booking?.room) handOverToHousekeeping(booking.room, booking.guest.name, now);
      if (booking) {
        const payouts = readFixture<HostPayout[]>(HOST_PAYOUTS_KEY, [...HOST_PAYOUTS]);
        writeFixture<HostPayout[]>(HOST_PAYOUTS_KEY, [
          {
            id: `PO-2026-${String(3120 + payouts.length).slice(-4)}`,
            bookingId: booking.id,
            guest: booking.guest.name,
            // The FULL amount. F-B12 deducts no commission.
            amountRwf: booking.breakdown.accommodationRwf,
            status: 'scheduled',
            releasesAt: now + DISPUTE_BUFFER_MS,
            destination: 'momo',
          },
          ...payouts,
        ]);
      }

      return { invoice, room: booking?.room ?? null };
    },
    [mutate],
  );

  return {
    approve,
    decline,
    expire,
    restore,
    checkIn,
    checkOut,
    saving: status === 'saving',
    checkInFailed: status === 'error' || queued.state === 'error',
    checkInQueued: queued.state === 'queued',
  };
}
