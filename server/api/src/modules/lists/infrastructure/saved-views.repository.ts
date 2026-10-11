import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, or, sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { listSavedViews, reportRuns } from '../../../database/drizzle/lists';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface SavedViewRow {
  id: string;
  orgId: string;
  userId: string;
  listKey: string;
  name: string;
  config: unknown;
  shared: boolean;
  isDefault: boolean;
  authorName: string | null;
  updatedAt: Date;
}

/**
 * Saved list views and the export log (058-list-framework). The only place that
 * touches Drizzle for either table.
 */
@Injectable()
export class SavedViewsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly columns = {
    id: listSavedViews.id,
    orgId: listSavedViews.orgId,
    userId: listSavedViews.userId,
    listKey: listSavedViews.listKey,
    name: listSavedViews.name,
    config: listSavedViews.config,
    shared: listSavedViews.shared,
    isDefault: listSavedViews.isDefault,
    authorName: users.name,
    updatedAt: listSavedViews.updatedAt,
  };

  /** The caller's own views of a list and every view shared at the business. */
  async visible(orgId: string, userId: string, listKey: string): Promise<SavedViewRow[]> {
    return this.db
      .select(this.columns)
      .from(listSavedViews)
      .leftJoin(users, eq(users.id, listSavedViews.userId))
      .where(
        and(
          eq(listSavedViews.orgId, orgId),
          eq(listSavedViews.listKey, listKey),
          or(eq(listSavedViews.userId, userId), eq(listSavedViews.shared, true)),
        ),
      )
      .orderBy(asc(sql`lower(${listSavedViews.name})`));
  }

  async find(id: string, tx?: Tx): Promise<SavedViewRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.columns)
      .from(listSavedViews)
      .leftJoin(users, eq(users.id, listSavedViews.userId))
      .where(eq(listSavedViews.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Clear the person's other default for this list, so the partial unique index holds. */
  async clearDefault(tx: Tx, orgId: string, userId: string, listKey: string): Promise<void> {
    await tx
      .update(listSavedViews)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(listSavedViews.orgId, orgId),
          eq(listSavedViews.userId, userId),
          eq(listSavedViews.listKey, listKey),
          eq(listSavedViews.isDefault, true),
        ),
      );
  }

  async insert(
    tx: Tx,
    values: { orgId: string; userId: string; listKey: string; name: string; config: unknown; shared: boolean; isDefault: boolean },
  ): Promise<string> {
    const [row] = await tx.insert(listSavedViews).values(values).returning({ id: listSavedViews.id });
    return row.id;
  }

  async update(
    tx: Tx,
    id: string,
    values: Partial<{ name: string; config: unknown; shared: boolean; isDefault: boolean }>,
  ): Promise<void> {
    await tx
      .update(listSavedViews)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(listSavedViews.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(listSavedViews).where(eq(listSavedViews.id, id));
  }

  /** One export, report run or subscription delivery (AC-LF7). Append only. */
  async logRun(values: {
    orgId: string;
    userId: string | null;
    kind: 'export' | 'report' | 'subscription';
    subject: string;
    filters: unknown;
    rowCount: number;
  }): Promise<void> {
    await this.db.insert(reportRuns).values(values);
  }
}
