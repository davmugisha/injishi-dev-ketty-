import type {
  AdminTrainingCourse,
  AdminTrainingCourseListQuery,
  AdminTrainingCourseListResponse,
  AdminTrainingVenue,
  AdminTrainingVenueListQuery,
  AdminTrainingVenueListResponse,
  CreateAdminTrainingCourse,
  CreateAdminTrainingVenue,
  PublishAdminTrainingCourse,
  RetireAdminTrainingVenueResult,
  TrainingCourseListQuery,
  TrainingCourseListResponse,
  TrainingPublicCourse,
  TrainingPublicSession,
  TrainingSessionDetail,
  UpdateAdminTrainingCourse,
  UpdateAdminTrainingVenue,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm';

import { districts, provinces } from '../../../database/drizzle/geography';
import {
  trainingCourses,
  trainingRegistrations,
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
  metaFor,
  pagingFor,
  toAdminVenue,
  toVenueSummary,
} from './training-shared';

/**
 * Courses and venues: what training IS, and where it may happen.
 *
 * Both are the company's decisions rather than a trainer's, which is why they
 * sit behind `training.course.manage` and `training.venue.manage` and not
 * behind `training.session.manage`. A trainer who could mint a course could
 * name the credential anything; a trainer who could type a venue could hold a
 * session anywhere and the certificate would still say Injishi.
 *
 * The public reads live here too, because "which courses and sessions exist"
 * is the same question from both sides with a different filter. Keeping them in
 * one service is what stops a draft leaking: the published predicate is written
 * once, in `publishedSessionsFilter`, and the public path cannot forget it.
 */
@Injectable()
export class TrainingCatalogueService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // -------------------------------------------------------------------------
  // The public read path
  // -------------------------------------------------------------------------

  /**
   * Every published course with its published, not cancelled sessions (AC-1).
   *
   * Two queries rather than one join, then stitched in memory. A single join
   * would page over the CROSS PRODUCT of courses and sessions, so a course with
   * forty sessions would fill a page on its own and push the second course off
   * it. Paging is over COURSES, which is what the caller asked for.
   *
   * A published course with no published session still appears, carrying an
   * empty `sessions` array. That is deliberate: somebody looking for training
   * should be able to see the course exists and that no date is set, rather
   * than see nothing and conclude the company does not run it.
   */
  async listPublicCourses(
    query: TrainingCourseListQuery,
  ): Promise<TrainingCourseListResponse> {
    const paging = pagingFor(query);
    const published = eq(trainingCourses.isPublished, true);

    const [[totals], courseRows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(trainingCourses)
        .where(published),
      this.db
        .select({
          id: trainingCourses.id,
          slug: trainingCourses.slug,
          title: trainingCourses.title,
          summary: trainingCourses.summary,
          version: trainingCourses.version,
        })
        .from(trainingCourses)
        .where(published)
        .orderBy(asc(trainingCourses.title))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    const sessions = await this.publicSessionsForCourses(
      courseRows.map((c) => c.id),
    );

    const items: TrainingPublicCourse[] = courseRows.map((course) => ({
      ...course,
      sessions: sessions.get(course.id) ?? [],
    }));

    return { items, meta: metaFor(paging, totals?.total ?? 0) };
  }

  /**
   * One published session, with its course (AC-6).
   *
   * A draft, a cancelled session, a session of an unpublished course and an id
   * that names nothing all produce the SAME 404. A caller learns only that
   * there is nothing here to register for, which is the honest answer and also
   * the one that does not confirm that a particular draft exists.
   */
  async getPublicSession(id: string): Promise<TrainingSessionDetail> {
    const rows = await this.db
      .select({
        session: {
          id: trainingSessions.id,
          courseId: trainingSessions.courseId,
          startsAt: trainingSessions.startsAt,
          endsAt: trainingSessions.endsAt,
          feeRwf: trainingSessions.feeRwf,
          seatCount: trainingSessions.seatCount,
        },
        venue: VENUE_COLUMNS,
        course: {
          id: trainingCourses.id,
          slug: trainingCourses.slug,
          title: trainingCourses.title,
          summary: trainingCourses.summary,
          version: trainingCourses.version,
        },
      })
      .from(trainingSessions)
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingSessions.courseId),
      )
      .innerJoin(trainingVenues, eq(trainingVenues.id, trainingSessions.venueId))
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(and(eq(trainingSessions.id, id), this.publishedSessionsFilter()))
      .limit(1);

    const row = rows[0];
    if (!row) throw new NotFoundException('No such training session.');

    const counts = await this.registrationCounts([row.session.id]);

    return {
      ...this.toPublicSession(
        row.session,
        row.venue as VenueRow,
        counts.get(row.session.id) ?? 0,
      ),
      course: row.course,
    };
  }

  /**
   * The published sessions of these courses, grouped by course.
   *
   * Not paged, and that is a bounded choice rather than an oversight: the
   * caller has already paged over at most 100 courses, and a course runs a
   * handful of dated sessions at a time. `SESSION_FANOUT_CAP` keeps it honest
   * if that ever stops being true, by taking the soonest sessions rather than
   * an arbitrary slice.
   */
  private async publicSessionsForCourses(
    courseIds: string[],
  ): Promise<Map<string, TrainingPublicSession[]>> {
    const grouped = new Map<string, TrainingPublicSession[]>();
    if (courseIds.length === 0) return grouped;

    const rows = await this.db
      .select({
        session: {
          id: trainingSessions.id,
          courseId: trainingSessions.courseId,
          startsAt: trainingSessions.startsAt,
          endsAt: trainingSessions.endsAt,
          feeRwf: trainingSessions.feeRwf,
          seatCount: trainingSessions.seatCount,
        },
        venue: VENUE_COLUMNS,
      })
      .from(trainingSessions)
      // `training_courses` IS JOINED even though nothing above selects from it,
      // because `publishedSessionsFilter` tests `training_courses.is_published`
      // and a predicate naming a table that is not in the FROM clause is a
      // Postgres error, not a silently ignored clause. Leaving it out made this
      // route answer 500 the moment a published course existed, which is the
      // shape of bug a live run catches and a typecheck cannot: the filter is
      // one shared expression and its table requirements travel with it.
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingSessions.courseId),
      )
      .innerJoin(trainingVenues, eq(trainingVenues.id, trainingSessions.venueId))
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(
        and(
          inArray(trainingSessions.courseId, courseIds),
          this.publishedSessionsFilter(),
        ),
      )
      .orderBy(asc(trainingSessions.startsAt))
      .limit(SESSION_FANOUT_CAP);

    const counts = await this.registrationCounts(
      rows.map((r) => r.session.id),
    );

    for (const row of rows) {
      const list = grouped.get(row.session.courseId) ?? [];
      list.push(
        this.toPublicSession(
          row.session,
          row.venue as VenueRow,
          counts.get(row.session.id) ?? 0,
        ),
      );
      grouped.set(row.session.courseId, list);
    }

    return grouped;
  }

  /**
   * What the public may see: published, not cancelled, of a published course.
   *
   * ONE DEFINITION, called by every public read. A second copy of this
   * predicate is how a draft session eventually appears on a page, which the
   * verify checklist calls the worst thing that can happen here.
   */
  private publishedSessionsFilter(): SQL | undefined {
    return and(
      eq(trainingSessions.status, 'published'),
      isNull(trainingSessions.cancelledAt),
      eq(trainingCourses.isPublished, true),
    );
  }

  /**
   * How many people hold a live place on each of these sessions.
   *
   * `withdrawn` and `released` are excluded, because both freed their seat
   * (AC-29, AC-21). `attended` and `absent` are counted: they were there, or
   * they were expected and were not, and either way the seat was taken.
   */
  private async registrationCounts(
    sessionIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (sessionIds.length === 0) return counts;

    const rows = await this.db
      .select({
        sessionId: trainingRegistrations.sessionId,
        total: count(),
      })
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

  /**
   * A session for a public reader.
   *
   * `seatsRemaining` IS ALLOWED TO GO NEGATIVE (AC-5). The seat count is
   * advisory and registration past it succeeds, so clamping at zero would hide
   * an over-subscribed session from the one person who needs to know: somebody
   * about to travel to it.
   */
  private toPublicSession(
    session: {
      id: string;
      courseId: string;
      startsAt: Date;
      endsAt: Date;
      feeRwf: number;
      seatCount: number;
    },
    venue: VenueRow,
    registrationCount: number,
  ): TrainingPublicSession {
    return {
      id: session.id,
      courseId: session.courseId,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      venue: toVenueSummary(venue),
      feeRwf: session.feeRwf,
      currency: 'RWF',
      seatCount: session.seatCount,
      registrationCount,
      seatsRemaining: session.seatCount - registrationCount,
      isOverSubscribed: registrationCount >= session.seatCount,
    };
  }

  // -------------------------------------------------------------------------
  // Courses, for staff
  // -------------------------------------------------------------------------

  async listCourses(
    query: AdminTrainingCourseListQuery,
  ): Promise<AdminTrainingCourseListResponse> {
    const paging = pagingFor(query);

    const [[totals], rows] = await Promise.all([
      this.db.select({ total: count() }).from(trainingCourses),
      this.db
        .select({
          id: trainingCourses.id,
          slug: trainingCourses.slug,
          title: trainingCourses.title,
          summary: trainingCourses.summary,
          version: trainingCourses.version,
          isPublished: trainingCourses.isPublished,
          sessionCount: sql<number>`(
            select count(*)::int from ${trainingSessions}
            where ${trainingSessions.courseId} = ${trainingCourses.id}
          )`,
          createdAt: trainingCourses.createdAt,
          updatedAt: trainingCourses.updatedAt,
        })
        .from(trainingCourses)
        .orderBy(asc(trainingCourses.title))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      meta: metaFor(paging, totals?.total ?? 0),
    };
  }

  /** A course starts unpublished, always. Publishing is its own verb. */
  async createCourse(
    input: CreateAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    const [existing] = await this.db
      .select({ id: trainingCourses.id })
      .from(trainingCourses)
      .where(eq(trainingCourses.slug, input.slug))
      .limit(1);

    if (existing) {
      throw new ConflictException('A course already uses that slug.');
    }

    const [row] = await this.db
      .insert(trainingCourses)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary,
      })
      .returning();

    return this.courseView(row);
  }

  /**
   * Edit a course, bumping the version only when asked (AC-14's spirit).
   *
   * The version is printed on every certificate already issued and means "this
   * is the syllabus they sat through". Bumping it automatically on any edit
   * would make a corrected typo claim a new syllabus was taught, and the
   * certificates already issued would then name a version that no longer
   * matches the course they name.
   */
  async updateCourse(
    id: string,
    input: UpdateAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    const [current] = await this.db
      .select()
      .from(trainingCourses)
      .where(eq(trainingCourses.id, id))
      .limit(1);

    if (!current) throw new NotFoundException('No such course.');

    const [row] = await this.db
      .update(trainingCourses)
      .set({
        title: input.title ?? current.title,
        summary: input.summary ?? current.summary,
        version: input.bumpVersion ? current.version + 1 : current.version,
        updatedAt: new Date(),
      })
      .where(eq(trainingCourses.id, id))
      .returning();

    return this.courseView(row);
  }

  /** Publish or unpublish. Several courses may be published at once (AC-30). */
  async publishCourse(
    id: string,
    input: PublishAdminTrainingCourse,
  ): Promise<AdminTrainingCourse> {
    const [row] = await this.db
      .update(trainingCourses)
      .set({ isPublished: input.published, updatedAt: new Date() })
      .where(eq(trainingCourses.id, id))
      .returning();

    if (!row) throw new NotFoundException('No such course.');
    return this.courseView(row);
  }

  private async courseView(row: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    version: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AdminTrainingCourse> {
    const [counted] = await this.db
      .select({ total: count() })
      .from(trainingSessions)
      .where(eq(trainingSessions.courseId, row.id));

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      version: row.version,
      isPublished: row.isPublished,
      sessionCount: counted?.total ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Venues, for staff
  // -------------------------------------------------------------------------

  /**
   * The venue list. Active only unless retired ones are asked for.
   *
   * The default matters: this is the list a trainer's session form is filled
   * from, and a retired venue offered in that picker is the bug AC-32 is
   * about. The trainer-facing path never passes `includeRetired`.
   */
  async listVenues(
    query: AdminTrainingVenueListQuery,
  ): Promise<AdminTrainingVenueListResponse> {
    const paging = pagingFor(query);
    const where = query.includeRetired
      ? undefined
      : isNull(trainingVenues.retiredAt);

    const [[totals], rows] = await Promise.all([
      this.db.select({ total: count() }).from(trainingVenues).where(where),
      this.db
        .select(VENUE_COLUMNS)
        .from(trainingVenues)
        .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
        .leftJoin(provinces, eq(provinces.id, districts.provinceId))
        .where(where)
        .orderBy(asc(trainingVenues.name))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    return {
      items: (rows as VenueRow[]).map(toAdminVenue),
      meta: metaFor(paging, totals?.total ?? 0),
    };
  }

  async createVenue(
    input: CreateAdminTrainingVenue,
  ): Promise<AdminTrainingVenue> {
    await this.assertDistrictExists(input.districtId);

    const [row] = await this.db
      .insert(trainingVenues)
      .values({
        name: input.name,
        address: input.address,
        districtId: input.districtId,
        isOffice: input.isOffice ?? false,
      })
      .returning({ id: trainingVenues.id });

    return this.venue(row.id);
  }

  /** A retired venue is not edited. Retiring is one way, and so is its record. */
  async updateVenue(
    id: string,
    input: UpdateAdminTrainingVenue,
  ): Promise<AdminTrainingVenue> {
    const [current] = await this.db
      .select()
      .from(trainingVenues)
      .where(eq(trainingVenues.id, id))
      .limit(1);

    if (!current) throw new NotFoundException('No such venue.');
    if (current.retiredAt) {
      throw new ConflictException('That venue is retired and cannot be edited.');
    }
    if (input.districtId !== undefined) {
      await this.assertDistrictExists(input.districtId);
    }

    await this.db
      .update(trainingVenues)
      .set({
        name: input.name ?? current.name,
        address: input.address ?? current.address,
        districtId: input.districtId ?? current.districtId,
        isOffice: input.isOffice ?? current.isOffice,
        updatedAt: new Date(),
      })
      .where(eq(trainingVenues.id, id));

    return this.venue(id);
  }

  /**
   * Retire a venue (AC-32).
   *
   * ONE WAY, and it does three different things to three kinds of session,
   * which is the whole reason this is per venue rather than a phase switch:
   *
   *   - Drafts at it can no longer be published. Counted and reported, because
   *     retiring a hall silently would leave somebody wondering later why a
   *     session will not publish.
   *   - Sessions already published there still run, and still appear on
   *     `/training`. People have arranged travel.
   *   - The row stays, so certificates already issued still name a real place.
   */
  async retireVenue(id: string): Promise<RetireAdminTrainingVenueResult> {
    const [current] = await this.db
      .select({ retiredAt: trainingVenues.retiredAt })
      .from(trainingVenues)
      .where(eq(trainingVenues.id, id))
      .limit(1);

    if (!current) throw new NotFoundException('No such venue.');
    if (current.retiredAt) {
      throw new ConflictException('That venue is already retired.');
    }

    const [[drafts]] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.venueId, id),
            eq(trainingSessions.status, 'draft'),
          ),
        ),
    ]);

    await this.db
      .update(trainingVenues)
      .set({ retiredAt: new Date(), updatedAt: new Date() })
      .where(eq(trainingVenues.id, id));

    return {
      venue: await this.venue(id),
      draftsNowBlocked: drafts?.total ?? 0,
    };
  }

  /** One venue, joined for display. Used after every write so one shape is returned. */
  async venue(id: string): Promise<AdminTrainingVenue> {
    const rows = await this.db
      .select(VENUE_COLUMNS)
      .from(trainingVenues)
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(eq(trainingVenues.id, id))
      .limit(1);

    const row = rows[0] as VenueRow | undefined;
    if (!row) throw new NotFoundException('No such venue.');
    return toAdminVenue(row);
  }

  /**
   * 422 rather than a foreign key violation.
   *
   * The FK would refuse it anyway, as a 500. A district id typed into a form is
   * user input and deserves an answer that says which field is wrong.
   */
  private async assertDistrictExists(districtId: number): Promise<void> {
    const [row] = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(eq(districts.id, districtId))
      .limit(1);

    if (!row) {
      throw new UnprocessableEntityException('No such district.');
    }
  }
}

/**
 * 500 sessions across one page of courses.
 *
 * A ceiling rather than a page size, because these are stitched under courses
 * that are already paged. Ordered by start time, so if it ever bites, what
 * survives is the soonest sessions, which are the ones somebody can still
 * register for.
 */
const SESSION_FANOUT_CAP = 500;
