import {
  type CreateGovernmentBodyRequest,
  GovernmentBody,
  type UpdateGovernmentBodyRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import {
  auditEvents,
  governmentBodies,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The government body catalogue (D24, ADR-053 AC-G4, AC-G10).
 *
 * A catalogue rather than an enum, because the legally defined set is open:
 * adding RDB or RURA used to be a deployment and is now a row. Mirrors
 * `rdb_classifications`, the other catalogue that has to survive a vocabulary
 * change.
 *
 * NOTHING IS DELETED. Retiring a body sets `active = false`, which takes it out
 * of the choices for a new grant (`OversightGrantsService` refuses a retired
 * code) and leaves every existing grant and every recorded decision naming it.
 * `code` is never edited, because it is what those rows point at.
 *
 * Every write commits with its `audit_events` row naming the acting staffer.
 * The row's `subject_id` is a uuid and a body's key is its code, so the code
 * travels in the payload with `subject_type = 'config'`, the same subject the fee
 * append uses.
 */
@Injectable()
export class GovernmentBodiesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every body, retired ones included, by code. A retired body is still history. */
  async list(): Promise<GovernmentBody[]> {
    const rows = await this.db
      .select(columns)
      .from(governmentBodies)
      .orderBy(asc(governmentBodies.code));
    return rows.map((r) => GovernmentBody.parse(r));
  }

  async create(input: {
    actorUserId: string;
    request: CreateGovernmentBodyRequest;
  }): Promise<GovernmentBody> {
    const r = input.request;
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(governmentBodies)
        .values({
          code: r.code,
          nameEn: r.nameEn,
          nameRw: r.nameRw,
          abbreviation: r.abbreviation ?? null,
        })
        .onConflictDoNothing({ target: governmentBodies.code })
        .returning(columns);
      if (!created) {
        throw new ConflictException({
          code: 'government_body_exists',
          message: `A government body with the code ${r.code} already exists. Rename it instead.`,
        });
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.government_body.created',
        payloadDiff: { governmentBody: { after: created } } as never,
        reason: r.reason,
      });
      return GovernmentBody.parse(created);
    });
  }

  /** Rename, change the abbreviation, retire or restore. Never the code. */
  async update(input: {
    actorUserId: string;
    code: string;
    request: UpdateGovernmentBodyRequest;
  }): Promise<GovernmentBody> {
    const r = input.request;
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select(columns)
        .from(governmentBodies)
        .where(eq(governmentBodies.code, input.code))
        .for('update')
        .limit(1);
      if (!before) throw new NotFoundException('No government body has that code.');

      const [after] = await tx
        .update(governmentBodies)
        .set({
          ...(r.nameEn !== undefined ? { nameEn: r.nameEn } : {}),
          ...(r.nameRw !== undefined ? { nameRw: r.nameRw } : {}),
          ...(r.abbreviation !== undefined ? { abbreviation: r.abbreviation } : {}),
          ...(r.active !== undefined ? { active: r.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(governmentBodies.code, input.code))
        .returning(columns);
      if (!after) throw new NotFoundException('No government body has that code.');

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType:
          before.active && !after.active
            ? 'admin.government_body.retired'
            : !before.active && after.active
              ? 'admin.government_body.restored'
              : 'admin.government_body.renamed',
        payloadDiff: { governmentBody: { before, after } } as never,
        reason: r.reason,
      });
      return GovernmentBody.parse(after);
    });
  }
}

const columns = {
  code: governmentBodies.code,
  nameEn: governmentBodies.nameEn,
  nameRw: governmentBodies.nameRw,
  abbreviation: governmentBodies.abbreviation,
  active: governmentBodies.active,
};
