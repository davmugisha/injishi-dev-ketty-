import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  bookings,
  escrows,
  orgs,
  payoutAccounts,
  payouts,
  workspaces,
} from '../../../database/drizzle/schema';
import { destinationOf } from '../../rentals/domain/payout-accounts';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** Why a host payout waits: the same words a landlord's rent payout uses. */
export const NO_PAYOUT_ACCOUNT_REASON = 'No payout account is set up. Add one under Getting paid.';

export interface CompletedStay {
  bookingId: string;
  reference: string;
  /** Null when the booking held no escrow to release (a walk in, a refunded stay). */
  payout: { id: string; amountRwf: number; status: 'queued' | 'held'; destinationMasked: string | null } | null;
}

/**
 * The end of a booked stay, in one transaction (0116): the booking is marked
 * completed, its escrow is released, and what the guest paid becomes one
 * payout to the business's primary payout account. Held, with the reason, when
 * the business has none; the payouts pass (`PayoutsService.sweep`) sends a
 * queued one and releases a held one once an account is added.
 *
 * Injishi takes no commission, so the payout is the whole escrow.
 */
@Injectable()
export class StayCompletionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async complete(bookingId: string, now: Date = new Date()): Promise<CompletedStay | null> {
    return this.db.transaction(async (tx) => {
      // Guarded: a second checkout, or a booking that is not a live stay, moves nothing.
      const [booking] = await tx
        .update(bookings)
        .set({ completedAt: now, updatedAt: now })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed'), isNull(bookings.completedAt)))
        .returning({ id: bookings.id, reference: bookings.reference, workspaceId: bookings.workspaceId });
      if (!booking) return null;

      const [escrow] = await tx
        .select({ id: escrows.id, amountRwf: escrows.amountRwf })
        .from(escrows)
        .where(and(eq(escrows.bookingId, bookingId), eq(escrows.status, 'held')))
        .for('update')
        .limit(1);
      const amountRwf = Number(escrow?.amountRwf ?? 0);
      if (!escrow || amountRwf <= 0) return { bookingId, reference: booking.reference, payout: null };

      await tx.update(escrows).set({ status: 'released', updatedAt: now }).where(eq(escrows.id, escrow.id));

      const [org] = await tx
        .select({ orgId: orgs.id, legalName: orgs.legalName })
        .from(workspaces)
        .innerJoin(orgs, eq(orgs.id, workspaces.orgId))
        .where(eq(workspaces.id, booking.workspaceId))
        .limit(1);
      const [account] = org
        ? await tx
            .select()
            .from(payoutAccounts)
            .where(
              and(
                eq(payoutAccounts.orgId, org.orgId),
                eq(payoutAccounts.isPrimary, true),
                eq(payoutAccounts.status, 'active'),
              ),
            )
            .limit(1)
        : [];

      const status = account ? ('queued' as const) : ('held' as const);
      const destinationMasked = account ? destinationOf(account) : null;
      const [payout] = await tx
        .insert(payouts)
        .values({
          workspaceId: booking.workspaceId,
          payeeType: 'host',
          source: 'booking',
          status,
          amountRwf,
          idempotencyKey: `${booking.workspaceId}:payout:booking:${bookingId}`,
          payoutAccountId: account?.id ?? null,
          destination: account ? (account.kind === 'bank' ? 'bank' : account.kind === 'momo' ? 'momo' : 'momo_pay') : null,
          destinationMasked,
          payeeName: org?.legalName ?? null,
          failureReason: account ? null : NO_PAYOUT_ACCOUNT_REASON,
          scheduledReleaseAt: now,
          note: `Booking ${booking.reference}`,
        })
        .onConflictDoNothing({ target: payouts.idempotencyKey })
        .returning({ id: payouts.id });

      return {
        bookingId,
        reference: booking.reference,
        payout: payout ? { id: payout.id, amountRwf, status, destinationMasked } : null,
      };
    });
  }

  /** Has this booking's stay been completed? For a check out that lost a race. */
  async isCompleted(bookingId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ done: sql<boolean>`${bookings.completedAt} is not null` })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row?.done === true;
  }
}
