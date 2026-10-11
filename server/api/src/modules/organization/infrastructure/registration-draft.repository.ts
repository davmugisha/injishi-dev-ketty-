import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { registrationDrafts } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** One draft per person, replaced whole on every save (ADR-060). */
@Injectable()
export class RegistrationDraftRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(userId: string): Promise<{ payload: unknown; updatedAt: Date } | null> {
    const [row] = await this.db
      .select({ payload: registrationDrafts.payload, updatedAt: registrationDrafts.updatedAt })
      .from(registrationDrafts)
      .where(eq(registrationDrafts.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async save(userId: string, payload: unknown): Promise<void> {
    const now = new Date();
    await this.db
      .insert(registrationDrafts)
      .values({ userId, payload })
      .onConflictDoUpdate({
        target: registrationDrafts.userId,
        set: { payload, updatedAt: now },
      });
  }

  async remove(userId: string): Promise<void> {
    await this.db.delete(registrationDrafts).where(eq(registrationDrafts.userId, userId));
  }
}
