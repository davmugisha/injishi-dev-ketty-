import type {
  DecideStayRefundRequest,
  RaiseStayRefundRequest,
  StayRefundAssessment,
  StayRefundQuote,
  StayRefundReason,
  StayRefundRequestList,
  StayRefundRequestView,
  StayRefundState,
} from '@injishi/contracts';
import {
  CANCELLATION_TIERS,
  REFUND_REFUSAL_LABEL,
  stayRefundAssessment,
  type CancellationTier,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import { FolioRepository } from '../infrastructure/folio.repository';
import type { MyStayRow } from '../infrastructure/stay-claim.repository';
import {
  type RefundRequestRow,
  StayRefundRepository,
} from '../infrastructure/stay-refund.repository';

/** A day, in milliseconds. */
const DAY_MS = 86_400_000;

/**
 * Rwanda's fixed offset from UTC. One zone, no daylight saving, so this is a
 * constant rather than a lookup — the same assumption `hoursUntilCheckIn` in
 * the booking module already makes.
 */
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * The property's calendar date for an instant, as `YYYY-MM-DD`.
 *
 * NIGHTS ARE COUNTED ON A CALENDAR, NEVER IN ELAPSED HOURS, and that is the
 * whole reason this exists. A guest who arrives at 14:00 on the 10th and leaves
 * at 09:00 on the 12th has slept TWO nights; 43 elapsed hours floors to one.
 * `nightsBooked` already counts calendar dates, because a booking is a pair of
 * dates — so counting the nights consumed any other way puts the two numbers on
 * different scales and systematically misstates what is unused, by up to a
 * whole night, on every stay that did not begin at midnight.
 */
function propertyDate(at: Date): string {
  return new Date(at.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days between two `YYYY-MM-DD` dates. Never negative. */
function nightsBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
    ),
  );
}

/**
 * ASKING FOR MONEY BACK ON A STAY THAT HAS ALREADY BEGUN, and the property
 * answering (§6.8).
 *
 * ## The hole this fills
 *
 * `BookingCancellationService` refunds a booking and explicitly refuses one the
 * guest has checked in to: *"You have already checked in, so this booking can
 * no longer be cancelled here."* That refusal is right — a stay in progress is
 * not a cancellation — and it points at a door that did not exist. A guest in
 * the building had no way to raise the question at all, so it was raised at the
 * desk, by voice, and lived in nobody's records: no reason, no rule, no
 * decision, nothing to show a regulator or a chargeback.
 *
 * ## Four rules, and each one is load bearing
 *
 * 1. **The rules quote, the property decides.** `stayRefundAssessment` computes
 *    an entitlement from the terms the guest was shown at checkout. It binds
 *    nobody: `refund.decide` may approve above it (goodwill) or refuse below it
 *    by citing a rule the engine cannot see — damage, a travel agent holding the
 *    money. Its value is that the guest and the desk read the SAME number.
 * 2. **A refusal names its rule.** The database refuses a rejection with no
 *    `refusal_reason`, and the guest is shown the sentence that reason maps to.
 *    "Management decision" is not a reason; it is what guests escalate.
 * 3. **Provider first, record second.** The same order a cancellation uses
 *    (ADR-020 D-h). If the rail does not confirm, nothing is recorded and the
 *    request stays open — which is the truthful state — and the desk is told to
 *    try again. A request marked approved on money that never moved is the one
 *    outcome worth failing loudly to avoid.
 * 4. **Only a claimed stay can ask.** `raised_by_user_id` is NOT NULL, and a
 *    desk-registered stay has no account on it until the guest claims it. That
 *    is the whole reason the claim flow goes first.
 *
 * ## What this does NOT do, and it is owed
 *
 * An approved refund against a stay whose folio has already been SIGNED does
 * not raise the RRA credit note (`NR`) that withdrawing declared turnover
 * needs. `ebm.refund` exists as a permission and `ebmTransactionType` has the
 * value; wiring it is a fiscal change that belongs with the EBM module, not
 * bolted onto this decision. Until it is, an approval on a signed folio is
 * logged as owing one.
 */
