import type {
  AdminTrainingSession,
  AdminTrainingSessionListQuery,
  AdminTrainingSessionListResponse,
  AdminTrainingTrainerListQuery,
  AdminTrainingTrainerListResponse,
  CancelAdminTrainingSession,
  CancelAdminTrainingSessionResult,
  CloseTrainingRosterResult,
  CreateAdminTrainingSession,
  TrainingSessionTrainer,
  UpdateAdminTrainingSession,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { adminUsers } from '../../../database/drizzle/governance';
import { districts, provinces } from '../../../database/drizzle/geography';
import {
  trainingAttendanceDecisions,
  trainingCourses,
  trainingRegistrations,
  trainingSessionTrainers,
  trainingSessions,
  trainingVenues,
} from '../../../database/drizzle/training';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  VENUE_COLUMNS,
  type VenueRow,
  iso,
  metaFor,
  pagingFor,
  toAdminVenue,
} from './training-shared';
import { TrainingNotificationsService } from './training-notifications.service';

/**
 * A session's whole life: drafted, published, rescheduled, cancelled, closed.
 *
 * THE TWO AUTHORITIES THIS FILE KEEPS APART, because conflating them is the
 * feature's main authorization risk:
 *
 *   - WHO MAY TOUCH THIS SESSION is membership of `training_session_trainers`,
 *     or being a platform admin. `assertMayManage` is the one place that asks,
 *     and it treats a lead and a co trainer as equal (AC-7): the person
 *     standing in the room has to be able to close the roster whether or not
 *     they are the named lead.
 *   - WHAT MAY BE DONE AT ALL is the staff permission on the route.
 *     `training.session.publish` is platform-admin-only, so a trainer reaching
 *     `assertMayManage` for a publish never gets that far: the guard refused
 *     them first. The two checks answer different questions and neither
 *     substitutes for the other.
 *
 * The lead trainer's name is copied onto certificates at issue, which is why
 * exactly one lead is a database rule rather than a check here. This file only
 * has to avoid WRITING two, and the partial unique index is what makes that
 * true under a race rather than usually.
 */
