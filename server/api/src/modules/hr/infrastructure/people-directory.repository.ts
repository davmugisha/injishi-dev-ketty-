import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, or } from 'drizzle-orm';

import { employees } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { addDays } from '../domain/hr-calendar';

/**
 * The daily job's view of who is on file (ADR-058): everyone still working, and
 * anyone who left recently enough that their last month may still be owed an
 * accrual. Reads the four columns accrual needs and nothing else.
 */
@Injectable()
export class PeopleDirectoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async accruingPeople(
    orgId: string,
    today: string,
  ): Promise<{ id: string; orgId: string; hiredOn: string; status: 'active' | 'offboarded'; offboardedOn: string | null }[]> {
    return this.db
      .select({
        id: employees.id,
        orgId: employees.orgId,
        hiredOn: employees.hiredOn,
        status: employees.status,
        offboardedOn: employees.offboardedOn,
      })
      .from(employees)
      .where(
        and(
          eq(employees.orgId, orgId),
          or(eq(employees.status, 'active'), gte(employees.offboardedOn, addDays(today, -40))),
        ),
      );
  }
}