@Injectable()
export class StayRefundService {
  private readonly log = new Logger(StayRefundService.name);

  constructor(
    private readonly requests: StayRefundRepository,
    private readonly folios: FolioRepository,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
  ) {}

  protected now(): Date {
    return new Date();
  }

  /* ------------------------------------------------------ the guest's side */

  /**
   * What the rules would allow, before anything is submitted.
   *
   * Quoted on the server rather than worked out in the client, for the reason
   * `CancellationQuote` is: the figure on the confirm screen has to be the
   * figure in the property's queue, or the first thing the guest says is that
   * the app promised them something.
   */
  quote(stay: MyStayRow, reason: StayRefundReason): StayRefundQuote {
    const assessment = this.assess(stay, reason);
    return {
      stayId: stay.id,
      reason,
      eligible: assessment.eligible,
      maxRefundRwf: assessment.maxRefundRwf,
      rule: assessment.rule,
      refusalReason: assessment.refusalReason,
      paidRwf: stay.paidRwf,
      refusal: this.refusalToRaise(stay),
    };
  }

  /** Raise one against a stay the caller owns. */
  async raise(
    userId: string,
    stay: MyStayRow,
    body: RaiseStayRefundRequest,
  ): Promise<StayRefundRequestView> {
    const refusal = this.refusalToRaise(stay);
    if (refusal) throw new ConflictException(refusal);

    const assessment = this.assess(stay, body.reason);
    const id = await this.requests.raise({
      guestStayId: stay.id,
      workspaceId: stay.workspaceId,
      folioId: stay.folioId,
      bookingId: stay.bookingId,
      raisedByUserId: userId,
      reason: body.reason,
      detail: body.detail,
      requestedRwf: body.requestedRwf ?? null,
      policyEligible: assessment.eligible,
      policyMaxRwf: assessment.maxRefundRwf,
      policyRule: assessment.rule,
      policyRefusalReason: assessment.refusalReason,
    });

    if (!id) {
      throw new ConflictException(
        'You already have a request on this stay waiting for an answer. The property will reply to that one.',
      );
    }

    const row = await this.requests.find(id);
    if (!row) throw new ConflictException('That request could not be read back.');
    this.log.log(
      `Refund request ${row.reference} raised on stay ${stay.id}: ${body.reason}, rules allow ${assessment.maxRefundRwf} RWF.`,
    );
    return this.present(row);
  }

  async listMine(userId: string): Promise<StayRefundRequestList> {
    const rows = await this.requests.listForGuest(userId);
    return { requests: rows.map((row) => this.present(row)) };
  }

  /**
   * The guest changes their mind.
   *
   * `withdrawn` and `rejected` are separate states on purpose: telling somebody
   * the property refused them when in fact they withdrew is a lie the record
   * would carry forever, and it is the exact fact a dispute turns on.
   */
  async withdraw(userId: string, requestId: string): Promise<StayRefundRequestView> {
    const row = await this.requests.find(requestId);
    if (!row || row.raisedByUserId !== userId) {
      throw new NotFoundException('That request is not on your account.');
    }
    if (row.state !== 'submitted') {
      throw new ConflictException('That request has already been answered.');
    }

    const done = await this.requests.decide({
      id: row.id,
      state: 'withdrawn',
      // No `decided_by_user_id`: the guest withdrawing is not the property
      // deciding, and filing them as the decider would put a guest's name in
      // the column a regulator reads as "who at the business answered this".
      decidedByUserId: null,
      approvedRwf: null,
      refusalReason: null,
      decisionNote: null,
      paymentRef: null,
    });
    if (!done) {
      throw new ConflictException('The property answered this just now.');
    }

    const now = await this.requests.find(row.id);
    if (!now) throw new ConflictException('That request could not be read back.');
    return this.present(now);
  }

  /* --------------------------------------------------- the property's side */

