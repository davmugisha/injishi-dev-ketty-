import { randomInt } from 'node:crypto';

import type {
  StayRefundReason,
  StayRefundRefusalReason,
  StayRefundState,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import {
  escrows,
  guestStays,
  properties,
  rooms,
  stayRefundRequests,
  users,
} from '../../../database/drizzle/schema';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** A request as both sides read it, with the names a list needs. */
export interface RefundRequestRow {
  id: string;
  reference: string;
  guestStayId: string;
  workspaceId: string;
  folioId: string | null;
  bookingId: string | null;
  raisedByUserId: string;
  /** The branch this request belongs to, through the stay's room (ADR-054). */
  propertyId: string | null;
  propertyName: string | null;
  roomLabel: string | null;
  guestName: string | null;
  reason: StayRefundReason;
  detail: string;
  requestedRwf: number | null;
  state: StayRefundState;
  policyEligible: boolean;
  policyMaxRwf: number;
  policyRule: string;
  policyRefusalReason: StayRefundRefusalReason | null;
  approvedRwf: number | null;
  refusalReason: StayRefundRefusalReason | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

/** What the money move needs, read once with the request it belongs to. */
export interface RefundSettlementRow {
  escrowId: string | null;
  escrowStatus: string | null;
  escrowAmountRwf: number | null;
  adapterRef: string | null;
  idempotencyKey: string | null;
}

/**
 * `RF-XXXX-XXXX`, from the CSPRNG.
 *
 * The same shape and the same reasoning as `bookings.reference`: the guest
 * reads it out at the desk and quotes it in a dispute, so it has to be sayable
 * and it must not be a sequence — a sequential number tells anyone holding one
 * how many guests asked for their money back this month.
 */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomReference(): string {
  const block = (): string => {
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
    }
    return out;
  };
  return `RF-${block()}-${block()}`;
}

/** Was this a collision on the one-open-request-per-stay index? */
export function isOpenRefundRequestCollision(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return (
    inner?.code === '23505' &&
    inner.constraint === 'stay_refund_requests_one_open_per_stay_uk'
  );
}

/**
 * THE ONE PLACE A REFUND REQUEST IS WRITTEN OR READ (§6.8).
 *
 * The reads are keyed two different ways on purpose, exactly as the messaging
 * repository's are: a guest's list resolves from `raised_by_user_id`, and the
 * property's queue resolves from `workspace_id`. A guest holds no workspace, so
 * there is no version of the property's query that can safely serve one.
 */
@Injectable()
export class StayRefundRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Raise one, with the house rules as they stood, in one insert.
   *
   * The reference is retried on collision rather than assumed unique: it is
   * random, a collision is rare, and a loop is cheaper than a sequence that
   * leaks volume.
   *
   * Returns null on the one-open-request-per-stay collision, which the service
   * answers as "you already have one being read" rather than as an error. Two
   * taps must not become two queue items that two staffers answer differently.
   */
  async raise(input: {
    guestStayId: string;
    workspaceId: string;
    folioId: string | null;
    bookingId: string | null;
    raisedByUserId: string;
    reason: StayRefundReason;
    detail: string;
    requestedRwf: number | null;
    policyEligible: boolean;
    policyMaxRwf: number;
    policyRule: string;
    policyRefusalReason: StayRefundRefusalReason | null;
  }): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const [row] = await this.db
          .insert(stayRefundRequests)
          .values({ reference: randomReference(), ...input })
          .returning({ id: stayRefundRequests.id });
        if (row) return row.id;
      } catch (error) {
        if (isOpenRefundRequestCollision(error)) return null;
        const e = error as { code?: string; cause?: { code?: string } };
        const code = e.code ?? e.cause?.code;
        // A reference collision is the only other unique this insert can hit,
        // and it says nothing about the request, so it — and only it — retries.
        if (code !== '23505') throw error;
      }
    }
    throw new Error('could not mint a free refund reference');
  }

  async find(id: string): Promise<RefundRequestRow | null> {
    const [row] = await this.rows(eq(stayRefundRequests.id, id));
    return row ?? null;
  }

  /** Everything this person has asked for, newest first. */
  async listForGuest(userId: string): Promise<RefundRequestRow[]> {
    return this.rows(eq(stayRefundRequests.raisedByUserId, userId));
  }

  /**
   * The property's queue, inside the caller's branch scope (ADR-054).
   * `states` narrows it further; absent means all of them.
   *
   * A request reaches its branch through the stay's ROOM, which is the same
   * path `listStays` takes. `rooms.property_id` is NOT NULL, so the scope's
   * unbranched arm matches nothing here — a refund request always belongs to
   * whichever branch the guest slept in.
   */
  async listForWorkspace(
    workspaceId: string,
    scope: BranchScope,
    states?: StayRefundState[],
  ): Promise<RefundRequestRow[]> {
    const scoped = and(
      eq(stayRefundRequests.workspaceId, workspaceId),
      inBranchScope(rooms.propertyId, scope),
    );
    return this.rows(
      states && states.length > 0
        ? and(scoped, inArray(stayRefundRequests.state, states))
        : scoped,
    );
  }

  /**
   * Record the decision, guarded on the request still being open.
   *
   * The guard is what makes two staffers pressing Approve and Reject in the
   * same second produce ONE answer rather than a row whose state and reason
   * disagree. The loser gets `false` and is shown where it actually landed.
   */
  async decide(input: {
    id: string;
    state: 'approved' | 'rejected' | 'withdrawn';
    decidedByUserId: string | null;
    approvedRwf: number | null;
    refusalReason: StayRefundRefusalReason | null;
    decisionNote: string | null;
    paymentRef: string | null;
  }): Promise<boolean> {
    const [row] = await this.db
      .update(stayRefundRequests)
      .set({
        state: input.state,
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        approvedRwf: input.approvedRwf,
        refusalReason: input.refusalReason,
        decisionNote: input.decisionNote,
        paymentRef: input.paymentRef,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stayRefundRequests.id, input.id),
          eq(stayRefundRequests.state, 'submitted'),
        ),
      )
      .returning({ id: stayRefundRequests.id });
    return row !== undefined;
  }

  /**
   * The provider-side facts an approval needs: the hold the prepayment is
   * sitting in, and the key its capture ran on.
   *
   * Read at DECISION time rather than copied onto the request when it was
   * raised. A hold can be released, forfeited or refunded between the guest
   * asking and the property answering, and instructing a refund against a
   * snapshot of a hold that no longer exists is how a provider is asked to
   * return money twice.
   */
  async settlement(bookingId: string): Promise<RefundSettlementRow | null> {
    const [row] = await this.db
      .select({
        escrowId: escrows.id,
        escrowStatus: escrows.status,
        escrowAmountRwf: escrows.amountRwf,
        adapterRef: escrows.adapterRef,
        idempotencyKey: escrows.idempotencyKey,
      })
      .from(escrows)
      .where(eq(escrows.bookingId, bookingId))
      .orderBy(desc(escrows.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** The one projection, so every read of a request has the same shape. */
  private async rows(
    where: SQL | undefined,
  ): Promise<RefundRequestRow[]> {
    return this.db
      .select({
        id: stayRefundRequests.id,
        reference: stayRefundRequests.reference,
        guestStayId: stayRefundRequests.guestStayId,
        workspaceId: stayRefundRequests.workspaceId,
        folioId: stayRefundRequests.folioId,
        bookingId: stayRefundRequests.bookingId,
        raisedByUserId: stayRefundRequests.raisedByUserId,
        propertyId: rooms.propertyId,
        propertyName: properties.name,
        roomLabel: rooms.label,
        guestName: sql<
          string | null
        >`coalesce(${users.name}, ${guestStays.guestName})`,
        reason: stayRefundRequests.reason,
        detail: stayRefundRequests.detail,
        requestedRwf: stayRefundRequests.requestedRwf,
        state: stayRefundRequests.state,
        policyEligible: stayRefundRequests.policyEligible,
        policyMaxRwf: stayRefundRequests.policyMaxRwf,
        policyRule: stayRefundRequests.policyRule,
        policyRefusalReason: stayRefundRequests.policyRefusalReason,
        approvedRwf: stayRefundRequests.approvedRwf,
        refusalReason: stayRefundRequests.refusalReason,
        decisionNote: stayRefundRequests.decisionNote,
        decidedAt: stayRefundRequests.decidedAt,
        createdAt: stayRefundRequests.createdAt,
      })
      .from(stayRefundRequests)
      .innerJoin(guestStays, eq(guestStays.id, stayRefundRequests.guestStayId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(users, eq(users.id, stayRefundRequests.raisedByUserId))
      .where(where)
      .orderBy(desc(stayRefundRequests.createdAt));
  }
}
