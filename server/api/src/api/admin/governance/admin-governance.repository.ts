import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, isNotNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type {
  AdminAuditQuery,
  AdminAuditSubjectType,
  AdminComplianceArtifactType,
  AdminDsrRequestType,
  AdminDsrState,
  AdminEscalationState,
  AdminEscalationSubjectType,
  AdminEscalationType,
  AdminRecordDataClass,
  AdminSupportTicketState,
} from '@injishi/contracts';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  auditEvents,
  complianceArtifacts,
  dataSubjectRequests,
  escalations,
  guestStays,
  properties,
  recordAccessLogs,
  reviews,
  rooms,
  supportTickets,
  users,
} from '../../../database/drizzle/schema';
import type { Domain } from '@injishi/contracts';

export interface AdminAuditEventRow {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  impersonatedUserId: string | null;
  subjectType: AdminAuditSubjectType | null;
  subjectId: string | null;
  eventType: string;
  reason: string | null;
  districtId: number | null;
  occurredAt: Date;
}

export interface AdminAccessLogEntryRow {
  id: string;
  actorUserId: string;
  actorName: string | null;
  subjectUserId: string | null;
  subjectRef: string | null;
  dataClass: AdminRecordDataClass;
  reason: string;
  occurredAt: Date;
}

export interface AdminComplianceArtifactRow {
  id: string;
  artifactType: AdminComplianceArtifactType;
  processorName: string | null;
  reviewDueAt: Date | null;
  createdAt: Date;
}

export interface AdminDsrEntryRow {
  id: string;
  subjectUserId: string | null;
  requestType: AdminDsrRequestType;
  state: AdminDsrState;
  retentionExceptionApplied: boolean;
  dualAuthorized: boolean;
  createdAt: Date;
}

export interface AdminComplianceStatsRow {
  openRequests: number;
  overdueReviews: number;
  artifactCount: number;
}

export interface AdminReviewRow {
  id: string;
  propertyName: string | null;
  side: 'guest_to_host' | 'host_to_guest';
  accountName: string | null;
  walkInName: string | null;
  rating: number | null;
  body: string | null;
  state: string;
  createdAt: Date;
}

export interface AdminTicketRow {
  id: string;
  requesterUserId: string | null;
  category: string | null;
  state: AdminSupportTicketState;
  domain: Domain | null;
  districtId: number | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  csat: number | null;
  createdAt: Date;
}

export interface AdminTicketDetailRow extends AdminTicketRow {
  message: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

export interface AdminEscalationRow {
  id: string;
  subjectType: AdminEscalationSubjectType | null;
  subjectId: string | null;
  type: AdminEscalationType;
  state: AdminEscalationState;
  ownerUserId: string | null;
  resolutionNote: string | null;
  districtId: number | null;
  createdAt: Date;
}

/**
 * The only place Compliance, Audit and Moderation touch Drizzle.
 *
 * ONE REPOSITORY FOR THREE SECTIONS, because they are three views of the same
 * thing: what the platform did, who it did it to, and what somebody complained
 * about. Splitting them into three would have produced three copies of the same
 * "newest first, bounded, actor name resolved by left join" shape, and the
 * moment those three copies disagree about whether an actor-less row is shown
 * the audit trail has two truths.
 *
 * Every read here is bounded. These are append-only tables with no natural
 * ceiling, and an unbounded select against one is a denial of service handed to
 * anybody holding a staff session.
 */
@Injectable()
export class AdminGovernanceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // -------------------------------------------------------------------------
  // Audit
  // -------------------------------------------------------------------------

  /**
   * The filter the audit count and the audit page share, so the two can never
   * describe different result sets.
   */
  private auditFilter(query: AdminAuditQuery): SQL | undefined {
    const clauses: SQL[] = [];

    if (query.q) {
      const pattern = `%${query.q}%`;
      // Over the event type AND the reason: an investigator searching this log
      // knows either the name of the thing that happened or the words somebody
      // typed to justify it, rarely both.
      const match = or(
        ilike(auditEvents.eventType, pattern),
        ilike(auditEvents.reason, pattern),
      );
      if (match) clauses.push(match);
    }

    if (query.subjectType) {
      clauses.push(eq(auditEvents.subjectType, query.subjectType));
    }

    if (query.actorUserId) {
      clauses.push(eq(auditEvents.actorUserId, query.actorUserId));
    }

    return clauses.length ? and(...clauses) : undefined;
  }

