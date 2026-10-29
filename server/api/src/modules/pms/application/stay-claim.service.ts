import type {
  IssueStayClaimInviteRequest,
  MyStay,
  MyStays,
  StayClaimInvite,
  StayRegistrationDetails,
} from '@injishi/contracts';
import { ClaimStayResult } from '@injishi/contracts';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { FrontDeskRepository } from '../infrastructure/front-desk.repository';
import {
  type MyStayRow,
  StayClaimRepository,
} from '../infrastructure/stay-claim.repository';

/** A stay as its guest reads it, for messaging, which shows the stay a thread belongs to. */
export type { MyStayRow };
import { StayInvitationMailer } from '../infrastructure/stay-invitation.mailer';

/**
 * THE GUEST ARRIVES, THE DESK REGISTERS THEM, AND THEY CARRY ON IN THE APP
 * (§6.8).
 *
 * ## What was missing, exactly
 *
 * `guest_stays` has carried `claim_code`, `claim_status` and
 * `claimed_by_user_id` since the first migration, and `/activate` has shipped a
 * form for typing a code into. Between the two there was nothing at all:
 *
 * - **Nothing minted the first code.** Check in and walk in both left
 *   `claim_code` null. The admin console could RE-issue a code, which meant it
 *   could replace a credential that had never been issued.
 * - **Nothing spent one.** No route bound a stay to a user, which the
 *   `/activate` page said out loud in its own header comment and answered with
 *   a toast apologising to the guest.
 * - **Nothing knew where to send it.** A walk in has no `users` row, so there
 *   was no address anywhere on the record.
 *
 * So a guest registered at a front desk existed in the database and could not
 * be reached, and everything the app offers an in-house guest — the department
 * conversations, room service, the bill, asking for money back — was reachable
 * only by people who had booked online. This service is the missing hinge.
 *
 * ## The claim is a security boundary, so the rules are narrow
 *
 * 1. **The code is the only credential.** Claiming takes a code and nothing
 *    else: no stay id, no room number. A request that could name the stay it
 *    wanted would be a request that could ask for a stay it holds no code for.
 * 2. **It is spent on use.** The binding update clears the code in the same
 *    statement, so the slip photographed in a lobby is worth nothing afterwards.
 * 3. **A wrong code and an already-claimed code are the same answer.** Telling
 *    a caller "that code was already used" confirms a real code, which is the
 *    one fact worth having if you are guessing.
 * 4. **The mail goes to the address on the stay and never to one in a request
 *    body.** The desk captured it at the counter with the guest watching. An
 *    address a caller could supply is a way to have somebody else's room number
 *    and claim code delivered to you.
 */
@Injectable()
export class StayClaimService {
  private readonly log = new Logger(StayClaimService.name);

  constructor(
    private readonly claims: StayClaimRepository,
    private readonly stays: FrontDeskRepository,
    private readonly mailer: StayInvitationMailer,
  ) {}

  /**
   * Write the registration card, mint the code, and mail it — the desk's half
   * of arrival, run as ONE step so a stay cannot end up recorded and unreachable.
   *
   * IT NEVER THROWS, and that is the whole design. It is called from inside
   * check in and walk in, after the stay and the folio already exist. A guest
   * standing at a counter with a key in their hand must not have their check in
   * fail because an SMTP relay timed out or because the identity upsert hit a
   * constraint nobody predicted. Anything that goes wrong is logged and the
   * desk sees an un-sent invitation next to a button that sends it again.
   */
  async registerAndInvite(
    stayId: string,
    details: StayRegistrationDetails | undefined,
  ): Promise<StayClaimInvite | null> {
    if (!details) return null;
    try {
      await this.claims.recordRegistration({ stayId, ...details });

      // Default true when an address was captured: a desk that typed one meant
      // to invite them, and a second deliberate step is how it never gets sent.
      const wanted = details.invite ?? details.email !== undefined;
      if (!wanted) return null;

      return await this.invite(stayId, { reissue: false });
    } catch (error) {
      this.log.error(
        `Stay ${stayId} was checked in, but its registration card or invitation did not go through: ` +
          (error instanceof Error ? error.message : String(error)) +
          '. The stay stands; the desk can send the invitation again.',
      );
      return null;
    }
  }

  /**
   * Send (or re-send) the invitation for a stay the caller's workspace owns.
   *
   * `assertOwned` against the stay read unscoped, so another property's stay id
   * is a 404 and never a 403 — the same rule every command in this module
   * follows, and the reason it matters here is that the answer contains a claim
   * code.
   */
  async issueInvite(
    ws: ScopedWorkspace,
    stayId: string,
    body: IssueStayClaimInviteRequest,
  ): Promise<StayClaimInvite> {
    const stay = assertOwned(await this.stays.findStay(stayId), ws);
    // ADR-054. Holding the workspace is not enough: a manager viewing one
    // branch must not be able to print another branch's claim code, which is a
    // key to that stay and to the identity captured on it.
    assertInBranchScope(ws, stay.propertyId);

    if (body.email) {
      await this.claims.recordRegistration({ stayId: stay.id, email: body.email });
    }

    const invite = await this.invite(stay.id, { reissue: body.reissue ?? false });
    if (!invite) {
      throw new ConflictException(
        stay.guestUserId
          ? 'This guest already has an Injishi account on this stay, so there is nothing to claim.'
          : 'This stay has already been claimed, so there is no code left to hand out.',
      );
    }
    return invite;
  }

