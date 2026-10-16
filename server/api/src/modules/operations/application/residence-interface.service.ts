import {
  type AnswerRenewalRequest,
  type ConvertApplicationRequest,
  type DecideAccessRequest,
  type DeclineApplicationRequest,
  type GiveNoticeRequest,
  type IssueVisitorPassRequest,
  MAX_OVERNIGHT_NIGHTS,
  type MoveResidenceRepairRequest,
  type RaiseResidenceRepairRequest,
  type RecordNoticeRequest,
  type RecordRentPaymentRequest,
  type RecordScreeningRequest,
  type ResidenceRepairMessageRequest,
  type ResidenceView,
  type ResidenceWriteResult,
  SCREENING_CHECK_IDS,
  type SendRentRemindersRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CURRENT_LEASE, ResidenceInterfaceRepository, type UnitTarget } from '../infrastructure/residence-interface.repository';
import { kigaliToday } from './first-rent-charge';
import { MessagingService } from './messaging.service';

/**
 * Where a ticket may go from where it is, on the residence board. The same machine as
 * `ResidenceService`'s (ADR-016 D16), restricted to the three moves the board offers: a resolved
 * ticket reopens only through `/ops/tickets/:id/advance`, which asks why.
 */
const BOARD_MOVES: Readonly<Record<string, readonly string[]>> = {
  open: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: [],
  closed: [],
  cancelled: [],
};

const DAY_MS = 86_400_000;
/** A pass management issues may run this long (a contractor's week, a relative's month). */
const MAX_PASS_DAYS = 31;
/** How far ahead a resident may register a visitor. */
const MAX_PASS_LEAD_DAYS = 60;

const noon = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);
const daysBetween = (from: string, to: string): number => Math.round((noon(to) - noon(from)) / DAY_MS);

type Found<K extends 'ticket' | 'offer' | 'application'> = NonNullable<
  Awaited<ReturnType<ResidenceInterfaceRepository[K]>>
>;
const result = (id: string, reference: string | null = null, code: string | null = null): ResidenceWriteResult => ({
  id,
  reference,
  code,
});

