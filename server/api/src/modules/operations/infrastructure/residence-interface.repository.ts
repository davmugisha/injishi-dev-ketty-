import type {
  ApplicationDocumentState,
  ApplicationStage,
  ConvertApplicationRequest,
  IssueVisitorPassRequest,
  NoticeChannel,
  NoticeReasonCode,
  RaiseResidenceRepairRequest,
  RecordRentPaymentRequest,
  RenewalOfferStatus,
  RentPaymentMethod,
  RentPaymentStatus,
  RentReminderChannel,
  RepairCostBearer,
  ResidenceView,
  ScreeningCheckId,
  VisitorPassKind,
  VisitorPassStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  brokers,
  cautionHolds,
  cautionSettlements,
  contractFilings,
  departments,
  leaseApplicationDocuments,
  leaseApplications,
  leaseClauseTemplates,
  leaseRenewals,
  leases,
  maintenanceEvents,
  maintenanceTickets,
  messages,
  moveOutNotices,
  notifications,
  orgs,
  payouts,
  properties,
  propertyBlocks,
  rentCharges,
  rentPayments,
  rentReminders,
  residenceUnits,
  roomTypes,
  rooms,
  spaces,
  threads,
  users,
  visitorAccessRequests,
  visitorLogEntries,
  visitorPasses,
  workspaces,
} from '../../../database/drizzle/schema';
import { type BranchScope, inBranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { scrubPhoneNumbers } from '../application/scrub';
import type { Db } from './room-events';

/** Which parts of the read model the caller may see (the service decides from the grant). */
export interface ViewParts {
  money: boolean;
  tickets: boolean;
  tenancy: boolean;
  deposits: boolean;
  rents: boolean;
}

/** Leases a tenant sees: never a draft nobody has sent them, never a cancelled one. */
const TENANT_LEASE_STATUSES = ['pending_signature', 'active', 'ending', 'ended'] as const;
/** A tenancy someone lives in now. */
export const CURRENT_LEASE = ['active', 'ending'] as const;

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const empty = <T>(): T[] => [];

/** "+250 788 123 207" → "+250 78• ••• 207". A number already masked passes through. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  if (phone.includes('•')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•••';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)}• ••• ${digits.slice(-3)}`;
}

/** A unit as a write needs it: where it is and who lives there now. */
export interface UnitTarget {
  roomId: string;
  label: string;
  propertyId: string;
  workspaceId: string;
  orgId: string;
  lease: {
    id: string;
    reference: string | null;
    tenantUserId: string | null;
    tenantName: string | null;
    status: string;
    noticePeriodDays: number | null;
  } | null;
}

@Injectable()
export class ResidenceInterfaceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // =========================================================================
  // The read model
  // =========================================================================

  /** The landlord's view of their buildings (the branches in scope), trimmed to the parts the grant allows. */
  async readWorkspace(workspaceId: string, scope: BranchScope, parts: ViewParts): Promise<ResidenceView> {
    const leaseRows = await this.leaseRows(
      and(
        eq(leases.workspaceId, workspaceId),
        inBranchScope(rooms.propertyId, scope),
        ne(leases.status, 'cancelled'),
      ),
    );
    const leaseIds = leaseRows.map((l) => l.id);
    const [property] = await this.db
      .select({ id: properties.id, name: properties.name, landlord: orgs.legalName, upi: orgs.upi, tin: orgs.tin })
      .from(properties)
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(and(eq(properties.workspaceId, workspaceId), inBranchScope(properties.id, scope)))
      .orderBy(asc(properties.name))
      .limit(1);

    const [blocks, units, charges, payments, reminders, notices, offers, filings, deposits] = await Promise.all([
      this.db
        .select({ id: propertyBlocks.id, code: propertyBlocks.code, name: propertyBlocks.name, kind: propertyBlocks.kind })
        .from(propertyBlocks)
        .where(and(eq(propertyBlocks.workspaceId, workspaceId), inBranchScope(propertyBlocks.propertyId, scope)))
        .orderBy(asc(propertyBlocks.sortOrder), asc(propertyBlocks.code)),
      this.unitRows(and(eq(residenceUnits.workspaceId, workspaceId), inBranchScope(residenceUnits.propertyId, scope))),
      parts.rents ? this.chargeRows(leaseIds) : empty<ResidenceView['charges'][number]>(),
      parts.rents ? this.paymentRows(leaseIds) : empty<ResidenceView['payments'][number]>(),
      parts.rents ? this.reminderRows(leaseIds) : empty<ResidenceView['reminders'][number]>(),
      parts.tenancy ? this.noticeRows(leaseIds) : empty<ResidenceView['notices'][number]>(),
      parts.tenancy ? this.offerRows(leaseIds) : empty<ResidenceView['offers'][number]>(),
      parts.tenancy ? this.filingRows(leaseIds) : empty<ResidenceView['filings'][number]>(),
      parts.deposits ? this.depositRows(leaseIds) : empty<ResidenceView['deposits'][number]>(),
    ]);

    const tickets = parts.tickets
      ? await this.ticketRows(
          and(eq(maintenanceTickets.workspaceId, workspaceId), inBranchScope(maintenanceTickets.propertyId, scope)),
        )
      : [];
    const ticketIds = tickets.map((t) => t.id);
    const [ticketNotes, ticketMessages] = await Promise.all([
      this.ticketNoteRows(ticketIds),
      this.ticketMessageRows(tickets),
    ]);

    const [passes, accessRequests, visitorLog, clauses, applications, payoutRows] = await Promise.all([
      parts.tenancy
        ? this.passRows(and(eq(visitorPasses.workspaceId, workspaceId), inBranchScope(visitorPasses.propertyId, scope)))
        : empty<ResidenceView['passes'][number]>(),
      parts.tenancy ? this.accessRequestRows(leaseIds) : empty<ResidenceView['accessRequests'][number]>(),
      parts.tenancy ? this.visitorLogRows(workspaceId, scope) : empty<ResidenceView['visitorLog'][number]>(),
      parts.tenancy ? this.clauseRows(workspaceId) : empty<ResidenceView['clauses'][number]>(),
      parts.tenancy ? this.applicationRows(workspaceId, scope) : empty<ResidenceView['applications'][number]>(),
      // A settlement is the whole business's, so only a member covering every branch sees it.
      parts.money && scope.includesUnbranched
        ? this.payoutRows(workspaceId)
        : empty<ResidenceView['payouts'][number]>(),
    ]);

    return {
      property: property ?? null,
      blocks,
      units,
      leases: parts.money || parts.tenancy ? leaseRows : leaseRows.map((l) => ({ ...l, monthlyRentRwf: null, cautionRwf: null })),
      charges,
      payments,
      reminders,
      notices,
      offers,
      filings,
      deposits,
      tickets,
      ticketNotes,
      ticketMessages,
      passes,
      accessRequests,
      visitorLog,
      clauses,
      applications,
      payouts: payoutRows,
      notifications: [],
    };
  }

  /**
   * The tenant's own copy: their tenancies and what hangs off them, nothing of anyone else's.
   * Ownership is `leases.tenant_user_id`, in the query, never a filter applied afterwards.
   */
  async readTenant(userId: string): Promise<ResidenceView> {
    const leaseRows = await this.leaseRows(
      and(eq(leases.tenantUserId, userId), inArray(leases.status, [...TENANT_LEASE_STATUSES])),
    );
    const leaseIds = leaseRows.map((l) => l.id);
    const roomIds = [...new Set(leaseRows.map((l) => l.roomId))];
    const current = leaseRows.find((l) => (CURRENT_LEASE as readonly string[]).includes(l.status)) ?? leaseRows[0];
    const workspaceIds = await this.workspacesOfLeases(leaseIds);

    const [property] = current
      ? await this.db
          .select({ id: properties.id, name: properties.name, landlord: orgs.legalName, upi: orgs.upi, tin: orgs.tin })
          .from(rooms)
          .innerJoin(properties, eq(properties.id, rooms.propertyId))
          .innerJoin(orgs, eq(orgs.id, properties.orgId))
          .where(eq(rooms.id, current.roomId))
      : [];

    const [units, charges, payments, notices, offers, tickets, passes, notificationRows] = await Promise.all([
      roomIds.length ? this.unitRows(inArray(residenceUnits.roomId, roomIds)) : empty<ResidenceView['units'][number]>(),
      this.chargeRows(leaseIds),
      this.paymentRows(leaseIds),
      this.noticeRows(leaseIds),
      this.offerRows(leaseIds),
      leaseIds.length
        ? this.ticketRows(inArray(maintenanceTickets.leaseId, leaseIds))
        : empty<ResidenceView['tickets'][number]>(),
      leaseIds.length ? this.passRows(inArray(visitorPasses.leaseId, leaseIds)) : empty<ResidenceView['passes'][number]>(),
      workspaceIds.length
        ? this.db
            .select({
              id: notifications.id,
              title: notifications.title,
              body: notifications.body,
              category: notifications.category,
              createdAt: notifications.createdAt,
              readAt: notifications.readAt,
            })
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                inArray(notifications.workspaceId, workspaceIds),
                inArray(notifications.category, ['lease', 'announcement', 'payment']),
                eq(notifications.channel, 'in_app'),
              ),
            )
            .orderBy(sql`${notifications.createdAt} desc`)
        : [],
    ]);

    return {
      property: property ?? null,
      blocks: [],
      units,
      leases: leaseRows,
      charges,
      payments,
      reminders: [],
      notices,
      offers,
      filings: [],
      deposits: [],
      // A tenant reads their repairs, never who on the staff said what to whom about them.
      tickets: tickets.map((t) => ({ ...t, costNote: null })),
      ticketNotes: [],
      ticketMessages: [],
      passes,
      accessRequests: [],
      visitorLog: [],
      clauses: [],
      applications: [],
      payouts: [],
      notifications: notificationRows.map((n) => ({
        id: n.id,
        title: n.title ?? '',
        body: n.body,
        category: n.category,
        createdAt: n.createdAt.toISOString(),
        readAt: iso(n.readAt),
      })),
    };
  }

  private async workspacesOfLeases(leaseIds: string[]): Promise<string[]> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .selectDistinct({ id: leases.workspaceId })
      .from(leases)
      .where(inArray(leases.id, leaseIds));
    return rows.map((r) => r.id);
  }

  private async leaseRows(where: ReturnType<typeof and>): Promise<ResidenceView['leases']> {
    const rows = await this.db
      .select({ lease: leases, label: rooms.label })
      .from(leases)
      .innerJoin(rooms, eq(rooms.id, leases.roomId))
      .where(where)
      .orderBy(asc(rooms.label), asc(leases.createdAt));
    return rows.map(({ lease: l, label }) => ({
      id: l.id,
      reference: l.reference,
      roomId: l.roomId,
      unitLabel: label ?? '',
      status: l.status,
      tenantUserId: l.tenantUserId,
      tenantName: l.tenantName,
      monthlyRentRwf: l.monthlyRentRwf,
      cautionRwf: l.cautionRwf,
      startDate: l.startDate,
      endDate: l.endDate,
      rentDueDay: l.rentDueDay,
      graceDays: l.graceDays,
      noticePeriodDays: l.noticePeriodDays,
      occupants: l.occupants,
      landlordSignedAt: iso(l.landlordSignedAt),
      tenantSignedAt: iso(l.tenantSignedAt),
    }));
  }

  private async unitRows(where: ReturnType<typeof and>): Promise<ResidenceView['units']> {
    const rows = await this.db
      .select({
        roomId: rooms.id,
        label: rooms.label,
        block: propertyBlocks.code,
        type: roomTypes.name,
        askingRentRwf: residenceUnits.askingRentRwf,
        vacantSince: residenceUnits.vacantSince,
        note: residenceUnits.note,
      })
      .from(residenceUnits)
      .innerJoin(rooms, eq(rooms.id, residenceUnits.roomId))
      .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
      .innerJoin(propertyBlocks, eq(propertyBlocks.id, residenceUnits.blockId))
      .where(where)
      .orderBy(asc(rooms.label));
    return rows.map((r) => ({ ...r, label: r.label ?? '' }));
  }

  private async chargeRows(leaseIds: string[]): Promise<ResidenceView['charges']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select()
      .from(rentCharges)
      .where(inArray(rentCharges.leaseId, leaseIds))
      .orderBy(asc(rentCharges.periodMonth));
    return rows.map((c) => ({
      id: c.id,
      leaseId: c.leaseId,
      periodMonth: c.periodMonth,
      amountRwf: c.amountRwf ?? 0,
      paidAmountRwf: c.paidAmountRwf ?? 0,
      status: c.status,
      dueDate: c.dueDate,
      paidAt: iso(c.paidAt),
    }));
  }

  private async paymentRows(leaseIds: string[]): Promise<ResidenceView['payments']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select({ p: rentPayments, recordedBy: users.name })
      .from(rentPayments)
      .leftJoin(users, eq(users.id, rentPayments.recordedByUserId))
      .where(inArray(rentPayments.leaseId, leaseIds))
      .orderBy(asc(rentPayments.receivedAt));
    return rows.map(({ p, recordedBy }) => ({
      id: p.id,
      leaseId: p.leaseId,
      rentChargeId: p.rentChargeId,
      amountRwf: p.amountRwf,
      method: p.method as RentPaymentMethod,
      providerRef: p.providerRef,
      status: p.status as RentPaymentStatus,
      receivedAt: p.receivedAt.toISOString(),
      verifiedAt: iso(p.verifiedAt),
      recordedByName: recordedBy,
    }));
  }

  private async reminderRows(leaseIds: string[]): Promise<ResidenceView['reminders']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select({ r: rentReminders, sentBy: users.name })
      .from(rentReminders)
      .leftJoin(users, eq(users.id, rentReminders.sentByUserId))
      .where(inArray(rentReminders.leaseId, leaseIds))
      .orderBy(asc(rentReminders.sentAt));
    return rows.map(({ r, sentBy }) => ({
      id: r.id,
      leaseId: r.leaseId,
      channel: r.channel as RentReminderChannel,
      note: r.note,
      sentAt: r.sentAt.toISOString(),
      readAt: iso(r.readAt),
      sentByName: sentBy,
    }));
  }

  private async noticeRows(leaseIds: string[]): Promise<ResidenceView['notices']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select()
      .from(moveOutNotices)
      .where(inArray(moveOutNotices.leaseId, leaseIds))
      .orderBy(asc(moveOutNotices.filedAt));
    return rows.map((n) => ({
      id: n.id,
      leaseId: n.leaseId,
      moveOutDate: n.moveOutDate,
      reasonCode: n.reasonCode as NoticeReasonCode | null,
      message: n.message,
      filedVia: n.filedVia as NoticeChannel | null,
      filedAt: n.filedAt.toISOString(),
      noticeGivenDays: n.noticeGivenDays,
      isShortNotice: n.isShortNotice,
    }));
  }

  private async offerRows(leaseIds: string[]): Promise<ResidenceView['offers']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select({ r: leaseRenewals, sentBy: users.name })
      .from(leaseRenewals)
      .leftJoin(users, eq(users.id, leaseRenewals.requestedByUserId))
      .where(and(inArray(leaseRenewals.leaseId, leaseIds), eq(leaseRenewals.kind, 'landlord_offer')))
      .orderBy(asc(leaseRenewals.createdAt));
    return rows.map(({ r, sentBy }) => ({
      id: r.id,
      leaseId: r.leaseId,
      status: r.offerStatus as RenewalOfferStatus,
      offeredRentRwf: r.offeredRentRwf ?? 0,
      termMonths: r.termMonths ?? 0,
      startsOn: r.startsOn ?? '',
      endsOn: r.requestedEndDate ?? '',
      answerBy: r.answerBy ?? '',
      depositTopupRwf: r.depositTopupRwf ?? 0,
      otherTerms: r.otherTerms,
      sentAt: (r.sentAt ?? r.createdAt).toISOString(),
      sentByName: sentBy,
      openedAt: iso(r.openedAt),
      remindedAt: iso(r.remindedAt),
      answeredAt: iso(r.answeredAt),
      signedAt: iso(r.signedAt),
    }));
  }

  private async filingRows(leaseIds: string[]): Promise<ResidenceView['filings']> {
    if (!leaseIds.length) return [];
    const rows = await this.db.select().from(contractFilings).where(inArray(contractFilings.leaseId, leaseIds));
    return rows.map((f) => ({
      leaseId: f.leaseId,
      status: f.status,
      dueBy: iso(f.dueBy),
      clockStartAt: iso(f.clockStartAt),
    }));
  }

  private async depositRows(leaseIds: string[]): Promise<ResidenceView['deposits']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select({ h: cautionHolds, s: cautionSettlements })
      .from(cautionHolds)
      .leftJoin(cautionSettlements, eq(cautionSettlements.cautionHoldId, cautionHolds.id))
      .where(inArray(cautionHolds.leaseId, leaseIds));
    return rows.map(({ h, s }) => ({
      id: h.id,
      leaseId: h.leaseId,
      amountRwf: h.amountRwf ?? 0,
      status: h.status,
      heldAt: h.heldAt.toISOString(),
      refundedRwf: s?.refundedRwf ?? null,
      forfeitedRwf: s?.forfeitedRwf ?? null,
      settledAt: iso(s?.settledAt),
    }));
  }

  private async ticketRows(where: ReturnType<typeof and>): Promise<ResidenceView['tickets']> {
    const raiser = alias(users, 'raiser');
    const assignee = alias(users, 'assignee');
    const rows = await this.db
      .select({
        t: maintenanceTickets,
        unitLabel: rooms.label,
        spaceName: spaces.name,
        raisedByName: raiser.name,
        assignedToName: assignee.name,
        threadId: threads.id,
        tenantName: leases.tenantName,
      })
      .from(maintenanceTickets)
      .leftJoin(rooms, eq(rooms.id, maintenanceTickets.roomId))
      .leftJoin(spaces, eq(spaces.id, maintenanceTickets.spaceId))
      .leftJoin(raiser, eq(raiser.id, maintenanceTickets.raisedByUserId))
      .leftJoin(assignee, eq(assignee.id, maintenanceTickets.assignedToUserId))
      .leftJoin(leases, eq(leases.id, maintenanceTickets.leaseId))
      .leftJoin(threads, eq(threads.maintenanceTicketId, maintenanceTickets.id))
      .where(where)
      .orderBy(asc(maintenanceTickets.createdAt));
    return rows.map(({ t, unitLabel, spaceName, raisedByName, assignedToName, threadId, tenantName }) => ({
      id: t.id,
      reference: t.reference,
      leaseId: t.leaseId,
      roomId: t.roomId,
      unitLabel,
      spaceName,
      title: t.title,
      description: t.description,
      category: t.category,
      status: t.status,
      staffMayEnter: t.staffMayEnter,
      assignedContractor: t.assignedContractor,
      assignedToName,
      scheduledFor: t.scheduledFor,
      visitWindow: t.visitWindow,
      costBearer: t.costBearer as RepairCostBearer | null,
      costNote: t.costNote,
      raisedVia: t.raisedVia,
      // A tenant who reported by phone has no account; the tenancy still names them.
      raisedByName: raisedByName ?? (t.raisedByRole === 'tenant' ? tenantName : null),
      raisedByRole: t.raisedByRole,
      photos: Array.isArray(t.photoObjectKeys) ? (t.photoObjectKeys as { key: string; caption: string }[]) : [],
      createdAt: t.createdAt.toISOString(),
      resolvedAt: iso(t.resolvedAt),
      threadId,
    }));
  }

  /** Staff notes only (`kind = 'note'`): the moves on the board are history, not conversation. */
  private async ticketNoteRows(ticketIds: string[]): Promise<ResidenceView['ticketNotes']> {
    if (!ticketIds.length) return [];
    const rows = await this.db
      .select({ e: maintenanceEvents, author: users.name })
      .from(maintenanceEvents)
      .leftJoin(users, eq(users.id, maintenanceEvents.authorUserId))
      .where(
        and(
          inArray(maintenanceEvents.ticketId, ticketIds),
          eq(maintenanceEvents.kind, 'note'),
          isNotNull(maintenanceEvents.note),
        ),
      )
      .orderBy(asc(maintenanceEvents.createdAt));
    return rows.map(({ e, author }) => ({
      id: e.id,
      ticketId: e.ticketId,
      authorName: author,
      note: e.note ?? '',
      createdAt: e.createdAt.toISOString(),
    }));
  }

  /** Each ticket's conversation with its resident, redacted exactly as the inbox redacts it. */
  private async ticketMessageRows(tickets: ResidenceView['tickets']): Promise<ResidenceView['ticketMessages']> {
    const threadToTicket = new Map(tickets.filter((t) => t.threadId).map((t) => [t.threadId as string, t]));
    if (!threadToTicket.size) return [];
    const tenantOf = await this.db
      .select({ threadId: threads.id, tenantUserId: leases.tenantUserId })
      .from(threads)
      .innerJoin(leases, eq(leases.id, threads.leaseId))
      .where(inArray(threads.id, [...threadToTicket.keys()]));
    const tenant = new Map(tenantOf.map((r) => [r.threadId, r.tenantUserId]));
    const rows = await this.db
      .select({ m: messages, sender: users.name })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(and(inArray(messages.threadId, [...threadToTicket.keys()]), eq(messages.bodyType, 'text')))
      .orderBy(asc(messages.createdAt));
    return rows.map(({ m, sender }) => {
      const ticket = threadToTicket.get(m.threadId) as ResidenceView['tickets'][number];
      const tenantUserId = tenant.get(m.threadId) ?? null;
      // A tenant without an account wrote through the caretaker: no sender, and not the staff.
      const fromTenant = m.senderUserId === null || (tenantUserId !== null && m.senderUserId === tenantUserId);
      return {
        id: m.id,
        ticketId: ticket.id,
        fromTenant,
        senderName: sender,
        body: scrubPhoneNumbers(m.body) ?? '',
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  private async passRows(where: ReturnType<typeof and>): Promise<ResidenceView['passes']> {
    const rows = await this.db
      .select({ p: visitorPasses, label: rooms.label, creator: users.name, tenantName: leases.tenantName })
      .from(visitorPasses)
      .innerJoin(rooms, eq(rooms.id, visitorPasses.roomId))
      .leftJoin(users, eq(users.id, visitorPasses.createdByUserId))
      .leftJoin(leases, eq(leases.id, visitorPasses.leaseId))
      .where(where)
      .orderBy(asc(visitorPasses.validFrom));
    const now = Date.now();
    return rows.map(({ p, label, creator, tenantName }) => {
      const live = p.status === 'expected' || p.status === 'approved';
      return {
        id: p.id,
        roomId: p.roomId,
        unitLabel: label ?? '',
        leaseId: p.leaseId,
        kind: p.kind as VisitorPassKind,
        visitorName: p.visitorName,
        code: p.code,
        validFrom: p.validFrom.toISOString(),
        validTo: p.validTo.toISOString(),
        overnight: p.overnight,
        // A code whose window has closed is expired whatever the row last said.
        status: (live && p.validTo.getTime() < now ? 'expired' : p.status) as VisitorPassStatus,
        createdByName: creator ?? (p.byTenant ? tenantName : null),
        byTenant: p.byTenant,
        usedAt: iso(p.usedAt),
        leftAt: iso(p.leftAt),
      };
    });
  }

  private async accessRequestRows(leaseIds: string[]): Promise<ResidenceView['accessRequests']> {
    if (!leaseIds.length) return [];
    const rows = await this.db
      .select()
      .from(visitorAccessRequests)
      .where(inArray(visitorAccessRequests.leaseId, leaseIds))
      .orderBy(asc(visitorAccessRequests.requestedAt));
    return rows.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      kind: r.kind as ResidenceView['accessRequests'][number]['kind'],
      visitorName: r.visitorName,
      reason: r.reason,
      forDate: r.forDate,
      toDate: r.toDate,
      status: r.status as ResidenceView['accessRequests'][number]['status'],
      requestedAt: r.requestedAt.toISOString(),
    }));
  }

  private async visitorLogRows(workspaceId: string, scope: BranchScope): Promise<ResidenceView['visitorLog']> {
    const rows = await this.db
      .select({ v: visitorLogEntries, label: rooms.label })
      .from(visitorLogEntries)
      .leftJoin(rooms, eq(rooms.id, visitorLogEntries.roomId))
      .where(and(eq(visitorLogEntries.workspaceId, workspaceId), inBranchScope(visitorLogEntries.propertyId, scope)))
      .orderBy(sql`${visitorLogEntries.arrivalAt} desc nulls last`);
    return rows.map(({ v, label }) => ({
      id: v.id,
      visitorName: v.visitorName ?? '',
      visitorPhone: maskPhone(v.visitorPhone),
      roomId: v.roomId,
      unitLabel: label,
      leaseId: v.leaseId,
      place: v.place,
      admittedHow: v.admittedHow,
      recordedBy: v.recordedBy,
      arrivalAt: iso(v.arrivalAt),
      departureAt: iso(v.departureAt),
    }));
  }

  private async clauseRows(workspaceId: string): Promise<ResidenceView['clauses']> {
    return this.db
      .select({
        code: leaseClauseTemplates.code,
        title: leaseClauseTemplates.title,
        note: leaseClauseTemplates.note,
        needsReview: leaseClauseTemplates.needsReview,
      })
      .from(leaseClauseTemplates)
      .where(eq(leaseClauseTemplates.workspaceId, workspaceId))
      .orderBy(asc(leaseClauseTemplates.sortOrder), asc(leaseClauseTemplates.code));
  }

  private async applicationRows(workspaceId: string, scope: BranchScope): Promise<ResidenceView['applications']> {
    const rows = await this.db
      .select({ a: leaseApplications, label: rooms.label, brokerName: brokers.name })
      .from(leaseApplications)
      .innerJoin(rooms, eq(rooms.id, leaseApplications.roomId))
      .leftJoin(brokers, eq(brokers.id, leaseApplications.brokerId))
      .where(and(eq(leaseApplications.workspaceId, workspaceId), inBranchScope(leaseApplications.propertyId, scope)))
      .orderBy(asc(leaseApplications.createdAt));
    const ids = rows.map((r) => r.a.id);
    const docs = ids.length
      ? await this.db
          .select()
          .from(leaseApplicationDocuments)
          .where(inArray(leaseApplicationDocuments.applicationId, ids))
          .orderBy(asc(leaseApplicationDocuments.sortOrder), asc(leaseApplicationDocuments.createdAt))
      : [];
    return rows.map(({ a, label, brokerName }) => ({
      id: a.id,
      roomId: a.roomId,
      unitLabel: label ?? '',
      name: a.name,
      email: a.email,
      phone: a.phone,
      stage: a.stage as ApplicationStage,
      source: a.source,
      broker:
        a.brokerId && a.referredAt
          ? {
              name: brokerName ?? 'Broker',
              referredAt: a.referredAt.toISOString(),
              feeRwf: a.brokerFeeRwf ?? 0,
              terms: a.brokerTerms ?? '',
            }
          : null,
      desiredMoveIn: a.desiredMoveIn,
      termMonths: a.termMonths,
      occupants: a.occupants,
      offeredRentRwf: a.offeredRentRwf,
      depositRwf: a.depositRwf,
      screening: (a.screening ?? []) as ScreeningCheckId[],
      documents: docs
        .filter((d) => d.applicationId === a.id)
        .map((d) => ({ name: d.name, note: d.note, state: d.state as ApplicationDocumentState })),
      createdAt: a.createdAt.toISOString(),
      leaseId: a.leaseId,
    }));
  }

  private async payoutRows(workspaceId: string): Promise<ResidenceView['payouts']> {
    const rows = await this.db
      .select()
      .from(payouts)
      .where(and(eq(payouts.workspaceId, workspaceId), eq(payouts.payeeType, 'landlord'), eq(payouts.source, 'rent')))
      .orderBy(asc(payouts.scheduledReleaseAt));
    return rows.map((p) => {
      // A settlement of a month's rent is released after that month: the period is the month before release.
      const release = p.scheduledReleaseAt;
      const before = release ? new Date(release.getTime() - 86_400_000) : null;
      return {
        id: p.id,
        periodMonth: before ? `${before.toISOString().slice(0, 7)}-01` : null,
        amountRwf: p.amountRwf ?? 0,
        status: p.status,
        destination: p.destination,
        destinationRef: p.destinationRef,
        scheduledReleaseAt: iso(p.scheduledReleaseAt),
        settledAt: iso(p.settledAt),
      };
    });
  }

  // =========================================================================
  // Lookups for the writes
  // =========================================================================

  /**
   * A unit by its label in this business, with its current tenancy. Null when the business has no
   * such unit, which the service answers with 404.
   */
  async unitByLabel(workspaceId: string, label: string): Promise<UnitTarget | null> {
    const [unit] = await this.db
      .select({
        roomId: rooms.id,
        label: rooms.label,
        propertyId: rooms.propertyId,
        workspaceId: residenceUnits.workspaceId,
        orgId: workspaces.orgId,
      })
      .from(residenceUnits)
      .innerJoin(rooms, eq(rooms.id, residenceUnits.roomId))
      .innerJoin(workspaces, eq(workspaces.id, residenceUnits.workspaceId))
      .where(and(eq(residenceUnits.workspaceId, workspaceId), eq(rooms.label, label)));
    if (!unit?.orgId) return null;
    return { ...unit, label: unit.label ?? label, orgId: unit.orgId, lease: await this.currentLease(unit.roomId) };
  }

  /** The tenancy someone lives in now on a room, if any. */
  async currentLease(roomId: string): Promise<UnitTarget['lease']> {
    const [lease] = await this.db
      .select({
        id: leases.id,
        reference: leases.reference,
        tenantUserId: leases.tenantUserId,
        tenantName: leases.tenantName,
        status: leases.status,
        noticePeriodDays: leases.noticePeriodDays,
      })
      .from(leases)
      .where(and(eq(leases.roomId, roomId), inArray(leases.status, [...CURRENT_LEASE])))
      .orderBy(sql`${leases.startDate} desc nulls last`)
      .limit(1);
    return lease ?? null;
  }

  /** The tenant's own current unit by label: null unless they hold a current lease on it. */
  async tenantUnit(userId: string, label: string): Promise<UnitTarget | null> {
    const [row] = await this.db
      .select({
        roomId: rooms.id,
        label: rooms.label,
        propertyId: rooms.propertyId,
        workspaceId: leases.workspaceId,
        orgId: leases.orgId,
        leaseId: leases.id,
        reference: leases.reference,
        tenantName: leases.tenantName,
        status: leases.status,
        noticePeriodDays: leases.noticePeriodDays,
      })
      .from(leases)
      .innerJoin(rooms, eq(rooms.id, leases.roomId))
      .where(and(eq(leases.tenantUserId, userId), eq(rooms.label, label), inArray(leases.status, [...CURRENT_LEASE])));
    if (!row) return null;
    return {
      roomId: row.roomId,
      label: row.label ?? label,
      propertyId: row.propertyId,
      workspaceId: row.workspaceId,
      orgId: row.orgId,
      lease: {
        id: row.leaseId,
        reference: row.reference,
        tenantUserId: userId,
        tenantName: row.tenantName,
        status: row.status,
        noticePeriodDays: row.noticePeriodDays,
      },
    };
  }

  /** A common area of the business: the space named after a block ("Block B"). */
  async blockSpace(
    workspaceId: string,
    code: string,
  ): Promise<{ spaceId: string; name: string; propertyId: string; orgId: string } | null> {
    const [row] = await this.db
      .select({ name: propertyBlocks.name, propertyId: propertyBlocks.propertyId, orgId: workspaces.orgId })
      .from(propertyBlocks)
      .innerJoin(workspaces, eq(workspaces.id, propertyBlocks.workspaceId))
      .where(and(eq(propertyBlocks.workspaceId, workspaceId), eq(propertyBlocks.code, code)));
    if (!row?.orgId) return null;
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.propertyId, row.propertyId), eq(spaces.name, row.name)));
    if (!space) return null;
    return { spaceId: space.id, name: row.name, propertyId: row.propertyId, orgId: row.orgId };
  }

  async ticket(id: string): Promise<{
    id: string;
    workspaceId: string;
    propertyId: string | null;
    leaseId: string | null;
    status: string;
    threadId: string | null;
    tenantUserId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: maintenanceTickets.id,
        workspaceId: maintenanceTickets.workspaceId,
        propertyId: maintenanceTickets.propertyId,
        leaseId: maintenanceTickets.leaseId,
        status: maintenanceTickets.status,
        threadId: threads.id,
        tenantUserId: leases.tenantUserId,
      })
      .from(maintenanceTickets)
      .leftJoin(threads, eq(threads.maintenanceTicketId, maintenanceTickets.id))
      .leftJoin(leases, eq(leases.id, maintenanceTickets.leaseId))
      .where(eq(maintenanceTickets.id, id));
    return row ?? null;
  }

  async lease(id: string): Promise<(typeof leases.$inferSelect & { propertyId: string; label: string | null }) | null> {
    const [row] = await this.db
      .select({ lease: leases, propertyId: rooms.propertyId, label: rooms.label })
      .from(leases)
      .innerJoin(rooms, eq(rooms.id, leases.roomId))
      .where(eq(leases.id, id));
    return row ? { ...row.lease, propertyId: row.propertyId, label: row.label } : null;
  }

  async offer(id: string): Promise<{
    id: string;
    leaseId: string;
    workspaceId: string;
    tenantUserId: string | null;
    offerStatus: string | null;
    kind: string;
    answerBy: string | null;
    propertyId: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: leaseRenewals.id,
        leaseId: leaseRenewals.leaseId,
        workspaceId: leases.workspaceId,
        tenantUserId: leases.tenantUserId,
        offerStatus: leaseRenewals.offerStatus,
        kind: leaseRenewals.kind,
        answerBy: leaseRenewals.answerBy,
        propertyId: rooms.propertyId,
      })
      .from(leaseRenewals)
      .innerJoin(leases, eq(leases.id, leaseRenewals.leaseId))
      .innerJoin(rooms, eq(rooms.id, leases.roomId))
      .where(eq(leaseRenewals.id, id));
    return row ?? null;
  }

  async accessRequest(id: string): Promise<{
    id: string;
    workspaceId: string;
    propertyId: string;
    status: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: visitorAccessRequests.id,
        workspaceId: leases.workspaceId,
        propertyId: rooms.propertyId,
        status: visitorAccessRequests.status,
      })
      .from(visitorAccessRequests)
      .innerJoin(leases, eq(leases.id, visitorAccessRequests.leaseId))
      .innerJoin(rooms, eq(rooms.id, leases.roomId))
      .where(eq(visitorAccessRequests.id, id));
    return row ?? null;
  }

  async application(id: string): Promise<(typeof leaseApplications.$inferSelect & { label: string | null }) | null> {
    const [row] = await this.db
      .select({ a: leaseApplications, label: rooms.label })
      .from(leaseApplications)
      .innerJoin(rooms, eq(rooms.id, leaseApplications.roomId))
      .where(eq(leaseApplications.id, id));
    return row ? { ...row.a, label: row.label } : null;
  }

  // =========================================================================
  // Repairs
  // =========================================================================

  /**
   * Raise a repair: the ticket with its next `WO-n`, the conversation with the resident when it is on
   * a tenancy (opened with their own words when they raised it), and the first line of its history.
   * One transaction, so a ticket never exists without the conversation its screen promises.
   */
  async raiseRepair(input: {
    workspaceId: string;
    orgId: string;
    propertyId: string;
    roomId: string | null;
    spaceId: string | null;
    leaseId: string | null;
    raisedByUserId: string;
    raisedByRole: 'tenant' | 'staff';
    raisedVia: string;
    request: RaiseResidenceRepairRequest;
  }): Promise<{ id: string; reference: string }> {
    return this.db.transaction(async (tx) => {
      const reference = await this.nextTicketReference(tx, input.workspaceId);
      const department = await this.engineering(tx, input.propertyId);
      const [ticket] = await tx
        .insert(maintenanceTickets)
        .values({
          workspaceId: input.workspaceId,
          orgId: input.orgId,
          propertyId: input.propertyId,
          roomId: input.roomId,
          spaceId: input.spaceId,
          leaseId: input.leaseId,
          departmentId: department,
          raisedByUserId: input.raisedByUserId,
          raisedByRole: input.raisedByRole,
          raisedVia: input.raisedVia,
          title: input.request.title,
          description: input.request.description ?? null,
          category: input.request.category,
          staffMayEnter: input.request.staffMayEnter,
          costBearer: 'landlord',
          reference,
          photoObjectKeys: [],
        })
        .returning({ id: maintenanceTickets.id });
      await tx.insert(maintenanceEvents).values({
        ticketId: ticket.id,
        authorUserId: input.raisedByUserId,
        kind: 'reported',
        note: null,
      });
      if (input.leaseId) {
        const [thread] = await tx
          .insert(threads)
          .values({
            workspaceId: input.workspaceId,
            leaseId: input.leaseId,
            maintenanceTicketId: ticket.id,
            subject: input.request.title,
          })
          .returning({ id: threads.id });
        if (input.raisedByRole === 'tenant') {
          await tx.insert(messages).values({
            threadId: thread.id,
            senderUserId: input.raisedByUserId,
            body: input.request.description?.trim() || input.request.title,
          });
        }
      }
      return { id: ticket.id, reference };
    });
  }

  /** The next "WO-n" of the workspace, under the same lock the hotel's work orders take. */
  private async nextTicketReference(tx: Db, workspaceId: string): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`work-order:${workspaceId}`}))`);
    const found = await tx.execute<{ next: number }>(sql`
      select coalesce(max((substring(reference from '^WO-([0-9]+)$'))::int), 0) + 1 as next
        from maintenance_tickets where workspace_id = ${workspaceId} and reference ~ '^WO-[0-9]+$'
    `);
    return `WO-${Number(found.rows[0]?.next ?? 1)}`;
  }

  private async engineering(tx: Db, propertyId: string): Promise<string | null> {
    const [row] = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.propertyId, propertyId), eq(departments.departmentCategory, 'engineering')))
      .limit(1);
    return row?.id ?? null;
  }

  /** Move a ticket from one state to the next, compare-and-set, with the history line in the same write. */
  async moveRepair(input: {
    ticketId: string;
    from: string;
    to: 'assigned' | 'in_progress' | 'resolved';
    authorUserId: string;
  }): Promise<boolean> {
    const KIND = { assigned: 'assigned', in_progress: 'started', resolved: 'fixed' } as const;
    return this.db.transaction(async (tx) => {
      const [moved] = await tx
        .update(maintenanceTickets)
        .set({
          status: input.to,
          resolvedAt: input.to === 'resolved' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(maintenanceTickets.id, input.ticketId),
            eq(maintenanceTickets.status, input.from as (typeof maintenanceTickets.$inferSelect)['status']),
          ),
        )
        .returning({ id: maintenanceTickets.id });
      if (!moved) return false;
      await tx.insert(maintenanceEvents).values({
        ticketId: input.ticketId,
        authorUserId: input.authorUserId,
        kind: KIND[input.to],
        note: null,
      });
      return true;
    });
  }

  async addTicketNote(ticketId: string, authorUserId: string, note: string): Promise<string> {
    const [row] = await this.db
      .insert(maintenanceEvents)
      .values({ ticketId, authorUserId, kind: 'note', note })
      .returning({ id: maintenanceEvents.id });
    await this.db.update(maintenanceTickets).set({ updatedAt: new Date() }).where(eq(maintenanceTickets.id, ticketId));
    return row.id;
  }

  // =========================================================================
  // Gate codes and access
  // =========================================================================

  /**
   * Issue a pass with a fresh four digit code. Codes the building still honours are taken; a code
   * whose window closed is released first, so the pool does not silt up with yesterday's visitors.
   * A concurrent request that drew the same code loses on the partial unique index and draws again.
   */
  async issuePass(input: {
    workspaceId: string;
    propertyId: string;
    roomId: string;
    leaseId: string | null;
    maintenanceTicketId: string | null;
    createdByUserId: string;
    byTenant: boolean;
    status: 'expected' | 'approved';
    request: IssueVisitorPassRequest;
  }): Promise<{ id: string; code: string }> {
    await this.db
      .update(visitorPasses)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(visitorPasses.propertyId, input.propertyId),
          inArray(visitorPasses.status, ['expected', 'approved']),
          lt(visitorPasses.validTo, new Date()),
        ),
      );
    for (let attempt = 0; attempt < 12; attempt++) {
      const live = await this.db
        .select({ code: visitorPasses.code })
        .from(visitorPasses)
        .where(and(eq(visitorPasses.propertyId, input.propertyId), inArray(visitorPasses.status, ['expected', 'approved'])));
      const taken = new Set(live.map((r) => r.code));
      if (taken.size >= 9000) break;
      let code: string;
      do code = String(1000 + Math.floor(randomInt() * 9000));
      while (taken.has(code));
      try {
        const [row] = await this.db
          .insert(visitorPasses)
          .values({
            workspaceId: input.workspaceId,
            propertyId: input.propertyId,
            roomId: input.roomId,
            leaseId: input.leaseId,
            maintenanceTicketId: input.maintenanceTicketId,
            kind: input.request.kind,
            visitorName: input.request.visitorName,
            code,
            validFrom: new Date(input.request.validFrom),
            validTo: new Date(input.request.validTo),
            overnight: input.request.overnight,
            status: input.status,
            createdByUserId: input.createdByUserId,
            byTenant: input.byTenant,
          })
          .returning({ id: visitorPasses.id, code: visitorPasses.code });
        return row;
      } catch (error) {
        if (!isUniqueViolation(error, 'visitor_passes_live_code_uk')) throw error;
      }
    }
    throw new Error('no free gate code');
  }

  async decideAccess(id: string, decision: 'approved' | 'declined', userId: string): Promise<boolean> {
    const [row] = await this.db
      .update(visitorAccessRequests)
      .set({ status: decision, decidedAt: new Date(), decidedByUserId: userId })
      .where(and(eq(visitorAccessRequests.id, id), eq(visitorAccessRequests.status, 'open')))
      .returning({ id: visitorAccessRequests.id });
    return !!row;
  }

  // =========================================================================
  // Rent
  // =========================================================================

  async paymentByKey(key: string): Promise<typeof rentPayments.$inferSelect | null> {
    const [row] = await this.db.select().from(rentPayments).where(eq(rentPayments.idempotencyKey, key));
    return row ?? null;
  }

  /**
   * Record a payment received outside the app as PENDING, against the oldest open charge.
   *
   * The lease row is locked first, so two clerks saving the same slip at once are serialized and
   * the second sees the first's payment in flight. Answers `over` when the amount is more than the
   * lease owes once what is already waiting for verification is set aside.
   */
  async recordPendingPayment(input: {
    workspaceId: string;
    propertyId: string;
    leaseId: string;
    recordedByUserId: string;
    key: string;
    request: RecordRentPaymentRequest;
  }): Promise<
    | { kind: 'saved'; id: string; chargeId: string }
    | { kind: 'nothing_open' }
    | { kind: 'over'; owed: number; inFlight: number }
    | { kind: 'replay'; row: typeof rentPayments.$inferSelect }
  > {
    return this.db.transaction(async (tx) => {
      await tx.select({ id: leases.id }).from(leases).where(eq(leases.id, input.leaseId)).for('update');
      const [prior] = await tx.select().from(rentPayments).where(eq(rentPayments.idempotencyKey, input.key));
      if (prior) return { kind: 'replay' as const, row: prior };
      const open = await tx
        .select()
        .from(rentCharges)
        .where(
          and(
            eq(rentCharges.leaseId, input.leaseId),
            sql`coalesce(${rentCharges.amountRwf}, 0) > coalesce(${rentCharges.paidAmountRwf}, 0)`,
          ),
        )
        .orderBy(asc(rentCharges.periodMonth));
      if (!open.length) return { kind: 'nothing_open' as const };
      const owed = open.reduce((n, c) => n + (c.amountRwf ?? 0) - (c.paidAmountRwf ?? 0), 0);
      const [flight] = await tx
        .select({ total: sql<number>`coalesce(sum(${rentPayments.amountRwf}), 0)::bigint` })
        .from(rentPayments)
        .where(and(eq(rentPayments.leaseId, input.leaseId), inArray(rentPayments.status, ['pending', 'unknown'])));
      const inFlight = Number(flight?.total ?? 0);
      if (input.request.amountRwf > owed - inFlight) return { kind: 'over' as const, owed, inFlight };
      const [row] = await tx
        .insert(rentPayments)
        .values({
          workspaceId: input.workspaceId,
          propertyId: input.propertyId,
          leaseId: input.leaseId,
          rentChargeId: open[0].id,
          amountRwf: input.request.amountRwf,
          method: input.request.method,
          providerRef: input.request.providerRef,
          status: 'pending',
          recordedByUserId: input.recordedByUserId,
          idempotencyKey: input.key,
        })
        .returning({ id: rentPayments.id });
      return { kind: 'saved' as const, id: row.id, chargeId: open[0].id };
    });
  }

  /** What a lease owes that fell due before `today` (verified money set against it). */
  async overdueOn(leaseId: string, today: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`coalesce(sum(coalesce(${rentCharges.amountRwf}, 0) - coalesce(${rentCharges.paidAmountRwf}, 0)), 0)::bigint`,
      })
      .from(rentCharges)
      .where(and(eq(rentCharges.leaseId, leaseId), lt(rentCharges.dueDate, today)));
    return Number(row?.total ?? 0);
  }

  /** Log reminders and put each one in the tenant's app, in one transaction. */
  async sendReminders(input: {
    workspaceId: string;
    sentByUserId: string;
    note: string;
    targets: { leaseId: string; propertyId: string; tenantUserId: string | null }[];
  }): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const ids: string[] = [];
      for (const t of input.targets) {
        const [row] = await tx
          .insert(rentReminders)
          .values({
            workspaceId: input.workspaceId,
            propertyId: t.propertyId,
            leaseId: t.leaseId,
            channel: t.tenantUserId ? 'in_app' : 'letter',
            note: input.note,
            sentByUserId: input.sentByUserId,
          })
          .returning({ id: rentReminders.id });
        ids.push(row.id);
        if (t.tenantUserId) {
          await tx.insert(notifications).values({
            userId: t.tenantUserId,
            workspaceId: input.workspaceId,
            category: 'payment',
            channel: 'in_app',
            title: 'Rent reminder',
            body: input.note,
            deliveryStatus: 'sent',
          });
        }
      }
      return ids;
    });
  }

  // =========================================================================
  // Notices and renewals
  // =========================================================================

  /**
   * File a move-out notice. Serialized on the lease row; a second notice answers the first. An open
   * renewal offer is declined in the same write: a tenant who is leaving is not renewing.
   */
  async fileNotice(input: {
    leaseId: string;
    filedByUserId: string;
    moveOutDate: string;
    reasonCode: NoticeReasonCode | null;
    message: string | null;
    filedVia: NoticeChannel;
    filedAt: Date;
    noticeGivenDays: number;
    isShortNotice: boolean;
  }): Promise<{ id: string; existed: boolean }> {
    return this.db.transaction(async (tx) => {
      await tx.select({ id: leases.id }).from(leases).where(eq(leases.id, input.leaseId)).for('update');
      const [prior] = await tx
        .select({ id: moveOutNotices.id })
        .from(moveOutNotices)
        .where(eq(moveOutNotices.leaseId, input.leaseId));
      if (prior) return { id: prior.id, existed: true };
      const [row] = await tx
        .insert(moveOutNotices)
        .values({
          leaseId: input.leaseId,
          filedByUserId: input.filedByUserId,
          moveOutDate: input.moveOutDate,
          reasonCode: input.reasonCode,
          message: input.message,
          filedVia: input.filedVia,
          filedAt: input.filedAt,
          noticeGivenDays: input.noticeGivenDays,
          isShortNotice: input.isShortNotice,
        })
        .returning({ id: moveOutNotices.id });
      await tx
        .update(leaseRenewals)
        .set({ offerStatus: 'declined', status: 'rejected', answeredAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(leaseRenewals.leaseId, input.leaseId),
            eq(leaseRenewals.kind, 'landlord_offer'),
            eq(leaseRenewals.offerStatus, 'open'),
          ),
        );
      return { id: row.id, existed: false };
    });
  }

  async hasNotice(leaseId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: moveOutNotices.id })
      .from(moveOutNotices)
      .where(eq(moveOutNotices.leaseId, leaseId));
    return !!row;
  }

  /** Answer or withdraw an open offer, compare-and-set on `open`. */
  async closeOffer(
    id: string,
    to: 'accepted' | 'declined' | 'withdrawn',
    decidedByUserId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .update(leaseRenewals)
      .set({
        offerStatus: to,
        status: to === 'accepted' ? 'approved' : 'rejected',
        answeredAt: new Date(),
        decidedAt: new Date(),
        decidedByUserId,
        updatedAt: new Date(),
      })
      .where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.offerStatus, 'open')))
      .returning({ id: leaseRenewals.id });
    return !!row;
  }

  /** Nudge the tenant about an open offer: stamped on the offer and put in their app. */
  async remindOffer(input: {
    offerId: string;
    workspaceId: string;
    tenantUserId: string | null;
    body: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(leaseRenewals)
        .set({ remindedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(leaseRenewals.id, input.offerId), eq(leaseRenewals.offerStatus, 'open')))
        .returning({ id: leaseRenewals.id });
      if (!row) return false;
      if (input.tenantUserId) {
        await tx.insert(notifications).values({
          userId: input.tenantUserId,
          workspaceId: input.workspaceId,
          category: 'lease',
          channel: 'in_app',
          title: 'Reminder: your renewal offer',
          body: input.body,
          deliveryStatus: 'sent',
        });
      }
      return true;
    });
  }

  // =========================================================================
  // Applications
  // =========================================================================

  async recordScreening(id: string, done: ScreeningCheckId[], stage: 'screening' | 'ready'): Promise<boolean> {
    const [row] = await this.db
      .update(leaseApplications)
      .set({ screening: done, stage, updatedAt: new Date() })
      .where(and(eq(leaseApplications.id, id), inArray(leaseApplications.stage, ['screening', 'ready'])))
      .returning({ id: leaseApplications.id });
    return !!row;
  }

  /** Close an open application with the reason the applicant is told. False when it already closed. */
  async declineApplication(id: string, reason: string): Promise<boolean> {
    const [row] = await this.db
      .update(leaseApplications)
      .set({ stage: 'declined', declineReason: reason, updatedAt: new Date() })
      .where(and(eq(leaseApplications.id, id), inArray(leaseApplications.stage, ['invited', 'screening', 'ready'])))
      .returning({ id: leaseApplications.id });
    return !!row;
  }

  /**
   * Turn a ready application into a lease draft with the register's next number, and hold the unit.
   * Refused (null) when the unit already has a draft or a lease out for signature, or the
   * application moved on in the meantime.
   */
  async convertApplication(input: {
    applicationId: string;
    workspaceId: string;
    orgId: string;
    roomId: string;
    tenantName: string;
    tenantEmail: string | null;
    tenantPhone: string | null;
    occupants: string | null;
    brokerId: string | null;
    terms: ConvertApplicationRequest;
    endDate: string;
  }): Promise<{ kind: 'ok'; id: string; reference: string } | { kind: 'held'; reference: string | null } | { kind: 'moved' }> {
    return this.db.transaction(async (tx) => {
      const [application] = await tx
        .select({ stage: leaseApplications.stage })
        .from(leaseApplications)
        .where(eq(leaseApplications.id, input.applicationId))
        .for('update');
      if (application?.stage !== 'ready') return { kind: 'moved' as const };
      const [held] = await tx
        .select({ reference: leases.reference })
        .from(leases)
        .where(and(eq(leases.roomId, input.roomId), inArray(leases.status, ['draft', 'pending_signature'])));
      if (held) return { kind: 'held' as const, reference: held.reference };
      const reference = await this.nextLeaseReference(tx, input.workspaceId);
      const [lease] = await tx
        .insert(leases)
        .values({
          roomId: input.roomId,
          orgId: input.orgId,
          workspaceId: input.workspaceId,
          brokerId: input.brokerId,
          status: 'draft',
          reference,
          tenantName: input.tenantName,
          tenantEmail: input.tenantEmail,
          tenantPhone: input.tenantPhone,
          occupants: input.occupants,
          monthlyRentRwf: input.terms.monthlyRentRwf,
          cautionRwf: input.terms.cautionRwf,
          startDate: input.terms.startDate,
          endDate: input.endDate,
          rentDueDay: input.terms.rentDueDay,
          graceDays: 5,
          noticePeriodDays: input.terms.noticePeriodDays,
          contractContent: await this.clauseCopy(tx, input.workspaceId),
        })
        .returning({ id: leases.id });
      await tx
        .update(leaseApplications)
        .set({ stage: 'converted', leaseId: lease.id, updatedAt: new Date() })
        .where(eq(leaseApplications.id, input.applicationId));
      return { kind: 'ok' as const, id: lease.id, reference };
    });
  }

  /** The landlord's standard clauses, copied onto a new draft so later edits never rewrite it. */
  private async clauseCopy(tx: Db, workspaceId: string): Promise<{ clauses: { code: string; title: string; note: string }[] }> {
    const rows = await tx
      .select({ code: leaseClauseTemplates.code, title: leaseClauseTemplates.title, note: leaseClauseTemplates.note })
      .from(leaseClauseTemplates)
      .where(eq(leaseClauseTemplates.workspaceId, workspaceId))
      .orderBy(asc(leaseClauseTemplates.sortOrder));
    return { clauses: rows };
  }

  /** The register's next number, keeping its prefix and width ("L-KC-025" → "L-KC-026"). */
  private async nextLeaseReference(tx: Db, workspaceId: string): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`lease-reference:${workspaceId}`}))`);
    const rows = await tx
      .select({ reference: leases.reference })
      .from(leases)
      .where(and(eq(leases.workspaceId, workspaceId), isNotNull(leases.reference)));
    let prefix = 'L-';
    let width = 3;
    let max = 0;
    for (const { reference } of rows) {
      const m = reference?.match(/^(.*?)(\d+)$/);
      if (!m) continue;
      const n = Number(m[2]);
      if (n > max) {
        max = n;
        prefix = m[1];
        width = m[2].length;
      }
    }
    return `${prefix}${String(max + 1).padStart(width, '0')}`;
  }
}

/** A uniform draw in [0, 1) from the CSPRNG: a gate code must not be guessable from the last one. */
function randomInt(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const e = (error as { cause?: { code?: string; constraint?: string } }).cause ?? (error as { code?: string; constraint?: string });
  return e?.code === '23505' && (e.constraint === constraint || e.constraint === undefined);
}
