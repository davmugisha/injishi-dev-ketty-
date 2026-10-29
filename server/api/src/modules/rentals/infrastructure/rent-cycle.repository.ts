import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';

import { leases } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** A live lease as the rent cycle walks it. */
export interface CycleLease {
  id: string;
  workspaceId: string;
  reference: string;
  status: 'active' | 'ending';
  startDate: string;
  endDate: string;
  billingStartsOn: string;
  monthlyRentRwf: number;
  rentDueDay: number;
}

/** The RentCycle job's lists (blueprint 2.6; WP 1.6a): what to raise, what to move, what to flag. */
@Injectable()
export class RentCycleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Active and ending leases, oldest start first: every one may have rent to raise. */
  async live(db: DbOrTx = this.db): Promise<CycleLease[]> {
    const rows = await db
      .select({
        id: leases.id,
        workspaceId: leases.workspaceId,
        reference: leases.reference,
        status: leases.status,
        startDate: leases.startDate,
        endDate: leases.endDate,
        billingStartsOn: leases.billingStartsOn,
        monthlyRentRwf: leases.monthlyRentRwf,
        rentDueDay: leases.rentDueDay,
      })
      .from(leases)
      .where(inArray(leases.status, ['active', 'ending']))
      .orderBy(asc(leases.startDate), asc(leases.id));
    return rows as CycleLease[];
  }

  /** Active leases whose end date is on or before `by`: the ones to move to ending. */
  async activeEndingBy(by: string, db: DbOrTx = this.db): Promise<{ id: string; workspaceId: string; reference: string; endDate: string }[]> {
    return db
      .select({ id: leases.id, workspaceId: leases.workspaceId, reference: leases.reference, endDate: leases.endDate })
      .from(leases)
      .where(and(eq(leases.status, 'active'), lte(leases.endDate, by)))
      .orderBy(asc(leases.endDate), asc(leases.id));
  }

  /** Active or ending leases already past their end date: flagged, never ended by the job. */
  async pastEnd(today: string, db: DbOrTx = this.db): Promise<{ id: string; workspaceId: string; reference: string; endDate: string; status: string }[]> {
    return db
      .select({ id: leases.id, workspaceId: leases.workspaceId, reference: leases.reference, endDate: leases.endDate, status: sql<string>`${leases.status}::text` })
      .from(leases)
      .where(and(inArray(leases.status, ['active', 'ending']), lt(leases.endDate, today)))
      .orderBy(asc(leases.endDate), asc(leases.id));
  }
}