  async listForWorkspace(
    ws: ScopedWorkspace,
    states?: StayRefundState[],
  ): Promise<StayRefundRequestList> {
    const rows = await this.requests.listForWorkspace(
      ws.workspaceId,
      ws.branchScope,
      states,
    );
    return { requests: rows.map((row) => this.present(row)) };
  }

  /**
   * APPROVE OR REFUSE ONE, and move the money when there is money to move.
   *
   * The order is the cancellation path's and is not rearrangeable:
   *
   * 1. Prove the request is this property's and still open.
   * 2. On an approval above zero, ask the RAIL first. A provider that does not
   *    confirm leaves the request open and untouched, and the desk retries.
   * 3. Record the decision, guarded on `submitted`, so two staffers answering
   *    at once produce one answer.
   *
   * ## Where the money comes from, and why it is two different places
   *
   * A booked guest's prepayment is sitting in ESCROW with the provider —
   * `openForBooking` posts no deposit line, so the folio has never seen it. A
   * walk in paid at the counter, which IS on the folio as a payment line. So an
   * approval against a booking instructs the provider, and an approval against
   * a walk in posts a `refund` line that puts the balance back and tells the
   * desk to hand over cash. Doing either one for both cases would refund money
   * that was never taken, or take it out of the wrong pocket.
   */
  async decide(
    ws: ScopedWorkspace,
    requestId: string,
    body: DecideStayRefundRequest,
    actorUserId: string,
  ): Promise<StayRefundRequestView> {
    const row = await this.requests.find(requestId);
    // 404 and never 403 for another property's request, as everywhere else on
    // this surface: a 403 confirms the id names something real.
    if (!row || row.workspaceId !== ws.workspaceId) {
      throw new NotFoundException('That request is not on this property.');
    }
    // ADR-054, and it is the same 404 for the same reason: a manager covering
    // one branch must not answer — or refuse — another branch's guest.
    assertInBranchScope(ws, row.propertyId, 'That request is');
    if (row.state !== 'submitted') {
      throw new ConflictException(
        `That request has already been ${row.state}. Refresh to see where it stands.`,
      );
    }

    if (body.decision === 'reject') {
      const done = await this.requests.decide({
        id: row.id,
        state: 'rejected',
        decidedByUserId: actorUserId,
        approvedRwf: null,
        refusalReason: body.refusalReason,
        decisionNote: body.note ?? null,
        paymentRef: null,
      });
      if (!done) throw this.raced();
      this.log.log(
        `Refund request ${row.reference} refused: ${body.refusalReason}.`,
      );
      return this.reread(row.id);
    }

    const approvedRwf = Math.max(0, Math.floor(body.approvedRwf));
    const paymentRef =
      approvedRwf > 0 ? await this.payBack(row, approvedRwf) : null;

    const done = await this.requests.decide({
      id: row.id,
      state: 'approved',
      decidedByUserId: actorUserId,
      approvedRwf,
      refusalReason: null,
      decisionNote: body.note ?? null,
      paymentRef,
    });
    if (!done) throw this.raced();

    this.log.log(
      `Refund request ${row.reference} approved for ${approvedRwf} RWF` +
        (paymentRef ? ` (${paymentRef}).` : ' (settled on the bill).'),
    );
    return this.reread(row.id);
  }