  async countAuditEvents(query: AdminAuditQuery): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(this.auditFilter(query));
    return row?.n ?? 0;
  }

  listAuditEvents(
    query: AdminAuditQuery,
    limit: number,
    offset: number,
  ): Promise<AdminAuditEventRow[]> {
    return this.db
      .select({
        id: auditEvents.id,
        actorUserId: auditEvents.actorUserId,
        actorName: users.name,
        impersonatedUserId: auditEvents.impersonatedUserId,
        subjectType: auditEvents.subjectType,
        subjectId: auditEvents.subjectId,
        eventType: auditEvents.eventType,
        reason: auditEvents.reason,
        districtId: auditEvents.districtId,
        occurredAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      // LEFT join, and it has to be. `actor_user_id` is nullable because the
      // PLATFORM acts: an expiry sweep has no actor. An inner join would delete
      // exactly those rows from the one table that exists not to lose any.
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(this.auditFilter(query))
      .orderBy(desc(auditEvents.occurredAt), auditEvents.id)
      .limit(limit)
      .offset(offset);
  }

  async countAccessLogs(): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(recordAccessLogs);
    return row?.n ?? 0;
  }

  listAccessLogs(
    limit: number,
    offset: number,
  ): Promise<AdminAccessLogEntryRow[]> {
    return this.db
      .select({
        id: recordAccessLogs.id,
        actorUserId: recordAccessLogs.actorUserId,
        actorName: users.name,
        subjectUserId: recordAccessLogs.subjectUserId,
        subjectRef: recordAccessLogs.subjectRef,
        dataClass: recordAccessLogs.dataClass,
        reason: recordAccessLogs.reason,
        occurredAt: recordAccessLogs.occurredAt,
      })
      .from(recordAccessLogs)
      // `actor_user_id` is NOT NULL here — a read always has a reader — but the
      // join stays LEFT so a deleted account cannot make its own reads vanish
      // from the trail.
      .leftJoin(users, eq(users.id, recordAccessLogs.actorUserId))
      .orderBy(desc(recordAccessLogs.occurredAt), recordAccessLogs.id)
      .limit(limit)
      .offset(offset);
  }

  // -------------------------------------------------------------------------
  // Compliance
  // -------------------------------------------------------------------------

  listComplianceArtifacts(limit: number): Promise<AdminComplianceArtifactRow[]> {
    return this.db
      .select({
        id: complianceArtifacts.id,
        artifactType: complianceArtifacts.artifactType,
        processorName: complianceArtifacts.processorName,
        reviewDueAt: complianceArtifacts.reviewDueAt,
        createdAt: complianceArtifacts.createdAt,
      })
      .from(complianceArtifacts)
      // Soonest review first, nulls last: the screen exists to catch a review
      // going overdue, and an artifact with no due date can never be the most
      // urgent thing on it.
      .orderBy(sql`${complianceArtifacts.reviewDueAt} asc nulls last`)
      .limit(limit);
  }

  listDataSubjectRequests(limit: number): Promise<AdminDsrEntryRow[]> {
    return this.db
      .select({
        id: dataSubjectRequests.id,
        subjectUserId: dataSubjectRequests.subjectUserId,
        requestType: dataSubjectRequests.requestType,
        state: dataSubjectRequests.state,
        retentionExceptionApplied: dataSubjectRequests.retentionExceptionApplied,
        dualAuthorized: dataSubjectRequests.dualAuthorized,
        createdAt: dataSubjectRequests.createdAt,
      })
      .from(dataSubjectRequests)
      // OLDEST first, unlike every other list here. A data subject request has
      // a statutory clock on it, so the one that has been waiting longest is
      // the one that matters — newest-first would bury it.
      .orderBy(dataSubjectRequests.createdAt, dataSubjectRequests.id)
      .limit(limit);
  }

  /**
   * The three headline numbers, counted over the WHOLE tables rather than over
   * the capped lists above.
   *
   * That difference is the point: the lists are bounded for safety, and a stat
   * derived from a bounded list would silently stop counting at the cap and
   * report a compliance posture better than the real one.
   */
  async complianceStats(now: Date): Promise<AdminComplianceStatsRow> {
    const [open] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataSubjectRequests)
      // `received` is the only non-terminal state in `dsr_state`; a fulfilled
      // request is closed. Named explicitly rather than "not fulfilled" so
      // adding a third state to the enum fails a review instead of quietly
      // changing what "open" counts.
      .where(eq(dataSubjectRequests.state, 'received'));

    const [overdue] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(complianceArtifacts)
      .where(
        and(
          isNotNull(complianceArtifacts.reviewDueAt),
          lt(complianceArtifacts.reviewDueAt, now),
        ),
      );

    const [artifacts] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(complianceArtifacts);

    return {
      openRequests: open?.n ?? 0,
      overdueReviews: overdue?.n ?? 0,
      artifactCount: artifacts?.n ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Moderation
  // -------------------------------------------------------------------------

  /**
   * Reviews a moderator may act on.
   *
   * NOT FILTERED BY `moderation_state`, deliberately. That column is `text`
   * with a default of `visible` and no enum behind it, so there is no agreed
   * value meaning "needs attention" — filtering on a guessed one would hide the
   * queue and make the screen look empty on a platform full of reviews. The
   * state travels on every row and the console filters by it.
   */
  listModeratedReviews(limit: number): Promise<AdminReviewRow[]> {
    return this.db
      .select({
        id: reviews.id,
        propertyName: properties.name,
        side: reviews.side,
        accountName: users.name,
        walkInName: guestStays.guestName,
        rating: reviews.overallRating,
        body: reviews.comment,
        state: reviews.moderationState,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .leftJoin(guestStays, eq(guestStays.id, reviews.stayId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(users, eq(users.id, guestStays.guestUserId))
      .orderBy(desc(reviews.createdAt), reviews.id)
      .limit(limit);
  }

  listSupportTickets(limit: number): Promise<AdminTicketRow[]> {
    return this.db
      .select({
        id: supportTickets.id,
        requesterUserId: supportTickets.requesterUserId,
        category: supportTickets.category,
        state: supportTickets.state,
        domain: supportTickets.domain,
        districtId: supportTickets.districtId,
        firstResponseAt: supportTickets.firstResponseAt,
        resolvedAt: supportTickets.resolvedAt,
        csat: supportTickets.csat,
        createdAt: supportTickets.createdAt,
      })
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt), supportTickets.id)
      .limit(limit);
  }

  /** One ticket with what the person wrote and how to answer them, or null. */
  async findSupportTicket(ticketId: string): Promise<AdminTicketDetailRow | null> {
    const [row] = await this.db
      .select({
        id: supportTickets.id,
        requesterUserId: supportTickets.requesterUserId,
        category: supportTickets.category,
        state: supportTickets.state,
        domain: supportTickets.domain,
        districtId: supportTickets.districtId,
        firstResponseAt: supportTickets.firstResponseAt,
        resolvedAt: supportTickets.resolvedAt,
        csat: supportTickets.csat,
        createdAt: supportTickets.createdAt,
        message: supportTickets.message,
        contactEmail: supportTickets.contactEmail,
        contactName: supportTickets.contactName,
        contactPhone: supportTickets.contactPhone,
      })
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);
    return row ?? null;
  }

  /**
   * The access log row for one ticket read: `contact`, because a name, an
   * address and a phone number are what the read discloses. The ticket is the
   * `subject_ref`; the requester, when signed in, the subject.
   */
  async logSupportTicketRead(input: {
    actorUserId: string;
    ticketId: string;
    subjectUserId: string | null;
    reason: string;
  }): Promise<void> {
    await this.db.insert(recordAccessLogs).values({
      actorUserId: input.actorUserId,
      subjectUserId: input.subjectUserId,
      subjectRef: input.ticketId,
      dataClass: 'contact',
      reason: input.reason,
    });
  }

  listEscalations(limit: number): Promise<AdminEscalationRow[]> {
    return this.db
      .select({
        id: escalations.id,
        subjectType: escalations.subjectType,
        subjectId: escalations.subjectId,
        type: escalations.type,
        state: escalations.state,
        ownerUserId: escalations.ownerUserId,
        resolutionNote: escalations.resolutionNote,
        districtId: escalations.districtId,
        createdAt: escalations.createdAt,
      })
      .from(escalations)
      .orderBy(desc(escalations.createdAt), escalations.id)
      .limit(limit);
  }
}
