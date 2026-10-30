import type { DocumentType } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  escrows,
  folioCharges,
  folios,
  guestStays,
  properties,
  rooms,
  stayIdentities,
  stayRefundRequests,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { withFreshClaimCode } from '../domain/stay-claim';

/** The facts the invitation mail needs, gathered in one read. */
export interface StayInvitationFacts {
  stayId: string;
  workspaceId: string;
  propertyName: string | null;
  roomLabel: string | null;
  guestName: string | null;
  email: string | null;
  claimCode: string | null;
  claimStatus: 'unclaimed' | 'claimed';
  claimInvitedAt: Date | null;
}

/** One stay as its own guest reads it, with the money facts a refund needs. */
export interface MyStayRow {
  id: string;
  bookingId: string | null;
  bookingReference: string | null;
  propertyId: string | null;
  propertyName: string | null;
  roomLabel: string | null;
  lifecycle: 'open' | 'closed';
  checkInMode: 'staffed' | 'self';
  entryAt: Date;
  plannedExitAt: Date | null;
  actualExitAt: Date | null;
  workspaceId: string;
  folioId: string | null;
  balanceRwf: number | null;
  paidRwf: number;
  openRefundRequestId: string | null;
  /** The commercial terms a refund is judged against. Null for a walk in. */
  nonRefundable: boolean;
  cancellationTier: string | null;
  nightlyRateRwf: number | null;
  checkIn: string | null;
  checkOut: string | null;
}

/**
 * BINDING A DESK-REGISTERED STAY TO A PERSON (§6.8).
 *
 * The one place the claim code is written, read and spent, plus the guest-side
 * read of "which stays are mine".
 *
 * ## Why a guest's stay read lives here and not in `FrontDeskRepository`
 *
 * Every read in that repository is WORKSPACE scoped — it is the desk's view and
 * `WorkspaceGuard` has already proved the caller holds the property. A guest
 * holds no workspace, so every read here is keyed on the PERSON instead, and
 * borrowing the desk's queries for a guest is exactly how one hotel's stay list
 * ends up answering another hotel's guest. The same split `GuestOrderingRepository`
 * makes, for the same reason.
 */
