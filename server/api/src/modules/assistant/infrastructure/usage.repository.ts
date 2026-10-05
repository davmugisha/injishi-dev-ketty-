import { Inject, Injectable } from '@nestjs/common';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { toSql } from './retention.repository';
import {
  aiTurnsSince,
  insertTurn,
  insertUsage,
  monthCost,
  monthTools,
  type MonthToolRow,
  monthTurns,
  type MonthTurnRow,
  monthUsage,
  type MonthUsageRow,
  popularRoutes,
  type TurnRow,
  type UsageQuery,
  type UsageRow,
} from './usage-queries';

/**
 * Runs the usage ledger's SQL (ADR-061 D-s). The SQL lives in
 * `usage-queries.ts`, where the report script and the slice I oracle read the
 * same text; this file only executes it, through the Drizzle handle.
 */
@Injectable()
export class UsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async rows(query: UsageQuery): Promise<Record<string, unknown>[]> {
    return (await this.db.execute(toSql(query))).rows as Record<string, unknown>[];
  }

  async insert(rows: UsageRow[]): Promise<void> {
    if (rows.length > 0) await this.rows(insertUsage(rows));
  }

  async insertTurn(row: TurnRow): Promise<void> {
    await this.rows(insertTurn(row));
  }

  /** The month to date's estimated cost in micro dollars. */
  async monthCostMicroUsd(now: Date): Promise<number> {
    const [row] = await this.rows(monthCost(now));
    return Number(row?.cost_micro_usd ?? 0);
  }

  async aiTurnsSince(input: { userId: string | null; conversationId: string | null; since: Date }): Promise<number> {
    const query = aiTurnsSince(input);
    if (!query) return 0;
    const [row] = await this.rows(query);
    return Number(row?.n ?? 0);
  }

  async popularRoutes(surface: string, since: Date): Promise<Map<string, number>> {
    return new Map((await this.rows(popularRoutes(surface, since))).map((r) => [String(r.route), Number(r.n)]));
  }

  async month(month: string): Promise<{ usage: MonthUsageRow[]; turns: MonthTurnRow[]; tools: MonthToolRow[] }> {
    const [usage, turns, tools] = await Promise.all([this.rows(monthUsage(month)), this.rows(monthTurns(month)), this.rows(monthTools(month))]);
    return {
      usage: usage as unknown as MonthUsageRow[],
      turns: turns as unknown as MonthTurnRow[],
      tools: tools as unknown as MonthToolRow[],
    };
  }
}