@Injectable()
export class TrainingSessionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notifications: TrainingNotificationsService,
  ) {}

  async list(
    query: AdminTrainingSessionListQuery,
  ): Promise<AdminTrainingSessionListResponse> {
    const paging = pagingFor(query);
    const clauses = [];
    if (query.status) clauses.push(eq(trainingSessions.status, query.status));
    if (query.courseId) {
      clauses.push(eq(trainingSessions.courseId, query.courseId));
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const [[totals], rows] = await Promise.all([
      this.db.select({ total: count() }).from(trainingSessions).where(where),
      this.db
        .select(SESSION_COLUMNS)
        .from(trainingSessions)
        .innerJoin(
          trainingCourses,
          eq(trainingCourses.id, trainingSessions.courseId),
        )
        .innerJoin(
          trainingVenues,
          eq(trainingVenues.id, trainingSessions.venueId),
        )
        .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
        .leftJoin(provinces, eq(provinces.id, districts.provinceId))
        .where(where)
        .orderBy(asc(trainingSessions.startsAt))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    const ids = rows.map((r) => r.session.id);
    const [trainers, counts] = await Promise.all([
      this.trainersFor(ids),
      this.registrationCounts(ids),
    ]);

    return {
      items: rows.map((row) =>
        toSessionView(
          row,
          trainers.get(row.session.id) ?? [],
          counts.get(row.session.id) ?? 0,
        ),
      ),
      meta: metaFor(paging, totals?.total ?? 0),
    };
  }

  /**
   * The people a session form may offer as trainers: live staff holding
   * `trainer` (AC-7, AC-24).
   *
   * `revoked_at IS NULL` is the same predicate `staffAccessForUser` applies, so
   * nobody `StaffGuard` would refuse is offered here as somebody to lead a room.
   * A super_admin who also teaches must hold `trainer` to be listed; holding
   * every training power is not the same statement as being one of the people
   * who runs sessions.
   *
   * THIS IS A PICKER, NOT A RULE. `assertTrainersExist` still accepts any
   * account as a lead, as it did before this list existed. Narrowing the API to
   * the trainer role would be its own decision, and a screen reading this list
   * does not make it.
   *
   * Only id, name and email are selected, so nothing wider can leak into the
   * response even if the contract parse were skipped. Ordered by name with the
   * unnamed last, then email, then id, so pages are stable.
   */
  async listTrainers(
    query: AdminTrainingTrainerListQuery,
  ): Promise<AdminTrainingTrainerListResponse> {
    const paging = pagingFor(query);
    const where = and(
      sql`'trainer' = ANY(${adminUsers.staffRoles})`,
      isNull(adminUsers.revokedAt),
    );

    const [[totals], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(adminUsers)
        .innerJoin(users, eq(users.id, adminUsers.userId))
        .where(where),
      this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(adminUsers)
        .innerJoin(users, eq(users.id, adminUsers.userId))
        .where(where)
        .orderBy(sql`${users.name} asc nulls last`, asc(users.email), asc(users.id))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, name: row.name, email: row.email })),
      meta: metaFor(paging, totals?.total ?? 0),
    };
  }

  /**
   * Draft a session.
   *
   * It starts `draft` and nothing a trainer sends can change that: publishing
   * is a separate verb behind a separate permission. The venue must be ACTIVE
   * at this point too, not only at publish, because offering a retired hall in
   * the picker and then refusing it later wastes the trainer's time.
   */
  async create(
    input: CreateAdminTrainingSession,
    actorUserId: string,
  ): Promise<AdminTrainingSession> {
    await this.assertCourseExists(input.courseId);
    await this.assertVenueBookable(input.venueId);
    await this.assertTrainersExist([
      input.leadTrainerId,
      ...(input.coTrainerIds ?? []),
    ]);

    const sessionId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(trainingSessions)
        .values({
          courseId: input.courseId,
          venueId: input.venueId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          feeRwf: input.feeRwf,
          seatCount: input.seatCount,
          createdBy: actorUserId,
        })
        .returning({ id: trainingSessions.id });

      await this.writeTrainers(
        tx,
        row.id,
        input.leadTrainerId,
        input.coTrainerIds ?? [],
      );

      return row.id;
    });

    return this.get(sessionId);
  }

  /**
   * Edit a session.
   *
   * MOVING `startsAt` ON A PUBLISHED SESSION NEEDS A REASON, because every
   * registrant is mailed one. A reschedule with a blank reason is a message
   * that tells somebody their plans changed and not why, so the pairing is
   * refused here rather than papered over with a default phrase.
   *
   * `rescheduled_from` records the PREVIOUS start time, stamped only when the
   * time actually moves, so an edit that only changes the seat count does not
   * leave a session looking as though it was rescheduled to where it already
   * was.
   */
  async update(
    id: string,
    input: UpdateAdminTrainingSession,
    actor: SessionActor,
  ): Promise<AdminTrainingSession> {
    const current = await this.loadForWrite(id);
    await this.assertMayManage(id, actor);

    if (current.cancelledAt) {
      throw new ConflictException('That session is cancelled.');
    }
    if (input.venueId && input.venueId !== current.venueId) {
      await this.assertVenueBookable(input.venueId);
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
    if (endsAt <= startsAt) {
      throw new UnprocessableEntityException(
        'A session has to end after it starts.',
      );
    }

    const timeMoved = startsAt.getTime() !== current.startsAt.getTime();
    const isPublished = current.status === 'published';
    if (timeMoved && isPublished && !input.rescheduleReason) {
      throw new UnprocessableEntityException(
        'Moving a published session needs a reason, because every registrant is told it.',
      );
    }

    if (input.leadTrainerId || input.coTrainerIds) {
      await this.assertTrainersExist([
        ...(input.leadTrainerId ? [input.leadTrainerId] : []),
        ...(input.coTrainerIds ?? []),
      ]);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(trainingSessions)
        .set({
          venueId: input.venueId ?? current.venueId,
          startsAt,
          endsAt,
          feeRwf: input.feeRwf ?? current.feeRwf,
          seatCount: input.seatCount ?? current.seatCount,
          rescheduledFrom:
            timeMoved && isPublished
              ? current.startsAt
              : current.rescheduledFrom,
          updatedAt: new Date(),
        })
        .where(eq(trainingSessions.id, id));

      if (input.leadTrainerId || input.coTrainerIds) {
        const lead = input.leadTrainerId ?? (await this.leadOf(tx, id));
        if (!lead) {
          throw new UnprocessableEntityException(
            'A session needs exactly one lead trainer.',
          );
        }
        await tx
          .delete(trainingSessionTrainers)
          .where(eq(trainingSessionTrainers.sessionId, id));
        await this.writeTrainers(tx, id, lead, input.coTrainerIds ?? []);
      }
    });

    // AFTER the commit (AC-21). Everybody holding a place is told, the pending
    // reminder is dropped and a new one is set against the new time.
    //
    // Only when the session was PUBLISHED and the time actually moved: editing
    // a draft is nobody else's business, and changing a seat count is not news.
    // The reason is passed along because nothing stores it — the check above
    // already refuses a move without one, and `domain/training-mail.ts` records
    // why that value travels on the job rather than in a column.
    if (timeMoved && isPublished) {
      await this.notifications.sessionRescheduled(
        id,
        current.startsAt,
        startsAt,
        input.rescheduleReason ?? '',
      );
    }

    return this.get(id);
  }

  /**
   * Publish a session (AC-6).
   *
   * THE VENUE IS CHECKED AGAIN HERE, and that is the whole of AC-32's teeth: a
   * session drafted at a hall the company has since stopped using must not go
   * out to the public, and the draft may have been sitting for weeks. 409
   * rather than 422, because nothing about the request is malformed. The state
   * of the world changed.
   */
  async publish(
    id: string,
    actorUserId: string,
  ): Promise<AdminTrainingSession> {
    const current = await this.loadForWrite(id);

    if (current.status === 'cancelled') {
      throw new ConflictException('That session is cancelled.');
    }
    if (current.publishedAt) {
      throw new ConflictException('That session is already published.');
    }

    const [venue] = await this.db
      .select({ retiredAt: trainingVenues.retiredAt })
      .from(trainingVenues)
      .where(eq(trainingVenues.id, current.venueId))
      .limit(1);

    if (venue?.retiredAt) {
      throw new ConflictException(
        'That venue is retired. Move the session somewhere else before publishing it.',
      );
    }

    await this.db
      .update(trainingSessions)
      .set({
        status: 'published',
        publishedAt: new Date(),
        // The person who PUBLISHED it, never the person who drafted it. The
        // two are different people by design: a trainer drafts, a platform
        // admin publishes, and `published_by` is the record of who let it out.
        publishedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(trainingSessions.id, id));

    // Publishing is what starts the reminder clock (AC-20): the session is now
    // open for registration, so there is something to remind people about. One
    // delayed job for the whole session, fanned out 24 hours before it starts.
    await this.notifications.sessionPublished(id, current.startsAt);

    return this.get(id);
  }

  /**
   * Cancel a session, releasing only the undecided (AC-21).
   *
   * SOMEBODY ALREADY MARKED PRESENT STAYS `attended` AND KEEPS THEIR
   * CERTIFICATE. This is the single most easily broken rule in the feature: the
   * obvious implementation sets every registration on the session to `released`
   * in one statement, which would silently invalidate the attendance of people
   * who were in the room. A session cancelled halfway through, or cancelled in
   * the records days later, must not unmake what happened.
   *
   * So the update carries the "has no present decision" predicate, and the two
   * counts are reported separately so the person cancelling sees both numbers.
   */
  async cancel(
    id: string,
    input: CancelAdminTrainingSession,
    actor: SessionActor,
  ): Promise<CancelAdminTrainingSessionResult> {
    const current = await this.loadForWrite(id);
    await this.assertMayManage(id, actor);

    if (current.cancelledAt) {
      throw new ConflictException('That session is already cancelled.');
    }

    const { released, keptAttended } = await this.db.transaction(
      async (tx) => {
        const attended = await tx
          .select({ id: trainingRegistrations.id })
          .from(trainingRegistrations)
          .where(
            and(
              eq(trainingRegistrations.sessionId, id),
              eq(trainingRegistrations.status, 'attended'),
            ),
          );

        const releasedRows = await tx
          .update(trainingRegistrations)
          .set({ status: 'released', updatedAt: new Date() })
          .where(
            and(
              eq(trainingRegistrations.sessionId, id),
              // Only the undecided. `attended` and `absent` are decisions a
              // trainer made and are not the company's to overwrite, and
              // `withdrawn` already left of their own accord.
              eq(trainingRegistrations.status, 'registered'),
              sql`not exists (
                select 1 from ${trainingAttendanceDecisions}
                where ${trainingAttendanceDecisions.registrationId} = ${trainingRegistrations.id}
                  and ${trainingAttendanceDecisions.decision} = 'present'
              )`,
            ),
          )
          .returning({ id: trainingRegistrations.id });

        await tx
          .update(trainingSessions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: input.reason,
            updatedAt: new Date(),
          })
          .where(eq(trainingSessions.id, id));

        return {
          released: releasedRows.length,
          keptAttended: attended.length,
        };
      },
    );

    // AFTER the commit (AC-21), so an unreachable Redis cannot roll back a
    // cancellation. Everybody except the people who withdrew hears, including
    // the ones already marked present, whose certificates are unaffected and
    // who would otherwise read the silence as their record being unmade too.
    await this.notifications.sessionCancelled(id, current.startsAt);

    return {
      session: await this.get(id),
      releasedCount: released,
      keptAttendedCount: keptAttended,
    };
  }

  /**
   * Close the roster: everybody undecided becomes absent, in one action (AC-10).
   *
   * It issues nothing. Closing is the trainer saying "that is everyone who
   * came", and the people it touches are precisely the ones nobody ticked, so
   * by definition none of them earned a certificate.
   *
   * A decision ROW is written for each of them, not just a status, because the
   * decisions table is the audit trail: "who said this person was absent, and
   * when" has to have an answer for a closed roster too. The idempotency key is
   * derived from the registration and the closure so a second close is a no-op
   * at the database rather than a second batch of rows.
   */
  async closeRoster(
    id: string,
    actor: SessionActor,
  ): Promise<CloseTrainingRosterResult> {
    const current = await this.loadForWrite(id);
    await this.assertMayManage(id, actor);

    if (current.rosterClosedAt) {
      throw new ConflictException('That roster is already closed.');
    }

    const closedAt = new Date();

    const markedAbsent = await this.db.transaction(async (tx) => {
      const undecided = await tx
        .select({ id: trainingRegistrations.id })
        .from(trainingRegistrations)
        .where(
          and(
            eq(trainingRegistrations.sessionId, id),
            eq(trainingRegistrations.status, 'registered'),
            sql`not exists (
              select 1 from ${trainingAttendanceDecisions}
              where ${trainingAttendanceDecisions.registrationId} = ${trainingRegistrations.id}
            )`,
          ),
        );

      if (undecided.length > 0) {
        await tx.insert(trainingAttendanceDecisions).values(
          undecided.map((row) => ({
            registrationId: row.id,
            sessionId: id,
            decision: 'absent' as const,
            decidedBy: actor.userId,
            reason: 'Roster closed with no decision recorded.',
            idempotencyKey: `close-roster:${id}:${row.id}`,
            decidedAt: closedAt,
          })),
        );

        await tx
          .update(trainingRegistrations)
          .set({ status: 'absent', updatedAt: closedAt })
          .where(
            inArray(
              trainingRegistrations.id,
              undecided.map((row) => row.id),
            ),
          );
      }

      await tx
        .update(trainingSessions)
        .set({
          status: 'completed',
          rosterClosedAt: closedAt,
          updatedAt: closedAt,
        })
        .where(eq(trainingSessions.id, id));

      return undecided.length;
    });

    return { markedAbsent, rosterClosedAt: closedAt.toISOString() };
  }

  /** One session, joined for display. */
  async get(id: string): Promise<AdminTrainingSession> {
    const rows = await this.db
      .select(SESSION_COLUMNS)
      .from(trainingSessions)
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingSessions.courseId),
      )
      .innerJoin(trainingVenues, eq(trainingVenues.id, trainingSessions.venueId))
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(eq(trainingSessions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) throw new NotFoundException('No such training session.');

    const [trainers, counts] = await Promise.all([
      this.trainersFor([id]),
      this.registrationCounts([id]),
    ]);

    return toSessionView(row, trainers.get(id) ?? [], counts.get(id) ?? 0);
  }

  /**
   * May this actor manage this session? (AC-7)
   *
   * A platform admin always may. A trainer may only if they are ON the session,
   * lead or co. This is the ONE reader of that rule; a second copy is how a co
   * trainer eventually finds they can tick a roster but not close it.
   */
  async assertMayManage(
    sessionId: string,
    actor: SessionActor,
  ): Promise<void> {
    if (actor.isPlatformAdmin) return;

    const [row] = await this.db
      .select({ userId: trainingSessionTrainers.userId })
      .from(trainingSessionTrainers)
      .where(
        and(
          eq(trainingSessionTrainers.sessionId, sessionId),
          eq(trainingSessionTrainers.userId, actor.userId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ForbiddenException('That is not one of your sessions.');
    }
  }

  private async loadForWrite(id: string): Promise<{
    status: 'draft' | 'published' | 'cancelled' | 'completed';
    venueId: string;
    startsAt: Date;
    endsAt: Date;
    feeRwf: number;
    seatCount: number;
    cancelledAt: Date | null;
    publishedAt: Date | null;
    rescheduledFrom: Date | null;
    rosterClosedAt: Date | null;
    createdBy: string;
  }> {
    const [row] = await this.db
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('No such training session.');

    return {
      status: row.status,
      venueId: row.venueId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      feeRwf: row.feeRwf,
      seatCount: row.seatCount,
      cancelledAt: row.cancelledAt,
      publishedAt: row.publishedAt,
      rescheduledFrom: row.rescheduledFrom,
      rosterClosedAt: row.rosterClosedAt,
      createdBy: row.createdBy,
    };
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: trainingCourses.id })
      .from(trainingCourses)
      .where(eq(trainingCourses.id, courseId))
      .limit(1);
    if (!row) throw new UnprocessableEntityException('No such course.');
  }

  /** A venue that exists and has not been retired (AC-32). */
  private async assertVenueBookable(venueId: string): Promise<void> {
    const [row] = await this.db
      .select({ retiredAt: trainingVenues.retiredAt })
      .from(trainingVenues)
      .where(eq(trainingVenues.id, venueId))
      .limit(1);

    if (!row) throw new UnprocessableEntityException('No such venue.');
    if (row.retiredAt) {
      throw new UnprocessableEntityException(
        'That venue is retired. Pick one that is still in use.',
      );
    }
  }

  /**
   * Every named trainer is a real account.
   *
   * Checked before the insert so a typo answers 422 rather than arriving as a
   * foreign key violation, which surfaces as a 500 and tells the caller
   * nothing. It does NOT check that they hold the `trainer` staff role: a
   * platform admin who teaches a session is the normal case at launch, and
   * requiring the role would make the company's own staff unable to lead one.
   */
  private async assertTrainersExist(userIds: string[]): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;

    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, unique));

    if (rows.length !== unique.length) {
      throw new UnprocessableEntityException(
        'One of those trainers is not an account on this platform.',
      );
    }
  }

  /** Write the lead and the co trainers. Exactly one row carries `is_lead`. */
  private async writeTrainers(
    tx: DbLike,
    sessionId: string,
    leadTrainerId: string,
    coTrainerIds: string[],
  ): Promise<void> {
    const cos = [...new Set(coTrainerIds)].filter((id) => id !== leadTrainerId);

    await tx.insert(trainingSessionTrainers).values([
      { sessionId, userId: leadTrainerId, isLead: true },
      ...cos.map((userId) => ({ sessionId, userId, isLead: false })),
    ]);
  }

  private async leadOf(
    tx: DbLike,
    sessionId: string,
  ): Promise<string | undefined> {
    const rows = await tx
      .select({ userId: trainingSessionTrainers.userId })
      .from(trainingSessionTrainers)
      .where(
        and(
          eq(trainingSessionTrainers.sessionId, sessionId),
          eq(trainingSessionTrainers.isLead, true),
        ),
      )
      .limit(1);

    return rows[0]?.userId;
  }

  private async trainersFor(
    sessionIds: string[],
  ): Promise<Map<string, TrainingSessionTrainer[]>> {
    const grouped = new Map<string, TrainingSessionTrainer[]>();
    if (sessionIds.length === 0) return grouped;

    const rows = await this.db
      .select({
        sessionId: trainingSessionTrainers.sessionId,
        userId: trainingSessionTrainers.userId,
        isLead: trainingSessionTrainers.isLead,
        name: users.name,
        email: users.email,
      })
      .from(trainingSessionTrainers)
      .innerJoin(users, eq(users.id, trainingSessionTrainers.userId))
      .where(inArray(trainingSessionTrainers.sessionId, sessionIds));

    for (const row of rows) {
      const list = grouped.get(row.sessionId) ?? [];
      list.push({
        userId: row.userId,
        // The email is the fallback rather than a placeholder, because staff
        // screens are about knowing who somebody is and `users.name` is
        // nullable until a profile is filled in.
        name: row.name ?? row.email,
        isLead: row.isLead,
      });
      // The lead first, so a screen can read the first entry without sorting.
      list.sort((a, b) => Number(b.isLead) - Number(a.isLead));
      grouped.set(row.sessionId, list);
    }

    return grouped;
  }

  /** Live places held, the same definition the public read uses. */
  private async registrationCounts(
    sessionIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (sessionIds.length === 0) return counts;

    const rows = await this.db
      .select({ sessionId: trainingRegistrations.sessionId, total: count() })
      .from(trainingRegistrations)
      .where(
        and(
          inArray(trainingRegistrations.sessionId, sessionIds),
          ne(trainingRegistrations.status, 'withdrawn'),
          ne(trainingRegistrations.status, 'released'),
        ),
      )
      .groupBy(trainingRegistrations.sessionId);

    for (const row of rows) counts.set(row.sessionId, row.total);
    return counts;
  }
}