  /**
   * What the desk has to print or read out, WITHOUT sending anything.
   *
   * A separate read from the send, because the desk needs the code on a slip at
   * the moment of check in and a GET that mailed the guest every time somebody
   * opened the stay record would be a surprising side effect on a read.
   */
  async currentInvite(
    ws: ScopedWorkspace,
    stayId: string,
  ): Promise<StayClaimInvite> {
    const stay = assertOwned(await this.stays.findStay(stayId), ws);
    assertInBranchScope(ws, stay.propertyId);
    const facts = await this.claims.invitationFacts(stay.id);
    if (!facts) throw new NotFoundException('That stay is not on this property.');
    return {
      stayId: stay.id,
      claimCode: facts.claimStatus === 'unclaimed' ? facts.claimCode : null,
      email: facts.email,
      invitationSent: facts.claimInvitedAt !== null,
      invitedAt: facts.claimInvitedAt?.toISOString() ?? null,
    };
  }

  /** The shared half of both paths. Null means the stay is already claimed. */
  private async invite(
    stayId: string,
    options: { reissue: boolean },
  ): Promise<StayClaimInvite | null> {
    const claimCode = await this.claims.ensureClaimCode(stayId, options);
    if (!claimCode) return null;

    const facts = await this.claims.invitationFacts(stayId);
    if (!facts) return null;

    if (!facts.email) {
      // Not an error. A guest who gave no address still has the code on the
      // printed slip, and the desk is told the mail did not go rather than
      // being refused an operation that half succeeded.
      return {
        stayId,
        claimCode,
        email: null,
        invitationSent: false,
        invitedAt: facts.claimInvitedAt?.toISOString() ?? null,
      };
    }

    const sent = await this.mailer.send({
      stayId,
      email: facts.email,
      claimCode,
      propertyName: facts.propertyName ?? 'the property',
      roomLabel: facts.roomLabel,
      guestName: facts.guestName,
    });

    const invitedAt = new Date();
    if (sent) await this.claims.markInvited(stayId, invitedAt);

    return {
      stayId,
      claimCode,
      email: facts.email,
      invitationSent: sent,
      invitedAt: sent
        ? invitedAt.toISOString()
        : (facts.claimInvitedAt?.toISOString() ?? null),
    };
  }

  /* ------------------------------------------------------ the guest's side */

  /**
   * Spend a claim code and bind the stay to this account.
   *
   * ONE REFUSAL FOR EVERY FAILURE. An unknown code, a code for a stay somebody
   * else already claimed, and a code that never existed all answer with the
   * same 404 and the same sentence. Distinguishing them would turn this route
   * into an oracle: "already claimed" confirms that the code is real, which is
   * the only thing worth learning from guessing at a nine-character space.
   *
   * Claiming twice with the same code is therefore also a 404 rather than an
   * idempotent success — the code is gone, cleared by its own redemption. The
   * guest's own stay list is where they see the result, and the screen sends
   * them there.
   */
  async claim(userId: string, code: string): Promise<ClaimStayResult> {
    const normalised = code.trim().toUpperCase();
    const bound = await this.claims.claim(normalised, userId);
    if (!bound) {
      throw new NotFoundException(
        "That code doesn't match a stay waiting to be claimed. Check the slip, or ask the front desk to send it again.",
      );
    }

    const stay = await this.claims.findForGuest(bound.stayId, userId);
    if (!stay) {
      // The bind committed a line ago. A 500 rather than a 404: telling the
      // guest "not found" about a stay we have just given them would send them
      // looking for a mistake they did not make.
      throw new ConflictException(
        'Your stay was claimed, but we could not read it back. Refresh and it will be there.',
      );
    }

    this.log.log(`Stay ${bound.stayId} claimed.`);
    return { stay: this.present(stay), claimed: true };
  }

  /** Every stay this person holds, newest arrival first. */
  async listMine(userId: string): Promise<MyStays> {
    const rows = await this.claims.listForGuest(userId);
    return { stays: rows.map((row) => this.present(row)) };
  }

  /** One of them, or a 404 that says nothing about whether the id is real. */
  async mine(userId: string, stayId: string): Promise<MyStayRow> {
    const row = await this.claims.findForGuest(stayId, userId);
    if (!row) throw new NotFoundException('That stay is not on your account.');
    return row;
  }

  present(row: MyStayRow): MyStay {
    return {
      id: row.id,
      bookingId: row.bookingId,
      bookingReference: row.bookingReference,
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      roomLabel: row.roomLabel,
      lifecycle: row.lifecycle,
      checkInMode: row.checkInMode,
      entryAt: row.entryAt.toISOString(),
      plannedExitAt: row.plannedExitAt?.toISOString() ?? null,
      actualExitAt: row.actualExitAt?.toISOString() ?? null,
      folioId: row.folioId,
      balanceRwf: row.balanceRwf,
      paidRwf: row.paidRwf,
      openRefundRequestId: row.openRefundRequestId,
    };
  }
}