/** "2026-11-14" → "14 Nov 2026", for a refusal the person reads. */
function spoken(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function addMonthsLessADay(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The residence screens' commands and their read model (real-data 1.3.1).
 *
 * Two callers reach it: the landlord's staff through `/ops/residence` (WorkspaceGuard has proved the
 * grant and the route's permission; every row named in a path is then proved to be this business's
 * and on a branch in scope, 404 otherwise), and the tenant through `/me/residence` (SessionGuard only:
 * ownership through `leases.tenant_user_id` is the guard, and a record that is not theirs is a 404).
 */
@Injectable()
export class ResidenceInterfaceService {
  constructor(
    private readonly rows: ResidenceInterfaceRepository,
    private readonly messaging: MessagingService,
  ) {}

  /** The clock, as a method so a test can pin the day. */
  protected now(): Date {
    return new Date();
  }

  private today(): string {
    return kigaliToday(this.now());
  }

  // --- Reads -------------------------------------------------------------------------------------

  /** The business's read model, trimmed to the parts the grant reads. */
  view(ws: ScopedWorkspace): Promise<ResidenceView> {
    const has = (p: string): boolean => (ws.permissions as readonly string[]).includes(p);
    const money = has('money.view') || has('rent.record');
    return this.rows.readWorkspace(ws.workspaceId, ws.branchScope, {
      money,
      rents: money,
      tickets: has('ticket.advance'),
      tenancy: has('lease.advance'),
      deposits: money || has('deposit.return') || has('lease.advance'),
    });
  }

  tenantView(userId: string): Promise<ResidenceView> {
    return this.rows.readTenant(userId);
  }

  // --- Repairs -----------------------------------------------------------------------------------

  /** Management raises a repair on a unit (with its tenancy's conversation) or on a block's common area. */
  async raiseRepair(ws: ScopedWorkspace, userId: string, body: RaiseResidenceRepairRequest): Promise<ResidenceWriteResult> {
    const block = body.unit.match(/^Block\s+(.+)$/i)?.[1];
    if (block) {
      const area = await this.rows.blockSpace(ws.workspaceId, block.trim());
      if (!area) throw new NotFoundException(`There is no common area called ${body.unit}.`);
      assertInBranchScope(ws, area.propertyId, 'That common area');
      const ticket = await this.rows.raiseRepair({
        workspaceId: ws.workspaceId,
        orgId: area.orgId,
        propertyId: area.propertyId,
        roomId: null,
        spaceId: area.spaceId,
        leaseId: null,
        raisedByUserId: userId,
        raisedByRole: 'staff',
        raisedVia: 'management',
        // Nobody lives in a stairwell: there is no one to ask about entry.
        request: { ...body, staffMayEnter: null },
      });
      return result(ticket.id, ticket.reference);
    }
    const unit = await this.unitOf(ws, body.unit);
    const ticket = await this.rows.raiseRepair({
      workspaceId: ws.workspaceId,
      orgId: unit.orgId,
      propertyId: unit.propertyId,
      roomId: unit.roomId,
      spaceId: null,
      leaseId: unit.lease?.id ?? null,
      raisedByUserId: userId,
      raisedByRole: 'staff',
      raisedVia: 'management',
      request: body,
    });
    return result(ticket.id, ticket.reference);
  }

  /** The resident reports a repair on their own unit; any other unit is a 404. */
  async raiseTenantRepair(userId: string, body: RaiseResidenceRepairRequest): Promise<ResidenceWriteResult> {
    const unit = await this.rows.tenantUnit(userId, body.unit.trim());
    if (!unit?.lease) throw new NotFoundException('That unit is not yours.');
    const ticket = await this.rows.raiseRepair({
      workspaceId: unit.workspaceId,
      orgId: unit.orgId,
      propertyId: unit.propertyId,
      roomId: unit.roomId,
      spaceId: null,
      leaseId: unit.lease.id,
      raisedByUserId: userId,
      raisedByRole: 'tenant',
      raisedVia: 'resident app',
      request: body,
    });
    return result(ticket.id, ticket.reference);
  }

  async moveRepair(
    ws: ScopedWorkspace,
    id: string,
    body: MoveResidenceRepairRequest,
    userId: string,
  ): Promise<ResidenceWriteResult> {
    const ticket = await this.ownTicket(ws, id);
    // A second tap, or an offline phone retrying, is not an error.
    if (ticket.status === body.to) return result(ticket.id);
    if (!BOARD_MOVES[ticket.status]?.includes(body.to)) {
      throw new ConflictException(
        `A ${ticket.status.replace('_', ' ')} repair cannot move to ${body.to.replace('_', ' ')} on the board.`,
      );
    }
    const moved = await this.rows.moveRepair({ ticketId: ticket.id, from: ticket.status, to: body.to, authorUserId: userId });
    if (!moved) throw new ConflictException('Someone else just moved this repair. Refresh to see where it stands.');
    return result(ticket.id);
  }

  /**
   * Write on a repair: an internal note (staff only, never shown to the resident) or a reply into the
   * conversation with the resident, which needs `message.send` as every reply to a guest does.
   */
  async repairMessage(
    ws: ScopedWorkspace,
    id: string,
    body: ResidenceRepairMessageRequest,
    userId: string,
  ): Promise<ResidenceWriteResult> {
    const ticket = await this.ownTicket(ws, id);
    if (body.internal) return result(await this.rows.addTicketNote(ticket.id, userId, body.text));
    if (!(ws.permissions as readonly string[]).includes('message.send')) {
      throw new ForbiddenException('Replying to residents needs the permission to reply to messages.');
    }
    if (!ticket.threadId) {
      throw new ConflictException('Nobody lives in this unit or area to reply to. Write an internal note instead.');
    }
    const sent = await this.messaging.sendMessage(ws, ticket.threadId, { body: body.text }, userId);
    return result(sent.id);
  }

  private async ownTicket(ws: ScopedWorkspace, id: string): Promise<Found<'ticket'>> {
    const ticket = assertOwned(await this.rows.ticket(id), ws);
    assertInBranchScope(ws, ticket.propertyId, 'Repair');
    return ticket;
  }

  // --- Gate codes and access ---------------------------------------------------------------------

  async issuePass(ws: ScopedWorkspace, userId: string, body: IssueVisitorPassRequest): Promise<ResidenceWriteResult> {
    const unit = await this.unitOf(ws, body.unit);
    this.checkWindow(body, MAX_PASS_DAYS);
    const pass = await this.rows.issuePass({
      workspaceId: ws.workspaceId,
      propertyId: unit.propertyId,
      roomId: unit.roomId,
      leaseId: unit.lease?.id ?? null,
      maintenanceTicketId: null,
      createdByUserId: userId,
      byTenant: false,
      // Management's own pass is approved as it is issued.
      status: 'approved',
      request: body,
    });
    return result(pass.id, null, pass.code);
  }

  /**
   * The resident registers a guest for their own unit. Contractors are arranged by management, and
   * an overnight stay longer than the house rule needs management's decision before any code exists.
   */
  async issueTenantPass(userId: string, body: IssueVisitorPassRequest): Promise<ResidenceWriteResult> {
    const unit = await this.rows.tenantUnit(userId, body.unit.trim());
    if (!unit?.lease) throw new NotFoundException('That unit is not yours.');
    if (body.kind !== 'guest') throw new BadRequestException('Contractors are arranged by management.');
    this.checkWindow(body, MAX_OVERNIGHT_NIGHTS + 1);
    const from = Date.parse(body.validFrom);
    const to = Date.parse(body.validTo);
    if (from > this.now().getTime() + MAX_PASS_LEAD_DAYS * DAY_MS) {
      throw new BadRequestException(`Register a visitor at most ${MAX_PASS_LEAD_DAYS} days ahead.`);
    }
    const nights = Math.ceil((to - from) / DAY_MS);
    if (!body.overnight && to - from > DAY_MS) {
      throw new BadRequestException('A visit that is not overnight ends the day it starts.');
    }
    if (body.overnight && nights > MAX_OVERNIGHT_NIGHTS) {
      throw new UnprocessableEntityException(
        `Overnight visits longer than ${MAX_OVERNIGHT_NIGHTS} nights need management approval before a code is issued.`,
      );
    }
    const pass = await this.rows.issuePass({
      workspaceId: unit.workspaceId,
      propertyId: unit.propertyId,
      roomId: unit.roomId,
      leaseId: unit.lease.id,
      maintenanceTicketId: null,
      createdByUserId: userId,
      byTenant: true,
      status: 'expected',
      request: body,
    });
    return result(pass.id, null, pass.code);
  }

  private checkWindow(body: IssueVisitorPassRequest, maxDays: number): void {
    const from = Date.parse(body.validFrom);
    const to = Date.parse(body.validTo);
    if (to <= this.now().getTime()) throw new BadRequestException('That visit window has already ended.');
    if (to - from > maxDays * DAY_MS) {
      throw new BadRequestException(`A gate code lasts at most ${maxDays} days.`);
    }
  }

  async decideAccess(
    ws: ScopedWorkspace,
    id: string,
    body: DecideAccessRequest,
    userId: string,
  ): Promise<ResidenceWriteResult> {
    const request = assertOwned(await this.rows.accessRequest(id), ws);
    assertInBranchScope(ws, request.propertyId, 'Access request');
    if (request.status === body.decision) return result(request.id);
    if (request.status !== 'open') throw new ConflictException(`This request was already ${request.status}.`);
    if (!(await this.rows.decideAccess(request.id, body.decision, userId))) {
      throw new ConflictException('Someone else just decided this request. Refresh to see the decision.');
    }
    return result(request.id);
  }

  // --- Rent --------------------------------------------------------------------------------------

  /**
   * Save a payment received outside the app as PENDING (AC-14: the client key makes a retried press
   * one payment). It is not collected until Payments verifies it, so it never touches the charge.
   */
  async recordPayment(
    ws: ScopedWorkspace,
    userId: string,
    clientKey: string,
    body: RecordRentPaymentRequest,
  ): Promise<ResidenceWriteResult> {
    const key = `${ws.workspaceId}:${clientKey}`;
    const replay = await this.rows.paymentByKey(key);
    if (replay) return this.replayed(ws, replay, body);
    const unit = await this.unitOf(ws, body.unit);
    if (!unit.lease) throw new NotFoundException(`Nobody rents ${unit.label} now.`);
    const saved = await this.rows.recordPendingPayment({
      workspaceId: ws.workspaceId,
      propertyId: unit.propertyId,
      leaseId: unit.lease.id,
      recordedByUserId: userId,
      key,
      request: body,
    });
    switch (saved.kind) {
      case 'saved':
        return result(saved.id);
      case 'replay':
        return this.replayed(ws, saved.row, body);
      case 'nothing_open':
        throw new ConflictException(`Nothing is owed on ${unit.label}.`);
      case 'over': {
        const room = saved.owed - saved.inFlight;
        throw new UnprocessableEntityException(
          saved.inFlight > 0
            ? `That is more than ${unit.label} owes once the RWF ${saved.inFlight.toLocaleString('en-US')} already waiting for verification is counted. At most RWF ${Math.max(0, room).toLocaleString('en-US')} can be recorded.`
            : `That is more than ${unit.label} owes (RWF ${saved.owed.toLocaleString('en-US')}). An overpayment has nowhere to go.`,
        );
      }
    }
  }

  /** A retried press answers with the payment the first one saved, and only if it is the same payment. */
  private replayed(
    ws: ScopedWorkspace,
    row: { id: string; workspaceId: string; amountRwf: number; method: string; providerRef: string },
    body: RecordRentPaymentRequest,
  ): ResidenceWriteResult {
    assertOwned(row, ws);
    if (row.amountRwf !== body.amountRwf || row.method !== body.method || row.providerRef !== body.providerRef) {
      throw new ConflictException('That Idempotency-Key was already used for a different payment.');
    }
    return result(row.id);
  }

  /** Remind residents in arrears. A unit with nothing overdue is refused rather than nagged. */
  async sendReminders(ws: ScopedWorkspace, userId: string, body: SendRentRemindersRequest): Promise<ResidenceWriteResult[]> {
    const today = this.today();
    const targets: { leaseId: string; propertyId: string; tenantUserId: string | null }[] = [];
    for (const label of [...new Set(body.units.map((u) => u.trim()))]) {
      const unit = await this.unitOf(ws, label);
      if (!unit.lease) throw new NotFoundException(`Nobody rents ${unit.label} now.`);
      if ((await this.rows.overdueOn(unit.lease.id, today)) <= 0) {
        throw new ConflictException(`${unit.label} has nothing overdue to remind about.`);
      }
      targets.push({ leaseId: unit.lease.id, propertyId: unit.propertyId, tenantUserId: unit.lease.tenantUserId });
    }
    const ids = await this.rows.sendReminders({ workspaceId: ws.workspaceId, sentByUserId: userId, note: body.message, targets });
    return ids.map((id) => result(id));
  }

  // --- Notices and renewals ----------------------------------------------------------------------

  /**
   * Record a notice that came by letter, email or in person. Short notice is recorded as such (a
   * landlord may accept it); the resident giving notice in the app is held to the period instead.
   */
  async recordNotice(ws: ScopedWorkspace, userId: string, body: RecordNoticeRequest): Promise<ResidenceWriteResult> {
    const unit = await this.unitOf(ws, body.unit);
    if (!unit.lease) throw new NotFoundException(`Nobody rents ${unit.label} now.`);
    const today = this.today();
    if (body.receivedOn > today) throw new BadRequestException('A notice cannot be received in the future.');
    const days = daysBetween(body.receivedOn, body.moveOutDate);
    if (days <= 0) throw new BadRequestException('The move-out date has to come after the notice.');
    const period = unit.lease.noticePeriodDays ?? 30;
    const filed = await this.rows.fileNotice({
      leaseId: unit.lease.id,
      filedByUserId: userId,
      moveOutDate: body.moveOutDate,
      reasonCode: null,
      message: null,
      filedVia: body.channel,
      filedAt: body.receivedOn === today ? this.now() : new Date(`${body.receivedOn}T09:00:00+02:00`),
      noticeGivenDays: days,
      isShortNotice: days < period,
    });
    if (filed.existed) throw new ConflictException(`A notice is already recorded for ${unit.label}.`);
    return result(filed.id, unit.lease.reference);
  }

  /** The resident gives notice in the app: written notice, time stamped, held to the lease's period. */
  async giveNotice(userId: string, leaseId: string, body: GiveNoticeRequest): Promise<ResidenceWriteResult> {
    const lease = await this.rows.lease(leaseId);
    if (!lease || lease.tenantUserId !== userId) throw new NotFoundException();
    if (!(CURRENT_LEASE as readonly string[]).includes(lease.status)) {
      throw new ConflictException('Notice can only be given on a tenancy you live in now.');
    }
    const today = this.today();
    const days = daysBetween(today, body.moveOutDate);
    const period = lease.noticePeriodDays ?? 30;
    if (days < period) {
      const earliest = new Date(noon(today) + period * DAY_MS).toISOString().slice(0, 10);
      throw new UnprocessableEntityException(
        `Your lease needs ${period} days' notice. The earliest move-out date is ${spoken(earliest)}.`,
      );
    }
    const filed = await this.rows.fileNotice({
      leaseId: lease.id,
      filedByUserId: userId,
      moveOutDate: body.moveOutDate,
      reasonCode: body.reason,
      message: body.message?.trim() || null,
      filedVia: 'app',
      filedAt: this.now(),
      noticeGivenDays: days,
      isShortNotice: false,
    });
    if (filed.existed) throw new ConflictException('You have already given notice on this lease.');
    return result(filed.id, lease.reference);
  }

  async answerOffer(userId: string, offerId: string, body: AnswerRenewalRequest): Promise<ResidenceWriteResult> {
    const offer = await this.rows.offer(offerId);
    if (!offer || offer.kind !== 'landlord_offer' || offer.tenantUserId !== userId) throw new NotFoundException();
    if (offer.offerStatus === body.answer) return result(offer.id);
    if (offer.offerStatus !== 'open') throw new ConflictException('This offer has already been answered.');
    if (offer.answerBy && offer.answerBy < this.today()) {
      throw new ConflictException('This offer has expired. Message management for a new one.');
    }
    if (body.answer === 'accepted' && (await this.rows.hasNotice(offer.leaseId))) {
      throw new ConflictException('You have given notice on this lease. Message management if your plans changed.');
    }
    if (!(await this.rows.closeOffer(offer.id, body.answer, userId))) {
      throw new ConflictException('This offer just changed. Refresh to see where it stands.');
    }
    return result(offer.id);
  }

  async withdrawOffer(ws: ScopedWorkspace, offerId: string, userId: string): Promise<ResidenceWriteResult> {
    const offer = await this.ownOffer(ws, offerId);
    if (offer.offerStatus === 'withdrawn') return result(offer.id);
    if (offer.offerStatus !== 'open') {
      throw new ConflictException(`The resident has already ${offer.offerStatus} this offer.`);
    }
    if (!(await this.rows.closeOffer(offer.id, 'withdrawn', userId))) {
      throw new ConflictException('This offer just changed. Refresh to see where it stands.');
    }
    return result(offer.id);
  }

  async remindOffer(ws: ScopedWorkspace, offerId: string): Promise<ResidenceWriteResult> {
    const offer = await this.ownOffer(ws, offerId);
    if (offer.offerStatus !== 'open') throw new ConflictException('Only an offer waiting for an answer can be chased.');
    const reminded = await this.rows.remindOffer({
      offerId: offer.id,
      workspaceId: offer.workspaceId,
      tenantUserId: offer.tenantUserId,
      body: offer.answerBy
        ? `Please answer your renewal offer by ${spoken(offer.answerBy)} in My lease.`
        : 'Please answer your renewal offer in My lease.',
    });
    if (!reminded) throw new ConflictException('This offer just changed. Refresh to see where it stands.');
    return result(offer.id);
  }

  private async ownOffer(ws: ScopedWorkspace, offerId: string): Promise<Found<'offer'>> {
    const offer = assertOwned(await this.rows.offer(offerId), ws);
    if (offer.kind !== 'landlord_offer') throw new NotFoundException();
    assertInBranchScope(ws, offer.propertyId, 'Offer');
    return offer;
  }

  // --- Applications ------------------------------------------------------------------------------

  async recordScreening(ws: ScopedWorkspace, id: string, body: RecordScreeningRequest): Promise<ResidenceWriteResult> {
    const application = await this.ownApplication(ws, id);
    if (application.stage === 'invited') {
      throw new ConflictException(`${application.name} has not registered yet: there is nothing to screen.`);
    }
    if (application.stage === 'declined' || application.stage === 'converted') {
      throw new ConflictException('This application is closed.');
    }
    const done = SCREENING_CHECK_IDS.filter((c) => body.done.includes(c));
    const stage = done.length === SCREENING_CHECK_IDS.length ? 'ready' : 'screening';
    if (!(await this.rows.recordScreening(application.id, done, stage))) {
      throw new ConflictException('This application just changed. Refresh to see where it stands.');
    }
    return result(application.id);
  }

  async declineApplication(ws: ScopedWorkspace, id: string, body: DeclineApplicationRequest): Promise<ResidenceWriteResult> {
    const application = await this.ownApplication(ws, id);
    if (application.stage === 'declined') return result(application.id);
    if (application.stage === 'converted') {
      throw new ConflictException('This application is already a lease draft. Cancel the draft instead.');
    }
    if (!(await this.rows.declineApplication(application.id, body.reason))) {
      throw new ConflictException('This application just changed. Refresh to see where it stands.');
    }
    return result(application.id);
  }

  /** A ready application becomes a lease DRAFT: nothing is signed, and the unit is held while it is out. */
  async convertApplication(
    ws: ScopedWorkspace,
    id: string,
    body: ConvertApplicationRequest,
  ): Promise<ResidenceWriteResult> {
    const application = await this.ownApplication(ws, id);
    if (application.stage === 'converted' && application.leaseId) {
      throw new ConflictException('This application is already a lease draft.');
    }
    if (application.stage !== 'ready') {
      throw new ConflictException('Record every screening check before converting to a lease.');
    }
    if (!ws.orgId) throw new NotFoundException();
    const converted = await this.rows.convertApplication({
      applicationId: application.id,
      workspaceId: ws.workspaceId,
      orgId: ws.orgId,
      roomId: application.roomId,
      tenantName: application.name,
      tenantEmail: application.email,
      tenantPhone: application.phone,
      occupants: application.occupants,
      brokerId: application.brokerId,
      terms: body,
      endDate: addMonthsLessADay(body.startDate, body.termMonths),
    });
    if (converted.kind === 'held') {
      throw new ConflictException(
        `${application.label} is already held by lease draft ${converted.reference ?? ''}. Cancel it first.`.replace(' .', '.'),
      );
    }
    if (converted.kind === 'moved') throw new ConflictException('This application just changed. Refresh to see it.');
    return result(converted.id, converted.reference);
  }

  private async ownApplication(ws: ScopedWorkspace, id: string): Promise<Found<'application'>> {
    const application = assertOwned(await this.rows.application(id), ws);
    assertInBranchScope(ws, application.propertyId, 'Application');
    return application;
  }

  // --- Units -------------------------------------------------------------------------------------

  /** A unit of this business, on a branch the caller covers, or 404. */
  private async unitOf(ws: ScopedWorkspace, label: string): Promise<UnitTarget> {
    const unit = await this.rows.unitByLabel(ws.workspaceId, label.trim());
    if (!unit) throw new NotFoundException(`There is no unit ${label.trim()} here.`);
    assertInBranchScope(ws, unit.propertyId, `Unit ${unit.label}`);
    return unit;
  }
}