/**
 * Who is acting, and whether the platform trusts them beyond their own sessions.
 *
 * `isPlatformAdmin` is resolved at the controller from the staff permissions the
 * guard already put on the request, never from a role string here. The API's
 * own model is the authority on what a permission means, and a service that
 * re-derived it would be the second copy this codebase keeps deleting.
 */
export interface SessionActor {
  readonly userId: string;
  readonly isPlatformAdmin: boolean;
}

/** The narrow slice of a Drizzle handle the helpers need, so a `tx` fits it. */
type DbLike = Pick<Database, 'insert' | 'select' | 'delete' | 'update'>;

const SESSION_COLUMNS = {
  session: {
    id: trainingSessions.id,
    status: trainingSessions.status,
    startsAt: trainingSessions.startsAt,
    endsAt: trainingSessions.endsAt,
    feeRwf: trainingSessions.feeRwf,
    seatCount: trainingSessions.seatCount,
    publishedAt: trainingSessions.publishedAt,
    cancelledAt: trainingSessions.cancelledAt,
    cancellationReason: trainingSessions.cancellationReason,
    rescheduledFrom: trainingSessions.rescheduledFrom,
    rosterClosedAt: trainingSessions.rosterClosedAt,
    createdAt: trainingSessions.createdAt,
  },
  course: {
    id: trainingCourses.id,
    title: trainingCourses.title,
    slug: trainingCourses.slug,
    version: trainingCourses.version,
    isPublished: trainingCourses.isPublished,
  },
  venue: VENUE_COLUMNS,
};

