import type {
  CreateTrainingRegistration,
  TrainingMeQuery,
  TrainingMeResponse,
  TrainingMyCertificate,
  TrainingMyRegistration,
  TrainingRegistrationResult,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';

import { districts, provinces } from '../../../database/drizzle/geography';
import { orgMemberships } from '../../../database/drizzle/org';
import {
  trainingCertificates,
  trainingCourses,
  trainingRegistrations,
  trainingSessions,
  trainingVenues,
} from '../../../database/drizzle/training';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { verificationUrl } from '../domain/training-certificate';
import {
  TRAINING_CONFIG,
  type TrainingConfig,
} from '../domain/training-config';
import {
  VENUE_COLUMNS,
  type Paging,
  type VenueRow,
  iso,
  metaFor,
  pagingFor,
  toVenueSummary,
} from './training-shared';
import { TrainingNotificationsService } from './training-notifications.service';

/**
 * Registering for a session, pulling out of one, and reading your own.
 *
 * THE EMAIL IS NEVER TAKEN FROM THE REQUEST. It comes from the Better Auth
 * session, because an address typed into a form is an address the sender does
 * not have to own, and this request is what a certificate eventually hangs
 * from. The registration stores what was resolved as a record of the day
 * (AC-3); every mail goes to the account's CURRENT address at send time
 * (AC-20), never to that snapshot.
 *
 * THE BUSINESS IS VERIFIED, NOT ACCEPTED. An `orgId` is checked against the
 * caller's own live memberships before it is written. Without that check, any
 * signed-in person could name any business on the platform and have a
 * certificate recorded against it, which is a quiet way to claim an
 * association nobody granted. Free text is unverified by nature and is
 * therefore never printed or treated as a claim about a real org.
 */
@Injectable()
export class TrainingRegistrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(TRAINING_CONFIG) private readonly config: TrainingConfig,
    private readonly notifications: TrainingNotificationsService,
  ) {}

  /**
   * Register for a published session (AC-2, AC-3, AC-4, AC-5, AC-33).
   *
   * REGISTERING TWICE IS A SUCCESS, NOT A CONFLICT (AC-4). It returns the
   * existing registration with `alreadyRegistered: true`. Somebody who taps
   * Register again, or reloads a form, has not done anything wrong, and an
   * error for a thing that already worked is the worst answer available. The
   * unique constraint on `(session_id, user_id)` is what makes this true under
   * two simultaneous requests rather than usually: the second insert loses the
   * race, and the catch below reads the winner's row.
   *
   * THE SEAT COUNT DOES NOT REFUSE ANYBODY (AC-5). It is advisory. The public
   * read reports `isOverSubscribed` so the page can warn before the commit, and
   * that warning is the whole of the mechanism.
   */
  async register(
    input: CreateTrainingRegistration,
    caller: { userId: string; email: string },
  ): Promise<TrainingRegistrationResult> {
    const session = await this.loadRegisterableSession(input.sessionId);

    if (input.orgId) {
      await this.assertCallerHoldsOrg(caller.userId, input.orgId);
    }

    const existing = await this.findRegistration(
      input.sessionId,
      caller.userId,
    );
    if (existing) {
      return {
        registrationId: existing.id,
        status: existing.status,
        alreadyRegistered: true,
        feeRwf: existing.feeRwf,
        currency: 'RWF',
      };
    }

    try {
      const [row] = await this.db
        .insert(trainingRegistrations)
        .values({
          sessionId: input.sessionId,
          userId: caller.userId,
          fullName: input.fullName,
          // The session's address, lower cased to match the `lower()` unique
          // index the schema uses in place of citext.
          email: caller.email.trim().toLowerCase(),
          phone: input.phone,
          orgId: input.orgId ?? null,
          businessName: input.orgId ? null : (input.businessName ?? null),
          // Copied from the session, never joined (AC-33). A later price
          // change must not rewrite what somebody signed up for.
          feeRwf: session.feeRwf,
        })
        .returning({
          id: trainingRegistrations.id,
          status: trainingRegistrations.status,
          feeRwf: trainingRegistrations.feeRwf,
        });

      // AFTER the insert and outside any transaction (AC-20). The row is
      // written and the seat is theirs whatever the queue does next, which is
      // why this call cannot throw: see `TrainingNotificationsService`.
      await this.notifications.registered(row.id);

      return {
        registrationId: row.id,
        status: row.status,
        alreadyRegistered: false,
        feeRwf: row.feeRwf,
        currency: 'RWF',
      };
    } catch (error) {
      // Lost the race on `training_registrations_session_user_uk`. The other
      // request created exactly the row this one wanted, so read it and answer
      // as though this request had found it in the first place.
      const raced = await this.findRegistration(
        input.sessionId,
        caller.userId,
      );
      if (raced) {
        // The winner's request raised this same event under the same derived
        // job id, so BullMQ answers with the job it already has. Raising it
        // here anyway is what makes the two paths indistinguishable to the
        // caller, which is the whole point of AC-4.
        await this.notifications.registered(raced.id);
        return {
          registrationId: raced.id,
          status: raced.status,
          alreadyRegistered: true,
          feeRwf: raced.feeRwf,
          currency: 'RWF',
        };
      }
      throw error;
    }
  }

  /**
   * Withdraw your own registration before the session starts (AC-29).
   *
   * Three refusals, each for a different reason and each with its own status:
   *
   *   - Somebody else's registration: 403. Not a 404, because the caller is
   *     asking about a row that exists and the honest answer is that it is not
   *     theirs to cancel.
   *   - The session has started: 409. The seat was used or wasted; either way
   *     the fact has already happened.
   *   - Already withdrawn: also 409, and deliberately not a silent success,
   *     because a person tapping withdraw twice should not be told twice that
   *     something changed.
   *
   * The seat frees itself: `withdrawn` is excluded from the count both the
   * public read and the admin read use, so there is no counter to decrement.
   */
  async withdraw(
    registrationId: string,
    callerUserId: string,
  ): Promise<{ status: 'withdrawn' }> {
    const [row] = await this.db
      .select({
        userId: trainingRegistrations.userId,
        status: trainingRegistrations.status,
        startsAt: trainingSessions.startsAt,
      })
      .from(trainingRegistrations)
      .innerJoin(
        trainingSessions,
        eq(trainingSessions.id, trainingRegistrations.sessionId),
      )
      .where(eq(trainingRegistrations.id, registrationId))
      .limit(1);

    if (!row) throw new NotFoundException('No such registration.');
    if (row.userId !== callerUserId) {
      throw new ForbiddenException('That registration is not yours.');
    }
    if (row.status === 'withdrawn') {
      throw new ConflictException('You already withdrew from that session.');
    }
    if (row.startsAt.getTime() <= Date.now()) {
      throw new ConflictException(
        'That session has already started, so it cannot be withdrawn from.',
      );
    }

    await this.db
      .update(trainingRegistrations)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(eq(trainingRegistrations.id, registrationId));

    return { status: 'withdrawn' };
  }

  /**
   * My registrations and my certificates, both paged.
   *
   * The two halves page independently because they answer different questions
   * and grow at different rates: a person registers a few times and holds one
   * certificate per session they actually attended.
   */
  async me(
    callerUserId: string,
    query: TrainingMeQuery,
  ): Promise<TrainingMeResponse> {
    const paging = pagingFor(query);

    const [registrations, certificates] = await Promise.all([
      this.myRegistrations(callerUserId, paging),
      this.myCertificates(callerUserId, paging),
    ]);

    return { registrations, certificates };
  }

  private async myRegistrations(
    callerUserId: string,
    paging: Paging,
  ): Promise<TrainingMeResponse['registrations']> {
    const where = eq(trainingRegistrations.userId, callerUserId);

    const [[totals], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(trainingRegistrations)
        .where(where),
      this.db
        .select({
          id: trainingRegistrations.id,
          status: trainingRegistrations.status,
          source: trainingRegistrations.source,
          registeredAt: trainingRegistrations.registeredAt,
          feeRwf: trainingRegistrations.feeRwf,
          sessionId: trainingSessions.id,
          startsAt: trainingSessions.startsAt,
          endsAt: trainingSessions.endsAt,
          sessionStatus: trainingSessions.status,
          courseId: trainingCourses.id,
          courseTitle: trainingCourses.title,
          courseSlug: trainingCourses.slug,
          certificateId: trainingCertificates.id,
          venue: VENUE_COLUMNS,
        })
        .from(trainingRegistrations)
        .innerJoin(
          trainingSessions,
          eq(trainingSessions.id, trainingRegistrations.sessionId),
        )
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
        .leftJoin(
          trainingCertificates,
          eq(trainingCertificates.registrationId, trainingRegistrations.id),
        )
        .where(where)
        .orderBy(desc(trainingSessions.startsAt))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    const items: TrainingMyRegistration[] = rows.map((row) => ({
      id: row.id,
      status: row.status,
      source: row.source,
      registeredAt: row.registeredAt.toISOString(),
      feeRwf: row.feeRwf,
      currency: 'RWF',
      session: {
        id: row.sessionId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        status: row.sessionStatus,
        venue: toVenueSummary(row.venue as VenueRow),
      },
      course: {
        id: row.courseId,
        title: row.courseTitle,
        slug: row.courseSlug,
      },
      certificateId: row.certificateId,
    }));

    return { items, meta: metaFor(paging, totals?.total ?? 0) };
  }

  /**
   * My certificates, read off the certificate rows alone (AC-14).
   *
   * The course TITLE is joined, and the version is not: the version is locked
   * on the row and the title is not a locked column, so this join is the one
   * place the live title is used. That is the correct trade for a screen the
   * holder reads (they should see the course's current name), and it is exactly
   * what the PDF does NOT do, because a printed document must never change.
   */
  private async myCertificates(
    callerUserId: string,
    paging: Paging,
  ): Promise<TrainingMeResponse['certificates']> {
    const where = eq(trainingRegistrations.userId, callerUserId);

    const [[totals], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(trainingCertificates)
        .innerJoin(
          trainingRegistrations,
          eq(trainingRegistrations.id, trainingCertificates.registrationId),
        )
        .where(where),
      this.db
        .select({
          id: trainingCertificates.id,
          serial: trainingCertificates.serial,
          verifyToken: trainingCertificates.verifyToken,
          courseVersion: trainingCertificates.courseVersion,
          holderName: trainingCertificates.holderName,
          sessionDate: trainingCertificates.sessionDate,
          venueName: trainingCertificates.venueName,
          districtName: trainingCertificates.districtName,
          leadTrainerName: trainingCertificates.leadTrainerName,
          issuedAt: trainingCertificates.issuedAt,
          revokedAt: trainingCertificates.revokedAt,
          revocationReason: trainingCertificates.revocationReason,
          pdfObjectKey: trainingCertificates.pdfObjectKey,
          courseTitle: trainingCourses.title,
        })
        .from(trainingCertificates)
        .innerJoin(
          trainingRegistrations,
          eq(trainingRegistrations.id, trainingCertificates.registrationId),
        )
        .innerJoin(
          trainingCourses,
          eq(trainingCourses.id, trainingCertificates.courseId),
        )
        .where(where)
        .orderBy(desc(trainingCertificates.issuedAt))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    const items: TrainingMyCertificate[] = rows.map((row) => ({
      id: row.id,
      serial: row.serial,
      verifyUrl: verificationUrl(this.config.verifyBaseUrl, row.verifyToken),
      courseTitle: row.courseTitle,
      courseVersion: row.courseVersion,
      holderName: row.holderName,
      sessionDate: row.sessionDate,
      venueName: row.venueName,
      districtName: row.districtName,
      leadTrainerName: row.leadTrainerName,
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: iso(row.revokedAt),
      revocationReason: row.revocationReason,
      hasPdf: row.pdfObjectKey !== null,
    }));

    return { items, meta: metaFor(paging, totals?.total ?? 0) };
  }

  /**
   * A session somebody may still register for.
   *
   * 410 for a cancelled session rather than 404, because the caller has a link
   * to something that genuinely existed and the useful answer is "this is
   * over", not "this never was". A draft or an unpublished course is a 404, the
   * same answer the public read gives, so neither confirms a draft exists.
   */
  private async loadRegisterableSession(
    sessionId: string,
  ): Promise<{ feeRwf: number }> {
    const [row] = await this.db
      .select({
        feeRwf: trainingSessions.feeRwf,
        status: trainingSessions.status,
        cancelledAt: trainingSessions.cancelledAt,
        coursePublished: trainingCourses.isPublished,
      })
      .from(trainingSessions)
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingSessions.courseId),
      )
      .where(eq(trainingSessions.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('No such training session.');
    if (row.cancelledAt || row.status === 'cancelled') {
      throw new GoneException('That session was cancelled.');
    }
    if (row.status !== 'published' || !row.coursePublished) {
      throw new NotFoundException('No such training session.');
    }

    return { feeRwf: row.feeRwf };
  }

  private async findRegistration(
    sessionId: string,
    userId: string,
  ): Promise<
    | {
        id: string;
        status: TrainingMyRegistration['status'];
        feeRwf: number;
      }
    | undefined
  > {
    const [row] = await this.db
      .select({
        id: trainingRegistrations.id,
        status: trainingRegistrations.status,
        feeRwf: trainingRegistrations.feeRwf,
      })
      .from(trainingRegistrations)
      .where(
        and(
          eq(trainingRegistrations.sessionId, sessionId),
          eq(trainingRegistrations.userId, userId),
        ),
      )
      .limit(1);

    return row;
  }

  /**
   * The caller really is in that business.
   *
   * `status = 'active'` AND `removed_at is null`, both, because the table
   * carries a text status and a timestamp and a removed membership may be
   * marked either way. Asking for both means a person removed from a business
   * cannot register on its behalf the next day.
   */
  private async assertCallerHoldsOrg(
    userId: string,
    orgId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.status, 'active'),
          isNull(orgMemberships.removedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnprocessableEntityException(
        'That is not one of your businesses. Pick one you hold, or type a name instead.',
      );
    }
  }

  /**
   * A short-lived read of the holder's own PDF (AC-13).
   *
   * THE HOLDER OR STAFF, AND NOBODY ELSE. The check is on the registration's
   * `user_id`, not on the certificate's `holder_name`, because a name is not an
   * identity and two people share one often enough.
   *
   * The TTL is capped at 900 seconds by the contract and asked for at 300 here:
   * a link long enough to click and short enough that a copied URL in a chat
   * message stops working. The signed url is the only way to the file; the
   * public verification page never serves it.
   */
  async pdfLink(
    certificateId: string,
    caller: { userId: string; isStaff: boolean },
  ): Promise<{ objectKey: string; ttlSeconds: number }> {
    const [row] = await this.db
      .select({
        objectKey: trainingCertificates.pdfObjectKey,
        holderUserId: trainingRegistrations.userId,
      })
      .from(trainingCertificates)
      .innerJoin(
        trainingRegistrations,
        eq(trainingRegistrations.id, trainingCertificates.registrationId),
      )
      .where(eq(trainingCertificates.id, certificateId))
      .limit(1);

    if (!row) throw new NotFoundException('No such certificate.');
    if (!caller.isStaff && row.holderUserId !== caller.userId) {
      throw new ForbiddenException('That certificate is not yours.');
    }
    if (!row.objectKey) {
      throw new NotFoundException(
        'That certificate has no file yet. It can be re-rendered from its record.',
      );
    }

    return { objectKey: row.objectKey, ttlSeconds: PDF_LINK_TTL_SECONDS };
  }
}

/** Long enough to click, short enough that a copied link goes stale (AC-13). */
const PDF_LINK_TTL_SECONDS = 300;
