import { Inject, Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  clearUsagePeople,
  closeStaleApproval,
  deleteExpiredConversations,
  deleteOrphanProposals,
  expireStaleProposals,
  type RetentionQuery,
  staleApprovals,
  type StaleApprovalOutcome,
  type StaleApprovalRow,
} from './retention-queries';

/**
 * Runs the retention sweep's SQL (ADR-061 D-d). The SQL lives in
 * `retention-queries.ts` so the slice H oracle runs the same text against a
 * real Postgres; this file only executes it, through the Drizzle handle every
 * repository uses. The pool itself is not exported by `DatabaseModule`, on
 * purpose, and injecting it here is what stopped the API from booting.
 */
@Injectable()
export class RetentionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async run(query: RetentionQuery): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> {
    const result = await this.db.execute(toSql(query));
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount };
  }

  async expireStaleProposals(now: Date): Promise<number> {
    return (await this.run(expireStaleProposals(now))).rowCount ?? 0;
  }

  async staleApprovals(now: Date): Promise<StaleApprovalRow[]> {
    return (await this.run(staleApprovals(now))).rows as unknown as StaleApprovalRow[];
  }

  /** True when this call closed it; false when something else already had. */
  async closeStaleApproval(id: string, outcome: StaleApprovalOutcome): Promise<boolean> {
    return (await this.run(closeStaleApproval({ id, ...outcome }))).rows.length > 0;
  }

  async deleteExpiredConversations(now: Date): Promise<{ conversations: number; proposals: number }> {
    const [row] = (await this.run(deleteExpiredConversations(now))).rows;
    return { conversations: Number(row?.conversations ?? 0), proposals: Number(row?.proposals ?? 0) };
  }

  async deleteOrphanProposals(now: Date): Promise<number> {
    return (await this.run(deleteOrphanProposals(now))).rowCount ?? 0;
  }

  async clearUsagePeople(now: Date): Promise<number> {
    return (await this.run(clearUsagePeople(now))).rowCount ?? 0;
  }
}

/**
 * `$1`-style text and its values, as Drizzle SQL: every value stays a bound
 * parameter, never spliced into the text.
 */
export function toSql(query: RetentionQuery): SQL {
  const parts = query.text.split(/\$(\d+)/);
  const chunks: SQL[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) chunks.push(sql.raw(parts[i]));
    } else {
      chunks.push(sql`${query.values[Number(parts[i]) - 1]}`);
    }
  }
  return sql.join(chunks);
}
