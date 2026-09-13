import type {
  AdminTrainingCertificate,
  AdminTrainingCertificateListQuery,
  AdminTrainingCertificateListResponse,
  RevokeTrainingCertificate,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';

import { auditEvents } from '../../../database/drizzle/governance';
import {
  trainingCertificates,
  trainingCourses,
  trainingRegistrations,
} from '../../../database/drizzle/training';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  VERIFICATION_CACHE,
  type VerificationCache,
} from '../domain/verification-cache';
import type { SessionActor } from './training-session.service';
import { iso, metaFor, pagingFor } from './training-shared';

/**
 * Withdrawing a certificate, and listing them for staff (AC-22, AC-23).
 *
 * THREE THINGS HAPPEN TOGETHER OR NOT AT ALL, and each one exists for its own
 * reason:
 *
 *   1. The row is MARKED, never deleted (AC-23). A certificate that vanished
 *      would leave the person holding the paper with no answer at all, and
 *      would free its serial to be handed to somebody else. The public page
 *      says "issued on that date, withdrawn on this one", which is the useful
 *      answer to somebody holding a printed document.
 *   2. An AUDIT ROW is written, in the same transaction (AC-22). A credential
 *      that can be withdrawn with no record of who did it or why is a
 *      credential nobody can rely on having been withdrawn for cause. The
 *      subject type is `training_certificate`, added by migration 0035 rather
 *      than filing it under `user`, so "every audit row about this certificate"
 *      is a query rather than a search through payloads.
 *   3. The verification CACHE ENTRY IS PURGED, after the commit. Without this
 *      the public page keeps reading valid for up to a minute, and a minute is
 *      exactly long enough for the withdrawal to matter. The verify checklist
 *      tests this directly: load the page, revoke, reload.
 *
 * WHO MAY: the issuing trainer, or a platform admin. Not any trainer on the
 * session, and not the holder. The narrowness is the point, because withdrawing
 * is the one action that can take a credential away from somebody.
 */
@Injectable()
export class TrainingCertificateService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(VERIFICATION_CACHE) private readonly cache: VerificationCache,
  ) {}

  async list(
    query: AdminTrainingCertificateListQuery,
  ): Promise<AdminTrainingCertificateListResponse> {
    const paging = pagingFor(query);
    const where = query.sessionId
      ? eq(trainingRegistrations.sessionId, query.sessionId)
      : undefined;

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
        .select(CERTIFICATE_COLUMNS)
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

    return {
      items: rows.map(toCertificateView),
      meta: metaFor(paging, totals?.total ?? 0),
    };
  }

  async revoke(
    certificateId: string,
    input: RevokeTrainingCertificate,
    actor: SessionActor,
  ): Promise<AdminTrainingCertificate> {
    const [current] = await this.db
      .select({
        issuedBy: trainingCertificates.issuedBy,
        revokedAt: trainingCertificates.revokedAt,
        verifyToken: trainingCertificates.verifyToken,
        serial: trainingCertificates.serial,
      })
      .from(trainingCertificates)
      .where(eq(trainingCertificates.id, certificateId))
      .limit(1);

    if (!current) throw new NotFoundException('No such certificate.');

    if (!actor.isPlatformAdmin && current.issuedBy !== actor.userId) {
      throw new ForbiddenException(
        'Only the trainer who issued this certificate, or a platform admin, can withdraw it.',
      );
    }
    if (current.revokedAt) {
      throw new ConflictException('That certificate is already withdrawn.');
    }

    const revokedAt = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(trainingCertificates)
        .set({
          revokedAt,
          revokedBy: actor.userId,
          revocationReason: input.reason,
          updatedAt: revokedAt,
        })
        .where(eq(trainingCertificates.id, certificateId));

      await tx.insert(auditEvents).values({
        actorUserId: actor.userId,
        subjectType: 'training_certificate',
        subjectId: certificateId,
        eventType: 'training.certificate.revoked',
        // The serial rides in the payload as well as the subject id, because
        // the serial is what a dispute arrives quoting and a person reading the
        // trail should not have to resolve an id to recognise it.
        payloadDiff: { serial: current.serial, revokedAt: revokedAt.toISOString() },
        reason: input.reason,
        occurredAt: revokedAt,
      });
    });

    // AFTER the commit, not inside it. Purging first would open a window where
    // the cache is empty and the row still reads valid, so a scan in that
    // window would re-cache the old answer for a full TTL, which is the exact
    // failure the purge exists to prevent.
    await this.cache.purge(current.verifyToken);

    return this.get(certificateId);
  }

  async get(certificateId: string): Promise<AdminTrainingCertificate> {
    const [row] = await this.db
      .select(CERTIFICATE_COLUMNS)
      .from(trainingCertificates)
      .innerJoin(
        trainingRegistrations,
        eq(trainingRegistrations.id, trainingCertificates.registrationId),
      )
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingCertificates.courseId),
      )
      .where(eq(trainingCertificates.id, certificateId))
      .limit(1);

    if (!row) throw new NotFoundException('No such certificate.');
    return toCertificateView(row);
  }
}

const CERTIFICATE_COLUMNS = {
  id: trainingCertificates.id,
  serial: trainingCertificates.serial,
  registrationId: trainingCertificates.registrationId,
  sessionId: trainingRegistrations.sessionId,
  holderName: trainingCertificates.holderName,
  holderUserId: trainingRegistrations.userId,
  courseTitle: trainingCourses.title,
  courseVersion: trainingCertificates.courseVersion,
  sessionDate: trainingCertificates.sessionDate,
  venueName: trainingCertificates.venueName,
  districtName: trainingCertificates.districtName,
  leadTrainerName: trainingCertificates.leadTrainerName,
  issuedAt: trainingCertificates.issuedAt,
  issuedBy: trainingCertificates.issuedBy,
  revokedAt: trainingCertificates.revokedAt,
  revokedBy: trainingCertificates.revokedBy,
  revocationReason: trainingCertificates.revocationReason,
  pdfObjectKey: trainingCertificates.pdfObjectKey,
};

interface CertificateRow {
  id: string;
  serial: string;
  registrationId: string;
  sessionId: string;
  holderName: string;
  holderUserId: string;
  courseTitle: string;
  courseVersion: number;
  sessionDate: string;
  venueName: string;
  districtName: string;
  leadTrainerName: string;
  issuedAt: Date;
  issuedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  pdfObjectKey: string | null;
}

function toCertificateView(row: CertificateRow): AdminTrainingCertificate {
  return {
    id: row.id,
    serial: row.serial,
    registrationId: row.registrationId,
    sessionId: row.sessionId,
    holderName: row.holderName,
    holderUserId: row.holderUserId,
    courseTitle: row.courseTitle,
    courseVersion: row.courseVersion,
    sessionDate: row.sessionDate,
    venueName: row.venueName,
    districtName: row.districtName,
    leadTrainerName: row.leadTrainerName,
    issuedAt: row.issuedAt.toISOString(),
    issuedBy: row.issuedBy,
    revokedAt: iso(row.revokedAt),
    revokedBy: row.revokedBy,
    revocationReason: row.revocationReason,
    hasPdf: row.pdfObjectKey !== null,
  };
}
