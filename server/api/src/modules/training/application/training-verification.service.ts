import {
  UNKNOWN_TRAINING_VERIFICATION,
  type TrainingVerification,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  trainingCertificates,
  trainingCourses,
} from '../../../database/drizzle/training';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  VERIFICATION_CACHE,
  type VerificationCache,
} from '../domain/verification-cache';

/**
 * The public answer to "is this piece of paper genuine?" (AC-15, AC-16).
 *
 * THE ONLY ENDPOINT IN THE FEATURE WITH NO SESSION AT ALL, and the design
 * follows from that:
 *
 * ONE SHAPE, ONE STATUS CODE, THREE ANSWERS. A valid token, a withdrawn one and
 * one that never existed all return 200 and the same object. This is not
 * tidiness. A 404 for an unknown token turns the endpoint into an oracle:
 * somebody working through guesses learns which ones landed, and the value of a
 * 160-bit token is that they cannot. `UNKNOWN_TRAINING_VERIFICATION` in the
 * contracts is the one definition of the empty answer so the two paths cannot
 * drift into distinguishable shapes.
 *
 * NO BUSINESS NAME AND NO FILE. The certificate records the holder's business
 * and never shows it (AC-12), and the PDF is reachable only by its holder or by
 * staff through a signed url. What a stranger gets is the facts needed to
 * decide whether the paper in their hand is real, and nothing further about the
 * person named on it.
 *
 * CACHED FOR SIXTY SECONDS, PURGED ON WITHDRAWAL. Scanning has to be cheap, and
 * a withdrawn certificate has to stop reading valid immediately rather than a
 * minute later. Those pull against each other and the purge is what resolves
 * it: `TrainingCertificateService.revoke` calls `cache.purge` in the same
 * breath as the write. The TTL is the backstop, not the mechanism.
 */
@Injectable()
export class TrainingVerificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(VERIFICATION_CACHE) private readonly cache: VerificationCache,
  ) {}

  async verify(token: string): Promise<TrainingVerification> {
    // Bounded before it is used as a key, so a megabyte of junk in the path
    // cannot become a megabyte-sized cache entry. Anything longer than a real
    // token is not one.
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return UNKNOWN_TRAINING_VERIFICATION;
    }

    const cached = await this.cache.get(token);
    if (cached) return cached;

    const answer = await this.read(token);

    // The unknown answer is cached too, deliberately. Those are the cheap reads
    // to serve and the ones a prober sends by the thousand; not caching them
    // would mean the only requests that ever reach the database are theirs.
    await this.cache.set(token, answer);

    return answer;
  }

  /**
   * Read the certificate row, and only the row (AC-14).
   *
   * Every displayed value except the course title comes off
   * `training_certificates`, where it was locked at issue. The title is joined
   * because a course's NAME is the one thing a reader benefits from seeing
   * current, and the version beside it is locked, so the pair still says
   * exactly which syllabus was taught.
   */
  private async read(token: string): Promise<TrainingVerification> {
    const [row] = await this.db
      .select({
        serial: trainingCertificates.serial,
        holderName: trainingCertificates.holderName,
        courseVersion: trainingCertificates.courseVersion,
        sessionDate: trainingCertificates.sessionDate,
        venueName: trainingCertificates.venueName,
        districtName: trainingCertificates.districtName,
        leadTrainerName: trainingCertificates.leadTrainerName,
        issuedAt: trainingCertificates.issuedAt,
        revokedAt: trainingCertificates.revokedAt,
        courseTitle: trainingCourses.title,
      })
      .from(trainingCertificates)
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingCertificates.courseId),
      )
      .where(eq(trainingCertificates.verifyToken, token))
      .limit(1);

    if (!row) return UNKNOWN_TRAINING_VERIFICATION;

    return {
      status: row.revokedAt ? 'revoked' : 'valid',
      serial: row.serial,
      holderName: row.holderName,
      courseTitle: row.courseTitle,
      courseVersion: row.courseVersion,
      sessionDate: row.sessionDate,
      venueName: row.venueName,
      districtName: row.districtName,
      leadTrainerName: row.leadTrainerName,
      issuedAt: row.issuedAt.toISOString(),
      // The DATE of the withdrawal, and never the reason. The reason is for the
      // holder and for the audit log; a stranger checking a credential needs to
      // know it was withdrawn, not why, and the why is frequently about a
      // person rather than about a document.
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    };
  }
}

/**
 * 128 characters.
 *
 * A real token is 32. The ceiling exists only to keep an absurd path segment
 * out of the cache; it is not a validation rule, because an invalid token and
 * an unknown one must produce the same answer.
 */
const MAX_TOKEN_LENGTH = 128;
