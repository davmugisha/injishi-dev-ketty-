import {
  type CreateTrainingWalkIn,
  type RecordTrainingAttendance,
  type RecordTrainingAttendanceResult,
  type TrainingRosterEntry,
  type TrainingRosterQuery,
  type TrainingRosterResponse,
  type TrainingWalkInResult,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { districts } from '../../../database/drizzle/geography';
import {
  trainingAttendanceDecisions,
  trainingCertificates,
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
  CERTIFICATE_RENDERER,
  type CertificateRenderer,
  formatSerial,
  marketCalendarDate,
  mintVerifyToken,
  verificationUrl,
} from '../domain/training-certificate';
import {
  TRAINING_CONFIG,
  type TrainingConfig,
} from '../domain/training-config';
import { StorageService } from '../../storage/application/storage.service';
import type { SessionActor } from './training-session.service';
import { iso, metaFor, pagingFor } from './training-shared';
import { TrainingNotificationsService } from './training-notifications.service';

/**
 * The roster and the tick: the one place a certificate comes into existence.
 *
 * ATTENDANCE AT A LIVE SESSION, RECORDED BY A NAMED TRAINER, IS THE ONLY THING
 * THAT ISSUES A CERTIFICATE (AC-9). There is no other writer of
 * `training_certificates`, and there must never be one. Every other property
 * the credential claims rests on that: if a certificate could appear any other
 * way, "this person attended" would stop being what the paper means.
 *
 * WHAT IS INSIDE THE TRANSACTION AND WHAT IS NOT, because this is the detail
 * most likely to be got wrong later:
 *
 *   - INSIDE: the decision row, the certificate row with every value locked,
 *     and the registration's new status. AC-9 requires the decision and the
 *     certificate to commit together, and they do. A tick that recorded
 *     attendance but failed to issue, or issued without recording why, are both
 *     states nobody could explain afterwards.
 *   - OUTSIDE, deliberately: rendering the PDF and putting it in object
 *     storage. That is a network call to MinIO, and holding a database
 *     transaction open across it would make a slow store into database lock
 *     contention. `pdf_object_key` is nullable exactly so this is safe: the
 *     certificate is the ROW, the PDF is a rendering of it, and the row carries
 *     every value needed to rebuild the file (AC-14). A store that was down
 *     costs a missing file, recoverable by re-rendering, not a lost fact about
 *     somebody's day.
 *
 * IDEMPOTENCY IS NOT OPTIONAL HERE. A trainer ticks a roster on a phone in a
 * hall with bad signal and taps twice. The key is unique in the database, so
 * the second tap finds the first decision and returns it, and no second serial
 * is ever minted. A serial that has been printed cannot be withdrawn quietly.
 */
@Injectable()
export class TrainingRosterService {
  private readonly log = new Logger(TrainingRosterService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(TRAINING_CONFIG) private readonly config: TrainingConfig,
    @Inject(CERTIFICATE_RENDERER)
    private readonly renderer: CertificateRenderer,
    private readonly storage: StorageService,
    private readonly notifications: TrainingNotificationsService,
  ) {}

  /**
   * One page of a session's roster, with the decision that currently stands.
   *
   * The latest decision comes from a correlated subquery ordered by
   * `decided_at desc` rather than from a column on the registration, because
   * the decisions table is append only (AC-11) and the registration's `status`
   * is a projection of it. Reading the status alone would lose "when was this
   * decided and by whom", which is the first question asked about a disputed
   * certificate.
   */
  async roster(
    sessionId: string,
    query: TrainingRosterQuery,
    actor: SessionActor,
  ): Promise<TrainingRosterResponse> {
    await this.assertSessionExists(sessionId);
    await this.assertMayMark(sessionId, actor);

    const paging = pagingFor(query);
    const where = eq(trainingRegistrations.sessionId, sessionId);

    const [[totals], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(trainingRegistrations)
        .where(where),
      this.db
        .select({
          registrationId: trainingRegistrations.id,
          userId: trainingRegistrations.userId,
          fullName: trainingRegistrations.fullName,
          email: trainingRegistrations.email,
          phone: trainingRegistrations.phone,
          orgId: trainingRegistrations.orgId,
          businessName: trainingRegistrations.businessName,
          status: trainingRegistrations.status,
          source: trainingRegistrations.source,
          registeredAt: trainingRegistrations.registeredAt,
          latestDecision: sql<'present' | 'absent' | null>`(
            select d.decision from ${trainingAttendanceDecisions} d
            where d.registration_id = ${trainingRegistrations.id}
            order by d.decided_at desc, d.id desc
            limit 1
          )`,
          latestDecisionAt: sql<Date | null>`(
            select d.decided_at from ${trainingAttendanceDecisions} d
            where d.registration_id = ${trainingRegistrations.id}
            order by d.decided_at desc, d.id desc
            limit 1
          )`,
          decisionCount: sql<number>`(
            select count(*)::int from ${trainingAttendanceDecisions} d
            where d.registration_id = ${trainingRegistrations.id}
          )`,
          certificateId: trainingCertificates.id,
          certificateSerial: trainingCertificates.serial,
          certificateRevokedAt: trainingCertificates.revokedAt,
        })
        .from(trainingRegistrations)
        .leftJoin(
          trainingCertificates,
          eq(trainingCertificates.registrationId, trainingRegistrations.id),
        )
        .where(where)
        .orderBy(asc(trainingRegistrations.fullName))
        .limit(paging.limit)
        .offset(paging.offset),
    ]);

    const items: TrainingRosterEntry[] = rows.map((row) => ({
      registrationId: row.registrationId,
      userId: row.userId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      orgId: row.orgId,
      businessName: row.businessName,
      status: row.status,
      source: row.source,
      registeredAt: row.registeredAt.toISOString(),
      latestDecision: row.latestDecision,
      latestDecisionAt: row.latestDecisionAt
        ? new Date(row.latestDecisionAt).toISOString()
        : null,
      decisionCount: row.decisionCount,
      certificateId: row.certificateId,
      certificateSerial: row.certificateSerial,
      certificateRevokedAt: iso(row.certificateRevokedAt),
    }));

    return { items, meta: metaFor(paging, totals?.total ?? 0) };
  }

  /**
   * The tick (AC-9, AC-11, AC-12, AC-14, AC-17, AC-18).
   *
   * A REPLAY RETURNS THE FIRST ANSWER AND CHANGES NOTHING. The idempotency key
   * is checked first for a fast path and is unique in the database as the real
   * guarantee, so two simultaneous taps cannot both pass the check and both
   * insert.
   *
   * A LATER DECISION SUPERSEDES AN EARLIER ONE WITHOUT DELETING IT (AC-11).
   * Marking somebody absent after marking them present appends a second row and
   * moves the registration to `absent`; it does NOT delete the certificate,
   * because a certificate that was issued and should not have been is withdrawn
   * with a reason (AC-22, AC-23), not erased. So this method never revokes: it
   * records the correction and leaves the withdrawal to somebody who has to type
   * a reason.
   */
  async recordAttendance(
    registrationId: string,
    input: RecordTrainingAttendance,
    actor: SessionActor,
  ): Promise<RecordTrainingAttendanceResult> {
    const context = await this.loadRegistrationContext(registrationId);
    await this.assertMayMark(context.sessionId, actor);

    if (context.rosterClosedAt) {
      throw new ConflictException('That roster is closed.');
    }

    const replay = await this.findByIdempotencyKey(input.idempotencyKey);
    if (replay) return replay;

    const outcome = await this.db.transaction(async (tx) => {
      const [decision] = await tx
        .insert(trainingAttendanceDecisions)
        .values({
          registrationId,
          sessionId: context.sessionId,
          decision: input.decision,
          decidedBy: actor.userId,
          reason: input.reason ?? null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning({ id: trainingAttendanceDecisions.id });

      const status = input.decision === 'present' ? 'attended' : 'absent';
      await tx
        .update(trainingRegistrations)
        .set({ status, updatedAt: new Date() })
        .where(eq(trainingRegistrations.id, registrationId));

      if (input.decision !== 'present') {
        return {
          decisionId: decision.id,
          registrationStatus: status,
          certificateId: null,
          certificateSerial: null,
          issuedNow: false,
        } satisfies RecordTrainingAttendanceResult;
      }

      // Already holds one? Then a previous present decision issued it. Ticking
      // present twice through two different keys must not mint a second.
      const [held] = await tx
        .select({
          id: trainingCertificates.id,
          serial: trainingCertificates.serial,
        })
        .from(trainingCertificates)
        .where(eq(trainingCertificates.registrationId, registrationId))
        .limit(1);

      if (held) {
        return {
          decisionId: decision.id,
          registrationStatus: status,
          certificateId: held.id,
          certificateSerial: held.serial,
          issuedNow: false,
        } satisfies RecordTrainingAttendanceResult;
      }

      const sessionDate = marketCalendarDate(context.startsAt);

      // The sequence, not a count of rows. `nextval` is atomic and never
      // reissues, where `max(serial) + 1` under two concurrent ticks hands the
      // same number to both. Sequences do not roll back, which is exactly why
      // AC-18 promises uniqueness and not contiguity.
      const [{ value: sequence }] = await tx.execute<{ value: number }>(
        sql`select nextval('training_certificate_serial_seq')::int as value`,
      ).then((result) => result.rows as Array<{ value: number }>);

      const [certificate] = await tx
        .insert(trainingCertificates)
        .values({
          registrationId,
          courseId: context.courseId,
          // Every one of these is a COPY taken now (AC-14). A course retitled,
          // a venue renamed or a lead trainer swapped tomorrow cannot alter
          // what this certificate says.
          courseVersion: context.courseVersion,
          serial: formatSerial(sessionDate, sequence),
          verifyToken: mintVerifyToken(),
          holderName: context.fullName,
          holderOrgId: context.orgId,
          holderBusinessName: context.businessName,
          sessionDate,
          venueName: context.venueName,
          districtName: context.districtName,
          leadTrainerName: context.leadTrainerName,
          issuedBy: actor.userId,
        })
        .returning({
          id: trainingCertificates.id,
          serial: trainingCertificates.serial,
        });

      return {
        decisionId: decision.id,
        registrationStatus: status,
        certificateId: certificate.id,
        certificateSerial: certificate.serial,
        issuedNow: true,
      } satisfies RecordTrainingAttendanceResult;
    });

    // Outside the transaction, on purpose. See the class header.
    if (outcome.issuedNow && outcome.certificateId) {
      await this.attachPdf(outcome.certificateId);
      // And only then the mail (AC-20), because `attachPdf` is what puts the
      // PDF in the store and the mail is defined by having it attached. Raised
      // even when that store failed: the job re-reads the row, finds no
      // `pdf_object_key`, and retries across the next fifteen minutes rather
      // than sending a certificate announcement with no certificate on it.
      await this.notifications.certificateIssued(registrationId);
    }

    return outcome;
  }

  /**
   * Render the PDF and attach it to an issued certificate (AC-12, AC-13).
   *
   * READS THE ROW BACK rather than taking the values it was just handed, so
   * that the file is provably built from the locked columns and from nothing
   * else. That is the property AC-14 is about, and passing the values in would
   * make it true by coincidence instead.
   *
   * A FAILURE HERE IS LOGGED AND SWALLOWED. The tick has already committed and
   * the person did attend; throwing now would answer the trainer's tap with an
   * error for a thing that worked, and a retried tap would find the certificate
   * already issued and return `issuedNow: false` without ever trying the render
   * again. Leaving `pdf_object_key` null is the honest, recoverable state: the
   * contracts report it as `hasPdf: false`, and the row still carries
   * everything needed to build the file later.
   */
  private async attachPdf(certificateId: string): Promise<void> {
    try {
      const [row] = await this.db
        .select()
        .from(trainingCertificates)
        .where(eq(trainingCertificates.id, certificateId))
        .limit(1);

      if (!row) return;

      const [course] = await this.db
        .select({ title: trainingCourses.title })
        .from(trainingCourses)
        .where(eq(trainingCourses.id, row.courseId))
        .limit(1);

      const pdf = await this.renderer.render({
        serial: row.serial,
        holderName: row.holderName,
        courseTitle: course?.title ?? '',
        courseVersion: row.courseVersion,
        sessionDate: row.sessionDate,
        venueName: row.venueName,
        districtName: row.districtName,
        leadTrainerName: row.leadTrainerName,
        issuedOn: marketCalendarDate(row.issuedAt),
        verifyUrl: verificationUrl(
          this.config.verifyBaseUrl,
          row.verifyToken,
        ),
      });

      const objectKey = await this.storage.putTrainingCertificate({
        body: pdf,
        serial: row.serial,
        issuedByUserId: row.issuedBy,
      });

      await this.db
        .update(trainingCertificates)
        .set({ pdfObjectKey: objectKey, updatedAt: new Date() })
        .where(eq(trainingCertificates.id, certificateId));
    } catch (error) {
      this.log.error(
        `Certificate ${certificateId} was issued but its PDF could not be stored. The row holds every value needed to re-render it.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Add somebody who turned up without registering (AC-8).
   *
   * IT MATCHES AN EXISTING ACCOUNT BY EMAIL AND NEVER MAKES A SECOND ONE. This
   * is the whole point: a walk-in who already has an Injishi account must end
   * up with their certificate on the identity they can actually sign in to. A
   * duplicate account means a credential attached to a mailbox nobody checks.
   *
   * Matched case-insensitively, against the `lower()` unique index the schema
   * uses everywhere instead of citext.
   *
   * A GENUINELY NEW EMAIL CREATES A USER WITH NO PASSWORD AND NO CREDENTIAL
   * ROW. There is nothing to sign in with, and nothing to guess: the person
   * claims the account later through the ordinary email OTP, which is the same
   * path everybody else takes. `email_verified` stays false, because a trainer
   * typing an address is not proof the person owns it.
   */
  async addWalkIn(
    sessionId: string,
    input: CreateTrainingWalkIn,
    actor: SessionActor,
  ): Promise<TrainingWalkInResult> {
    const session = await this.assertSessionExists(sessionId);
    await this.assertMayMark(sessionId, actor);

    if (session.rosterClosedAt) {
      throw new ConflictException('That roster is closed.');
    }
    if (input.orgId) await this.assertOrgExists(input.orgId);

    const email = input.email.trim().toLowerCase();

    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);

      const linkedExistingUser = existing.length > 0;
      let userId = existing[0]?.id;

      if (!userId) {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            emailVerified: false,
            name: input.fullName,
          })
          .returning({ id: users.id });
        userId = created.id;
      }

      const alreadyOn = await tx
        .select({ id: trainingRegistrations.id })
        .from(trainingRegistrations)
        .where(
          and(
            eq(trainingRegistrations.sessionId, sessionId),
            eq(trainingRegistrations.userId, userId),
          ),
        )
        .limit(1);

      if (alreadyOn.length > 0) {
        throw new ConflictException(
          'That person is already on this session’s roster.',
        );
      }

      const [registration] = await tx
        .insert(trainingRegistrations)
        .values({
          sessionId,
          userId,
          source: 'walk_in',
          fullName: input.fullName,
          email,
          phone: input.phone,
          orgId: input.orgId ?? null,
          businessName: input.orgId ? null : (input.businessName ?? null),
          feeRwf: session.feeRwf,
        })
        .returning({ id: trainingRegistrations.id });

      return {
        registrationId: registration.id,
        source: 'walk_in' as const,
        linkedExistingUser,
      };
    });
  }

  /** A replayed tick, found by its key. Returns the first answer unchanged. */
  private async findByIdempotencyKey(
    key: string,
  ): Promise<RecordTrainingAttendanceResult | undefined> {
    const [row] = await this.db
      .select({
        decisionId: trainingAttendanceDecisions.id,
        decision: trainingAttendanceDecisions.decision,
        registrationId: trainingAttendanceDecisions.registrationId,
        status: trainingRegistrations.status,
        certificateId: trainingCertificates.id,
        certificateSerial: trainingCertificates.serial,
      })
      .from(trainingAttendanceDecisions)
      .innerJoin(
        trainingRegistrations,
        eq(trainingRegistrations.id, trainingAttendanceDecisions.registrationId),
      )
      .leftJoin(
        trainingCertificates,
        eq(trainingCertificates.registrationId, trainingRegistrations.id),
      )
      .where(eq(trainingAttendanceDecisions.idempotencyKey, key))
      .limit(1);

    if (!row) return undefined;

    return {
      decisionId: row.decisionId,
      registrationStatus: row.status,
      certificateId: row.certificateId,
      certificateSerial: row.certificateSerial,
      // Never true on a replay. The point of the flag is to let a client
      // confirm once rather than on every retry.
      issuedNow: false,
    };
  }

  /**
   * Everything a certificate is locked from, gathered in one read.
   *
   * One query rather than several so that the values cannot come from two
   * moments in time. The lead trainer's NAME is resolved here, not the co
   * trainer who happened to tick: AC-7 makes them equal for acting and keeps
   * the lead as the one who is named.
   */
  private async loadRegistrationContext(registrationId: string): Promise<{
    sessionId: string;
    courseId: string;
    courseVersion: number;
    startsAt: Date;
    rosterClosedAt: Date | null;
    fullName: string;
    orgId: string | null;
    businessName: string | null;
    venueName: string;
    districtName: string;
    leadTrainerName: string;
  }> {
    const [row] = await this.db
      .select({
        sessionId: trainingSessions.id,
        courseId: trainingCourses.id,
        courseVersion: trainingCourses.version,
        startsAt: trainingSessions.startsAt,
        rosterClosedAt: trainingSessions.rosterClosedAt,
        fullName: trainingRegistrations.fullName,
        orgId: trainingRegistrations.orgId,
        businessName: trainingRegistrations.businessName,
        venueName: trainingVenues.name,
        districtName: districts.name,
        leadTrainerName: sql<string | null>`(
          select coalesce(u.name, u.email) from ${trainingSessionTrainers} t
          join ${users} u on u.id = t.user_id
          where t.session_id = ${trainingSessions.id} and t.is_lead
          limit 1
        )`,
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
      .innerJoin(trainingVenues, eq(trainingVenues.id, trainingSessions.venueId))
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .where(eq(trainingRegistrations.id, registrationId))
      .limit(1);

    if (!row) throw new NotFoundException('No such registration.');

    if (!row.leadTrainerName) {
      // A certificate names the lead trainer, so a session with no lead cannot
      // issue one. The partial unique index makes two leads impossible and
      // says nothing about none, so this is the check that has to exist in
      // code. 422 rather than 500: the fix is to put a lead on the session.
      throw new UnprocessableEntityException(
        'That session has no lead trainer, so no certificate can name one.',
      );
    }

    return {
      ...row,
      districtName: row.districtName ?? '',
      leadTrainerName: row.leadTrainerName,
    };
  }

  private async assertSessionExists(sessionId: string): Promise<{
    feeRwf: number;
    rosterClosedAt: Date | null;
  }> {
    const [row] = await this.db
      .select({
        feeRwf: trainingSessions.feeRwf,
        rosterClosedAt: trainingSessions.rosterClosedAt,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('No such training session.');
    return row;
  }

  private async assertOrgExists(orgId: string): Promise<void> {
    const [row] = await this.db.execute<{ exists: boolean }>(
      sql`select exists(select 1 from orgs where id = ${orgId}) as exists`,
    ).then((result) => result.rows as Array<{ exists: boolean }>);

    if (!row?.exists) {
      throw new UnprocessableEntityException('No such business.');
    }
  }

  /**
   * May this actor mark this session's roster? (AC-7)
   *
   * The same membership rule the session verbs use, restated here rather than
   * imported from `TrainingSessionService` to keep the two services free of a
   * circular dependency. It is four lines and one query; a shared helper class
   * for it would be a third place to look.
   */
  private async assertMayMark(
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
      throw new NotFoundException('No such training session.');
    }
  }
}