@Injectable()
export class StayClaimRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Record what the desk typed on the registration card.
   *
   * The contact goes on the stay and the identity goes in `stay_identities`,
   * which already existed and which nothing on the check in path ever wrote:
   * the table was reachable only through the uploads route that attaches an ID
   * photo, so a desk that typed a passport number had nowhere to put it.
   *
   * ONE TRANSACTION, and an upsert on the identity: a desk correcting a
   * mistyped document number a minute later must not create a second identity
   * row for one stay (the table's unique on `guest_stay_id` would refuse it,
   * with a 500 in front of the guest).
   *
   * A field that was not sent is LEFT ALONE, never nulled. The desk screen
   * sends what it has; a PATCH that blanked the address because this form did
   * not carry one would quietly delete what the last form captured.
   */
  async recordRegistration(input: {
    stayId: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    documentType?: DocumentType | null;
    idNumber?: string | null;
    addressText?: string | null;
  }): Promise<void> {
    const contact: Record<string, unknown> = {};
    if (input.email !== undefined && input.email !== null) {
      contact.guestEmail = input.email.trim().toLowerCase();
    }
    if (input.phone !== undefined && input.phone !== null) {
      contact.guestPhone = input.phone.trim();
    }

    const identity = {
      fullName: input.fullName?.trim() ?? null,
      idNumber: input.idNumber?.trim() ?? null,
      documentType: input.documentType ?? null,
      addressText: input.addressText?.trim() ?? null,
    };
    const hasIdentity = Object.values(identity).some((v) => v !== null);

    if (Object.keys(contact).length === 0 && !hasIdentity) return;

    await this.db.transaction(async (tx) => {
      if (Object.keys(contact).length > 0) {
        await tx
          .update(guestStays)
          .set({ ...contact, updatedAt: new Date() })
          .where(eq(guestStays.id, input.stayId));
      }
      if (!hasIdentity) return;

      // `onConflictDoUpdate` over the table's own unique on the stay. Only the
      // fields that were sent are overwritten; `coalesce(excluded, existing)`
      // is what keeps a second, partial form from blanking the first.
      await tx
        .insert(stayIdentities)
        .values({ guestStayId: input.stayId, ...identity })
        .onConflictDoUpdate({
          target: stayIdentities.guestStayId,
          set: {
            fullName: sql`coalesce(excluded.full_name, ${stayIdentities.fullName})`,
            idNumber: sql`coalesce(excluded.id_number, ${stayIdentities.idNumber})`,
            documentType: sql`coalesce(excluded.document_type, ${stayIdentities.documentType})`,
            addressText: sql`coalesce(excluded.address_text, ${stayIdentities.addressText})`,
          },
        });
    });
  }

  /**
   * Make sure this stay has a claim code, and hand it back.
   *
   * `reissue` mints a new one and invalidates the slip already printed, which
   * is the "I lost it" and "it will not work" case. Without it, an existing
   * code is returned unchanged, so a desk pressing "send again" does not
   * silently break a code the guest is halfway through typing.
   *
   * REFUSES A CLAIMED STAY by answering null. A new code on a claimed stay is a
   * second key to somebody else's record, which is the same rule the admin
   * console's reissue already enforces.
   *
   * IT ALSO REFUSES A STAY THAT ALREADY HAS AN ACCOUNT ON IT. A guest who
   * booked online is checked in with `guest_user_id` set, so the stay already
   * resolves to them on every guest-side read and there is nothing to claim.
   * Minting a code for one would be issuing a bearer credential to a record
   * that does not need one — a second, weaker way into a stay whose owner is
   * already known.
   */
  async ensureClaimCode(
    stayId: string,
    options: { reissue?: boolean } = {},
  ): Promise<string | null> {
    const [current] = await this.db
      .select({
        claimCode: guestStays.claimCode,
        claimStatus: guestStays.claimStatus,
        guestUserId: guestStays.guestUserId,
      })
      .from(guestStays)
      .where(eq(guestStays.id, stayId))
      .limit(1);
    if (!current || current.claimStatus !== 'unclaimed') return null;
    if (current.guestUserId !== null) return null;
    if (current.claimCode && !options.reissue) return current.claimCode;

    return withFreshClaimCode(async (code) => {
      const [updated] = await this.db
        .update(guestStays)
        .set({ claimCode: code, updatedAt: new Date() })
        .where(
          and(
            eq(guestStays.id, stayId),
            // Guarded on unclaimed, so a guest redeeming the OLD code at this
            // instant either lands before this (and we find the stay claimed on
            // the next read) or after (and the old code no longer exists).
            eq(guestStays.claimStatus, 'unclaimed'),
          ),
        )
        .returning({ claimCode: guestStays.claimCode });
      return updated?.claimCode ?? null;
    });
  }

  /** Everything the mail needs, and everything the desk is answered with. */
  async invitationFacts(stayId: string): Promise<StayInvitationFacts | null> {
    const [row] = await this.db
      .select({
        stayId: guestStays.id,
        workspaceId: guestStays.workspaceId,
        propertyName: properties.name,
        roomLabel: rooms.label,
        guestName: sql<
          string | null
        >`coalesce(${users.name}, ${guestStays.guestName})`,
        email: sql<
          string | null
        >`coalesce(${users.email}, ${guestStays.guestEmail})`,
        claimCode: guestStays.claimCode,
        claimStatus: guestStays.claimStatus,
        claimInvitedAt: guestStays.claimInvitedAt,
      })
      .from(guestStays)
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(users, eq(users.id, guestStays.guestUserId))
      .where(eq(guestStays.id, stayId))
      .limit(1);
    return row ?? null;
  }

  async markInvited(stayId: string, at: Date): Promise<void> {
    await this.db
      .update(guestStays)
      .set({ claimInvitedAt: at, updatedAt: new Date() })
      .where(eq(guestStays.id, stayId));
  }

  /**
   * SPEND A CLAIM CODE: bind the stay to this person, once.
   *
   * The update is the whole authorization. It is guarded on the code AND on the
   * stay still being unclaimed, so two people racing on one code produce one
   * winner and one `null`; and the code is CLEARED in the same statement, so a
   * slip photographed in a lobby is worth nothing the moment it is used.
   *
   * `guest_user_id` is set too, not only `claimed_by_user_id`. That column is
   * what every guest-side read resolves ownership from — threads, orders, the
   * bill, a refund request — so a claim that set only the claim columns would
   * bind a stay the guest still could not see.
   *
   * The FOLIO follows the stay. A walk in's bill was opened with no user on it,
   * and leaving it that way would mean the guest could read the stay and not
   * the charges on it.
   */
  async claim(
    code: string,
    userId: string,
  ): Promise<{ stayId: string; claimed: boolean } | null> {
    return this.db.transaction(async (tx) => {
      const [bound] = await tx
        .update(guestStays)
        .set({
          claimStatus: 'claimed',
          claimedByUserId: userId,
          claimedAt: new Date(),
          guestUserId: userId,
          // Spent. A code that survived its own redemption is a code somebody
          // else can still type.
          claimCode: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(guestStays.claimCode, code),
            eq(guestStays.claimStatus, 'unclaimed'),
          ),
        )
        .returning({ id: guestStays.id });

      if (!bound) return null;

      await tx
        .update(folios)
        .set({ guestUserId: userId, updatedAt: new Date() })
        .where(
          and(eq(folios.guestStayId, bound.id), isNull(folios.guestUserId)),
        );

      return { stayId: bound.id, claimed: true };
    });
  }

  /** Is this code attached to a stay somebody has already claimed? */
  async isSpentCode(code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: guestStays.id })
      .from(guestStays)
      .where(
        and(eq(guestStays.claimCode, code), eq(guestStays.claimStatus, 'claimed')),
      )
      .limit(1);
    return row !== undefined;
  }

  /** Every stay this person owns, newest arrival first. */
  async listForGuest(userId: string): Promise<MyStayRow[]> {
    return this.stays(eq(guestStays.guestUserId, userId));
  }

  /** One stay, only if it is this person's. A miss is answered 404, never 403. */
  async findForGuest(stayId: string, userId: string): Promise<MyStayRow | null> {
    const [row] = await this.stays(
      and(eq(guestStays.id, stayId), eq(guestStays.guestUserId, userId)),
    );
    return row ?? null;
  }

  /**
   * The guest's stay projection, with its money.
   *
   * THREE THINGS ARE JOINED THAT A DESK NEVER NEEDS TOGETHER, and each is here
   * because the refund assessment cannot be computed without it:
   *
   * - the **folio**, for the balance and for the payments taken at the counter;
   * - the **escrow**, for the prepayment, which does NOT appear on the folio —
   *   `openForBooking` posts no deposit line, the money sits with the provider
   *   until checkout, and a "what have you paid" that read only the folio would
   *   tell a guest who prepaid a week ago that they have paid nothing;
   * - the **booking's locked terms**, because the rules that decide a refund are
   *   the ones the guest was shown at checkout, not today's listing.
   */
  private async stays(where: SQL | undefined): Promise<MyStayRow[]> {
    const rows = await this.db
      .select({
        id: guestStays.id,
        bookingId: guestStays.bookingId,
        bookingReference: bookings.reference,
        propertyId: rooms.propertyId,
        propertyName: properties.name,
        roomLabel: rooms.label,
        lifecycle: guestStays.lifecycle,
        checkInMode: guestStays.checkInMode,
        entryAt: guestStays.entryAt,
        plannedExitAt: guestStays.plannedExitAt,
        actualExitAt: guestStays.actualExitAt,
        workspaceId: guestStays.workspaceId,
        stayPriceRwf: guestStays.priceRwf,
        nonRefundable: bookings.nonrefundable,
        cancellationTier: bookings.lockedCancellationTier,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
      })
      .from(guestStays)
      .leftJoin(bookings, eq(bookings.id, guestStays.bookingId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .where(where)
      .orderBy(sql`${guestStays.entryAt} desc`);

    if (rows.length === 0) return [];
    const stayIds = rows.map((r) => r.id);

    const [bills, paidAtDesk, held, open] = await Promise.all([
      this.openFolios(stayIds),
      this.folioPayments(stayIds),
      this.escrowHeld(rows.map((r) => r.bookingId).filter((b): b is string => b !== null)),
      this.openRefundRequests(stayIds),
    ]);

    return rows.map((row) => {
      const bill = bills.get(row.id) ?? null;
      const escrowRwf = row.bookingId ? (held.get(row.bookingId) ?? 0) : 0;
      return {
        id: row.id,
        bookingId: row.bookingId,
        bookingReference: row.bookingReference,
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        roomLabel: row.roomLabel,
        lifecycle: row.lifecycle,
        checkInMode: row.checkInMode,
        entryAt: row.entryAt,
        plannedExitAt: row.plannedExitAt,
        actualExitAt: row.actualExitAt,
        workspaceId: row.workspaceId,
        folioId: bill?.id ?? null,
        balanceRwf: bill?.balanceRwf ?? null,
        paidRwf: escrowRwf + (paidAtDesk.get(row.id) ?? 0),
        openRefundRequestId: open.get(row.id) ?? null,
        nonRefundable: row.nonRefundable ?? false,
        cancellationTier: row.cancellationTier,
        // A walk in has no locked rate; the rate agreed at the counter is on
        // the stay itself, which is the only record of what it costs.
        nightlyRateRwf: row.lockedNightlyRateRwf ?? row.stayPriceRwf ?? null,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
      };
    });
  }

  /** The stay's latest bill that is still open, which is the one a guest reads. */
  private async openFolios(
    stayIds: string[],
  ): Promise<Map<string, { id: string; balanceRwf: number }>> {
    const rows = await this.db
      .select({
        id: folios.id,
        guestStayId: folios.guestStayId,
        balanceRwf: folios.balanceRwf,
        sequence: folios.folioSequence,
        status: folios.status,
      })
      .from(folios)
      .where(inArray(folios.guestStayId, stayIds))
      .orderBy(sql`${folios.folioSequence} desc`);

    const found = new Map<string, { id: string; balanceRwf: number }>();
    for (const row of rows) {
      if (!row.guestStayId || found.has(row.guestStayId)) continue;
      if (row.status === 'closed') continue;
      found.set(row.guestStayId, {
        id: row.id,
        balanceRwf: Number(row.balanceRwf ?? 0),
      });
    }
    return found;
  }

  /**
   * What was handed over at the counter, per stay.
   *
   * Payment and deposit lines are NEGATIVE by the folio's sign rule, so the sum
   * is negated to read as "paid". Refund lines are deliberately not netted off
   * here: this number answers "how much of the guest's money is with the
   * property", and a refund already paid is answered by the request that
   * authorised it, not by quietly shrinking what they are told they paid.
   */
  private async folioPayments(stayIds: string[]): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        guestStayId: folios.guestStayId,
        total: sql<string>`coalesce(sum(${folioCharges.amountRwf}), 0)::bigint`,
      })
      .from(folioCharges)
      .innerJoin(folios, eq(folios.id, folioCharges.folioId))
      .where(
        and(
          inArray(folios.guestStayId, stayIds),
          inArray(folioCharges.chargeType, ['payment', 'deposit']),
        ),
      )
      .groupBy(folios.guestStayId);

    const found = new Map<string, number>();
    for (const row of rows) {
      if (!row.guestStayId) continue;
      found.set(row.guestStayId, Math.max(0, -Number(row.total)));
    }
    return found;
  }

  /** The prepayment still with the provider, per booking. */
  private async escrowHeld(bookingIds: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (bookingIds.length === 0) return found;

    const rows = await this.db
      .select({
        bookingId: escrows.bookingId,
        amountRwf: escrows.amountRwf,
        status: escrows.status,
      })
      .from(escrows)
      .where(
        and(
          inArray(escrows.bookingId, bookingIds),
          // Held or partly refunded: both mean money of the guest's is still
          // in the property's hands. A fully refunded or forfeited hold is not
          // money they can be given back again.
          or(
            eq(escrows.status, 'held'),
            eq(escrows.status, 'refunded_partial'),
          ),
        ),
      );

    for (const row of rows) {
      if (!row.bookingId) continue;
      found.set(row.bookingId, Number(row.amountRwf ?? 0));
    }
    return found;
  }

  /** The request still waiting for an answer, per stay. */
  private async openRefundRequests(
    stayIds: string[],
  ): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        id: stayRefundRequests.id,
        guestStayId: stayRefundRequests.guestStayId,
      })
      .from(stayRefundRequests)
      .where(
        and(
          inArray(stayRefundRequests.guestStayId, stayIds),
          eq(stayRefundRequests.state, 'submitted'),
        ),
      );

    const found = new Map<string, string>();
    for (const row of rows) found.set(row.guestStayId, row.id);
    return found;
  }
}