  /**
   * Put the money back, by whichever route this stay's money actually took.
   *
   * Throws rather than half-succeeding: the caller records nothing if this
   * does not return, so an approval the rail refused leaves the request open
   * rather than marking a guest refunded on money that never moved.
   */
  private async payBack(
    row: RefundRequestRow,
    approvedRwf: number,
  ): Promise<string | null> {
    const held = row.bookingId
      ? await this.requests.settlement(row.bookingId)
      : null;

    if (held?.adapterRef && held.escrowStatus === 'held') {
      try {
        const receipt = await this.payments.refund({
          kind: 'refund',
          // Derived from the REQUEST, so a retried decision replays at the
          // provider rather than paying twice. The request id is stable and
          // unique and is exactly the thing being answered once.
          idempotencyKey: `stay-refund:${row.id}`,
          originalRef: held.adapterRef,
          amountRwf: approvedRwf,
          currency: 'RWF',
          workspaceId: row.workspaceId,
          memo: `Refund request ${row.reference} approved`,
        });
        return receipt.adapterRef ?? null;
      } catch (error) {
        if (error instanceof PaymentDeclinedError) {
          // Refunds of one payment never exceed it (073-gtbank-payments AC-11).
          // Nothing was written; the request stays open for a smaller amount.
          throw new ConflictException(
            'That is more than remains of what this guest paid, after earlier refunds. Approve a smaller amount.',
          );
        }
        this.log.warn(
          `Refund for ${row.reference} was not confirmed; nothing recorded. ` +
            (error instanceof Error ? error.message : String(error)),
        );
        throw new ServiceUnavailableException(
          'We could not reach the payment service, so nothing has been refunded and the request is still open. Try again.',
        );
      }
    }

    if (!row.folioId) {
      // No hold and no bill. The desk is settling in cash off-system; the
      // decision is still recorded, which is the point of the record.
      this.log.warn(
        `Refund request ${row.reference} approved for ${approvedRwf} RWF with no escrow and no folio: settle it at the desk.`,
      );
      return null;
    }

    /*
     * A `refund` line, POSITIVE, which is the folio's own sign rule: a payment
     * is negative because the guest handed money over, so giving it back moves
     * the balance the other way. `accountCodeFor` maps it to `REFUNDS_PAID` and
     * `ledgerKindFor` to `folio_settle`, both of which already existed and
     * neither of which had a caller.
     *
     * `open_next` rather than `refuse`: if the bill has been signed, the refund
     * opens the next folio sequence instead of failing, which is ADR-050 D-c's
     * own answer for a charge that arrives after the lock. It does NOT raise
     * the RRA credit note that withdrawing declared turnover needs — that is
     * owed, and is logged below so it is visible rather than silent.
     */
    const posted = await this.folios.postCharges({
      folioId: row.folioId,
      workspaceId: row.workspaceId,
      drafts: [
        {
          chargeType: 'refund',
          description: `Refund ${row.reference}`,
          departmentId: null,
          quantity: 1,
          unitPriceRwf: approvedRwf,
          amountRwf: approvedRwf,
          taxCode: null,
          taxRate: null,
          taxAmountRwf: null,
          sourceRefType: 'stay_refund_request',
          sourceRefId: row.id,
          postedByUserId: null,
          businessDate: null,
          idempotencyKey: `${row.workspaceId}:stay-refund:${row.id}`,
          accountCode: 'REFUNDS_PAID',
        },
      ],
      onLocked: 'open_next',
    });

    if (posted.movedToFolioId) {
      this.log.warn(
        `Refund ${row.reference} landed on a new folio sequence because the original was signed. ` +
          'An RRA credit note for the withdrawn turnover is still owed.',
      );
    }
    return null;
  }

  /* ----------------------------------------------------------- the rules */

  /**
   * Run the house rules over one stay.
   *
   * Everything the assessment reads is LOCKED data: the tier and the
   * non-refundable flag as they were at sale, the rate as it was agreed, what
   * was actually paid. Today's listing is never consulted, for the same reason
   * `cancellationRefund` does not consult it — the rules a guest is held to are
   * the ones they were shown.
   */
  private assess(stay: MyStayRow, reason: StayRefundReason): StayRefundAssessment {
    const now = this.now();
    return stayRefundAssessment({
      reason,
      nonRefundable: stay.nonRefundable,
      tier: this.tierOf(stay.cancellationTier),
      nightsBooked: this.nightsBooked(stay),
      nightsConsumed: this.nightsConsumed(stay, now),
      nightlyRateRwf: stay.nightlyRateRwf,
      paidRwf: stay.paidRwf,
      lifecycle: stay.lifecycle,
      hoursSinceExit: stay.actualExitAt
        ? (now.getTime() - stay.actualExitAt.getTime()) / 3_600_000
        : null,
    });
  }

