import { Inject, Injectable } from '@nestjs/common';
import { eq, sql, type SQL } from 'drizzle-orm';

import { registrationDrafts } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * One draft per person (ADR-060): the answers, replaced whole on every save,
 * and beside them the checks the server alone writes (ADR-075 D-m).
 * `updated_at` moves only when the answers are saved, so it is when they were
 * saved; a check writes `checks` and leaves it alone.
 */
@Injectable()
export class RegistrationDraftRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(userId: string): Promise<{ payload: unknown; checks: unknown; updatedAt: Date } | null> {
    const [row] = await this.db
      .select({
        payload: registrationDrafts.payload,
        checks: registrationDrafts.checks,
        updatedAt: registrationDrafts.updatedAt,
      })
      .from(registrationDrafts)
      .where(eq(registrationDrafts.userId, userId))
      .limit(1);
    return row ?? null;
  }

  /** Replace the answers, keeping the checks. Answers when they were saved. */
  async save(userId: string, payload: unknown): Promise<Date> {
    const now = new Date();
    const [row] = await this.db
      .insert(registrationDrafts)
      .values({ userId, payload, updatedAt: now })
      .onConflictDoUpdate({
        target: registrationDrafts.userId,
        set: { payload, updatedAt: now },
      })
      .returning({ updatedAt: registrationDrafts.updatedAt });
    return row!.updatedAt;
  }

  async remove(userId: string): Promise<void> {
    await this.db.delete(registrationDrafts).where(eq(registrationDrafts.userId, userId));
  }

  /**
   * The TIN check's answer (D-m), against the TIN it answered and counted, on
   * the caller's draft. The draft row is created when there is none yet,
   * holding only its checks, as a scan does; the answers are left as they were.
   */
  async recordTinCheck(
    userId: string,
    check: { tin: string; capacity: 'owner' | 'on_behalf_of' | null; answer: unknown },
  ): Promise<void> {
    const checkedAt = new Date().toISOString();
    const entry = (attempts: SQL): SQL =>
      sql`jsonb_build_object('tin', ${check.tin}::text, 'capacity', ${check.capacity}::text, 'attempts', ${attempts}, 'answer', ${JSON.stringify(check.answer)}::jsonb, 'checkedAt', ${checkedAt}::text)`;
    await this.db
      .insert(registrationDrafts)
      .values({ userId, checks: sql`jsonb_build_object('tin', ${entry(sql`1`)})` })
      .onConflictDoUpdate({
        target: registrationDrafts.userId,
        set: {
          checks: sql`jsonb_set(${registrationDrafts.checks}, '{tin}', ${entry(
            sql`coalesce((${registrationDrafts.checks} #>> '{tin,attempts}')::int, 0) + 1`,
          )})`,
        },
      });
  }

  /**
   * The registration this draft became at the first Pay press (AC-14). Only a
   * draft that exists is marked: a registration made with none has nothing to
   * remember.
   */
  async markRegistered(userId: string, orgId: string): Promise<void> {
    await this.db
      .update(registrationDrafts)
      .set({ checks: sql`jsonb_set(${registrationDrafts.checks}, '{registrationId}', to_jsonb(${orgId}::text))` })
      .where(eq(registrationDrafts.userId, userId));
  }
}
