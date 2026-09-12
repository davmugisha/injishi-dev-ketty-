import { Inject, Injectable } from '@nestjs/common';
import type { AdminRecordDataClass } from '@injishi/contracts';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { recordAccessLogs } from '../../../database/drizzle/schema';

/**
 * The PII trail: a staff member read somebody else's record, and here is the
 * row that says so.
 *
 * WHY THIS IS ITS OWN OBJECT rather than three lines inside the users service.
 * The log has to be written by something that cannot also decide not to write
 * it. Folding the insert into the reader puts the trail one early `return`
 * away from being skipped on the branch that matters — the empty search, the
 * cached page, the "we already have this" shortcut somebody adds next year.
 * A separate collaborator with a single method makes an unlogged read a
 * deliberate act rather than an oversight.
 *
 * WHY IT IS WRITTEN BEFORE THE ANSWER, NOT AFTER. `AdminAccessLogRow` records
 * that a read HAPPENED. If the log were written after the response, a request
 * that died between the query and the write would have disclosed the data and
 * left no trace, which is exactly the case the table exists for.
 *
 * `reason` is NOT NULL on the table and is not defaulted here. A read of
 * another person's data without a stated reason is the thing this table exists
 * to make impossible, so the caller has to have one before it gets this far.
 */
@Injectable()
export class RecordAccessService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Record one staff read of one or more subjects.
   *
   * ONE ROW PER SUBJECT, not one per request. The question this table is asked
   * during a data subject request is "who read MY record", and that question
   * cannot be answered from a single row that says "someone listed 25 people".
   * A page view therefore costs 25 rows; the table is append-only and that is
   * what it is for.
   *
   * A search that MATCHED NOBODY still writes one row, with a null subject.
   * Staff searching a national ID and finding nothing has still learned
   * something about that number, and a trail that only records successful
   * lookups makes the probe the way to read without being logged.
   */
  async recordRead(input: {
    actorUserId: string;
    subjectUserIds: string[];
    dataClass: AdminRecordDataClass;
    reason: string;
  }): Promise<void> {
    const base = {
      actorUserId: input.actorUserId,
      dataClass: input.dataClass,
      reason: input.reason,
    };

    const rows =
      input.subjectUserIds.length === 0
        ? [{ ...base, subjectUserId: null }]
        : input.subjectUserIds.map((subjectUserId) => ({
            ...base,
            subjectUserId,
          }));

    // One statement rather than a loop of inserts: a partially written trail
    // for a single read is worse than either outcome, because it reads as a
    // narrower disclosure than the one that happened.
    await this.db.insert(recordAccessLogs).values(rows);
  }
}