  /**
   * The database column is `text` through the query builder's inference, and
   * only these five words are ever in it. An unknown value reads as null, which
   * the assessment treats as `flexible` — the most generous tier — rather than
   * throwing at a guest over a value somebody put in the column.
   */
  private tierOf(value: string | null): CancellationTier | null {
    if (value === null) return null;
    return value in CANCELLATION_TIERS ? (value as CancellationTier) : null;
  }

  /**
   * Nights contracted for.
   *
   * The booking's own dates when there is a booking; otherwise the stay's
   * planned departure. A walk in with no planned exit has 0, which is honest:
   * nobody agreed a length, so there are no "unused nights" to price and the
   * assessment says so rather than inventing a number.
   */
  private nightsBooked(stay: MyStayRow): number {
    if (stay.checkIn && stay.checkOut) {
      return nightsBetween(stay.checkIn, stay.checkOut);
    }
    if (stay.plannedExitAt) {
      // A walk in has no booking dates, so the nights come off the same
      // calendar the booked case uses rather than off the clock.
      return nightsBetween(
        propertyDate(stay.entryAt),
        propertyDate(stay.plannedExitAt),
      );
    }
    return 0;
  }

  /**
   * Nights already slept, counted on the property's calendar to the moment the
   * question is asked.
   *
   * ON THE CALENDAR, not on the clock. A guest who arrived at 14:00 yesterday
   * has slept one night by this morning, whatever the elapsed hours say — and
   * `nightsBooked` counts calendar dates, so any other rule here would compare
   * two numbers that are not measuring the same thing.
   *
   * Capped at the nights booked, so an overstay can never produce negative
   * unused nights and a refund out of thin air.
   */
  private nightsConsumed(stay: MyStayRow, now: Date): number {
    const until = stay.actualExitAt ?? now;
    const slept = nightsBetween(propertyDate(stay.entryAt), propertyDate(until));
    const booked = this.nightsBooked(stay);
    return booked > 0 ? Math.min(slept, booked) : slept;
  }

  /** Why this stay cannot carry a request at all, or null when it can. */
  private refusalToRaise(stay: MyStayRow): string | null {
    if (stay.openRefundRequestId) {
      return 'You already have a request on this stay waiting for an answer.';
    }
    if (stay.paidRwf <= 0 && (stay.balanceRwf ?? 0) <= 0) {
      return 'Nothing has been paid on this stay, so there is nothing to refund. If a charge on the bill is wrong, message the front desk.';
    }
    return null;
  }

  private async reread(id: string): Promise<StayRefundRequestView> {
    const row = await this.requests.find(id);
    if (!row) throw new ConflictException('That request could not be read back.');
    return this.present(row);
  }

  private raced(): ConflictException {
    return new ConflictException(
      'Somebody answered this request a moment ago. Refresh to see where it landed.',
    );
  }

  private present(row: RefundRequestRow): StayRefundRequestView {
    return {
      id: row.id,
      reference: row.reference,
      stayId: row.guestStayId,
      propertyName: row.propertyName,
      roomLabel: row.roomLabel,
      guestName: row.guestName,
      reason: row.reason,
      detail: row.detail,
      requestedRwf: row.requestedRwf,
      state: row.state,
      policyEligible: row.policyEligible,
      policyMaxRwf: Number(row.policyMaxRwf ?? 0),
      policyRule: row.policyRule,
      policyRefusalReason: row.policyRefusalReason,
      approvedRwf: row.approvedRwf === null ? null : Number(row.approvedRwf),
      refusalReason: row.refusalReason,
      // The sentence is resolved here, so no client ever owns a copy of the
      // refusal table and none of them can drift from what the desk chose.
      refusalLabel: row.refusalReason
        ? REFUND_REFUSAL_LABEL[row.refusalReason]
        : null,
      decisionNote: row.decisionNote,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
