import { Inject, Injectable, Logger } from '@nestjs/common';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { TimeRepository, type SweepCandidate } from '../infrastructure/time.repository';
import { AttendanceCloser } from './attendance-closer';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * When the sweep closes a record, and why (058-time AC-TM4). A linked record
 * whose template closes it automatically is closed at its shift's end plus
 * that time; any record open past the branch's stale limit is closed at its
 * clock in plus the policy's default shift length. Null: leave it open.
 */
export function sweepClose(
  candidate: Pick<SweepCandidate, 'clockInAt' | 'entryEndsAt' | 'autoClockOutMinutes'>,
  rules: { staleOpenHours: number; defaultShiftMinutes: number },
  now: Date,
): { at: Date; reason: string } | null {
  const floor = candidate.clockInAt.getTime() + MINUTE;
  if (candidate.autoClockOutMinutes !== null && candidate.entryEndsAt) {
    const due = candidate.entryEndsAt.getTime() + candidate.autoClockOutMinutes * MINUTE;
    if (due <= now.getTime()) {
      return {
        at: new Date(Math.max(due, floor)),
        reason: 'Closed by the sweep at the shift\'s automatic clock out. The times are a guess until someone corrects them.',
      };
    }
  }
  if (candidate.clockInAt.getTime() + rules.staleOpenHours * HOUR <= now.getTime()) {
    return {
      at: new Date(Math.max(candidate.clockInAt.getTime() + rules.defaultShiftMinutes * MINUTE, floor)),
      reason: `Closed by the sweep: open longer than ${rules.staleOpenHours} hours. The clock out is a guess until someone corrects it.`,
    };
  }
  return null;
}

/**
 * The 15 minute sweep (ADR-058, 058-time AC-TM4). A record it closes is
 * `auto_closed`, unvalidated and noted, earns no overtime, and waits in the
 * validation queue for somebody to correct it with the real times, so it also
 * blocks the month's pay run until then (AC-TM16). Worker only.
 *
 * Each record closes in its own transaction, guarded on still being open, so a
 * person who clocks out while the sweep runs keeps their own clock out.
 */
@Injectable()
export class AttendanceSweepService {
  private readonly logger = new Logger(AttendanceSweepService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly time: TimeRepository,
    private readonly closer: AttendanceCloser,
  ) {}

  async run(now: Date = new Date()): Promise<{ closed: number }> {
    let closed = 0;
    for (const candidate of await this.time.sweepCandidates(now)) {
      try {
        if (await this.closeOne(candidate, now)) closed += 1;
      } catch (error) {
        // One bad row must not stop the rest; it is tried again in 15 minutes.
        this.logger.warn(`Attendance sweep: record ${candidate.id} not closed: ${(error as Error).message}`);
      }
    }
    return { closed };
  }

  private async closeOne(candidate: SweepCandidate, now: Date): Promise<boolean> {
    const rules = await this.closer.rulesFor(candidate.orgId, candidate.workPropertyId);
    const close = sweepClose(candidate, rules, now);
    if (!close) return false;
    const record = await this.time.findRecord(candidate.id);
    if (!record || record.status !== 'open') return false;
    const figures = await this.closer.figures({
      orgId: record.orgId,
      propertyId: record.workPropertyId,
      rosterEntryId: record.rosterEntryId,
      workDate: record.workDate,
      clockInAt: record.clockInAt,
      clockOutAt: close.at,
      autoClosed: true,
    });
    return this.db.transaction(async (tx) => {
      const moved = await this.time.closeRecord(tx, record.id, close.at, figures, {
        autoClosed: true,
        validated: false,
        note: close.reason,
      });
      if (!moved) return false;
      await writeHrAudit(tx, {
        actorUserId: null,
        subjectType: 'employee',
        subjectId: record.employeeId,
        eventType: 'hr.attendance_auto_closed',
        orgId: record.orgId,
        diff: { attendanceRecordId: record.id, at: close.at.toISOString(), source: 'sweep' },
      });
      await writeHrEvent(tx, {
        trigger: 'attendance.flagged',
        aggregateType: 'attendance_record',
        aggregateId: record.id,
        change: 'auto_closed',
        workspaceId: null,
        payload: { attendanceRecordId: record.id, employeeId: record.employeeId },
      });
      return true;
    });
  }
}
