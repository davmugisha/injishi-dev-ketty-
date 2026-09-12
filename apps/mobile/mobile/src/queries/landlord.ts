/**
 * Landlord reads, against the real API.
 *
 * ADR-038 child 0 task 9: the tracer. The rent roll is the one screen this
 * child rebinds, and it was chosen because `GET /api/v1/ops/rent-roll` already
 * exists and already returns substantially the right shape — so this tests the
 * SEAM rather than testing a new endpoint through the seam.
 *
 * `x-workspace-id` is not passed from here and could not be: `api.ts` attaches
 * it from the active workspace, and a call site that could name a workspace is
 * a call site that could name the wrong one.
 */
import type { OperatorRentCharge, OperatorRentRoll } from '@injishi/contracts';

import { api, unwrap } from '../lib/api';
import { ENDPOINTS } from '../lib/endpoints';
import type { RentRow } from '../data/landlord';

/**
 * Initials for the avatar, from the name the server sent.
 *
 * Presentation, not data: the API has no opinion about initials and should not
 * grow one. Two letters at most, because the circle only fits two.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** `2026-08-05` → `Aug 05`, for the chip. Undefined when there is no date. */
function shortDate(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('en-GB', { month: 'short', day: '2-digit' });
}

/**
 * How many whole days past its due date an overdue charge is.
 *
 * Both sides are floored to a UTC calendar day before subtracting, so the
 * answer is a count of DATES and not of elapsed hours. Without that, a charge
 * due yesterday evening reads as "0 days" until the same time today, which is
 * the kind of off-by-one that only ever shows up in a demo.
 *
 * The comparison is deliberately made against the device's idea of now. It is
 * what the person holding the phone means by "today", and the server does not
 * send a lateness count to defer to.
 */
function daysLate(dueDate: string | null): number | undefined {
  if (!dueDate) return undefined;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return undefined;

  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dueUtc = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );

  const late = Math.floor((todayUtc - dueUtc) / dayMs);
  return late > 0 ? late : undefined;
}

/**
 * The server's charge, in the shape the screen already draws.
 *
 * The screen keeps its own row type for now. ADR-038 cuts a surface over whole
 * in its own child, and rebinding every landlord component to the contract type
 * belongs to child 1, not to the tracer.
 *
 * `mock` is never set here. It marks a payment recorded through the mock
 * adapter during this session, and a row read back from the database is not
 * that, whatever produced it earlier — a mocked success must never look real,
 * and a real one must not be labelled mocked.
 */
export function toRentRow(charge: OperatorRentCharge): RentRow {
  const name = charge.tenantName ?? 'Unnamed tenant';
  return {
    leaseId: charge.leaseId,
    initials: initialsOf(name),
    name,
    unit: charge.unitLabel ?? '—',
    // Integer RWF, straight from the server. Never recomputed on the client.
    amount: charge.amountRwf ?? 0,
    state: charge.status,
    on: shortDate(charge.status === 'paid' ? charge.paidAt : charge.dueDate),
    days: charge.status === 'overdue' ? daysLate(charge.dueDate) : undefined,
  };
}

/** Every rent charge for the active workspace. */
export async function fetchRentRoll(signal?: AbortSignal): Promise<RentRow[]> {
  const roll = await unwrap(
    api<OperatorRentRoll>(ENDPOINTS.opsRentRoll, { signal }),
  );
  return roll.charges.map(toRentRow);
}