interface SessionQueryRow {
  session: {
    id: string;
    status: 'draft' | 'published' | 'cancelled' | 'completed';
    startsAt: Date;
    endsAt: Date;
    feeRwf: number;
    seatCount: number;
    publishedAt: Date | null;
    cancelledAt: Date | null;
    cancellationReason: string | null;
    rescheduledFrom: Date | null;
    rosterClosedAt: Date | null;
    createdAt: Date;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    version: number;
    isPublished: boolean;
  };
  venue: unknown;
}

function toSessionView(
  row: SessionQueryRow,
  trainers: TrainingSessionTrainer[],
  registrationCount: number,
): AdminTrainingSession {
  return {
    id: row.session.id,
    status: row.session.status,
    course: row.course,
    venue: toAdminVenue(row.venue as VenueRow),
    startsAt: row.session.startsAt.toISOString(),
    endsAt: row.session.endsAt.toISOString(),
    feeRwf: row.session.feeRwf,
    currency: 'RWF',
    seatCount: row.session.seatCount,
    registrationCount,
    trainers,
    publishedAt: iso(row.session.publishedAt),
    cancelledAt: iso(row.session.cancelledAt),
    cancellationReason: row.session.cancellationReason,
    rescheduledFrom: iso(row.session.rescheduledFrom),
    rosterClosedAt: iso(row.session.rosterClosedAt),
    createdAt: row.session.createdAt.toISOString(),
  };
}
