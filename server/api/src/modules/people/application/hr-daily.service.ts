import { Injectable, Logger } from '@nestjs/common';

import { kigaliToday, monthOf } from '../domain/hr-calendar';
import { EmployeesRepository } from '../infrastructure/employees.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { PeopleDirectoryRepository } from '../infrastructure/people-directory.repository';
import { LeaveService } from './leave.service';
import { PayRunsService } from './pay-runs.service';
import { PeopleFileService } from './people-file.service';
import { RotationService } from './rotation.service';

/**
 * The HR module's daily job (ADR-058): contract statuses on Kigali dates
 * (AC-P4), then leave types and accruals for every business with staff
 * (AC-L1, AC-L2), then document expiry reminders (058-people-file AC-PF5), then
 * 28 days of rotation shifts ahead for every running assignment (058-time
 * AC-TM3), then the month's draft pay run for every business whose automatic
 * draft day it is (058-payroll AC-PY14).
 *
 * Everything it writes is idempotent: a status move is guarded on the status
 * it moves from, and an accrual is unique per period. So a rerun the same day
 * writes nothing, and the first run after downtime catches up every day and
 * month it missed. A reminder is marked once, in the transaction that writes
 * its outbox row, so it is raised once whatever the job does.
 */
@Injectable()
export class HrDailyService {
  private readonly logger = new Logger(HrDailyService.name);

  constructor(
    private readonly employees: EmployeesRepository,
    private readonly leaveRows: LeaveRepository,
    private readonly directory: PeopleDirectoryRepository,
    private readonly leave: LeaveService,
    private readonly peopleFile: PeopleFileService,
    private readonly rotations: RotationService,
    private readonly records: PayRecordsRepository,
    private readonly payRuns: PayRunsService,
  ) {}

  async run(
    now: Date = new Date(),
  ): Promise<{ ended: number; started: number; accrued: number; skippedOrgs: number; reminded: number; generated: number; drafted: number }> {
    const today = kigaliToday(now);
    const { ended, started } = await this.employees.moveContractStatuses(today);
    let accrued = 0;
    let skippedOrgs = 0;
    for (const orgId of await this.leaveRows.orgsWithStaff()) {
      let types;
      try {
        types = await this.leave.ensureTypes(orgId);
      } catch (error) {
        // No defaults row in force: nothing can accrue for anyone, and the leave
        // routes say so in words. One business must not stop the others.
        skippedOrgs += 1;
        this.logger.warn(`HR daily: leave types for org ${orgId} not created: ${(error as Error).message}`);
        continue;
      }
      for (const employee of await this.directory.accruingPeople(orgId, today)) {
        accrued += await this.leave.catchUpAccruals(employee, types);
      }
    }
    let reminded = 0;
    try {
      reminded = await this.peopleFile.raiseDueReminders(today);
    } catch (error) {
      // A reminder that did not go out today is still due tomorrow: its mark is unset.
      this.logger.warn(`HR daily: document reminders not raised: ${(error as Error).message}`);
    }
    let generated = 0;
    try {
      generated = await this.rotations.generateAll(today);
    } catch (error) {
      // The horizon is still 28 days tomorrow: whatever was missed is written then.
      this.logger.warn(`HR daily: rotation shifts not generated: ${(error as Error).message}`);
    }
    const drafted = await this.draftPayRuns(today);
    return { ended, started, accrued, skippedOrgs, reminded, generated, drafted };
  }

  /**
   * The draft of the month `today` falls in, for each business whose draft day
   * it is and whose month has no run (AC-PY14). A month that already has one,
   * drafted by hand or confirmed, is left alone, so a rerun drafts nothing. The
   * day is only on the 1st to the 28th, so no month skips it.
   */
  private async draftPayRuns(today: string): Promise<number> {
    const period = monthOf(today);
    let drafted = 0;
    for (const orgId of await this.records.autoDraftOrgs(Number(today.slice(8, 10)), period)) {
      try {
        await this.payRuns.createDraft(orgId, null, period);
        drafted += 1;
      } catch (error) {
        // A draft drawn by hand a moment ago, or a rule the run needs and lacks:
        // the business drafts it from the screen, which says why in words.
        this.logger.warn(`HR daily: no draft pay run for org ${orgId} (${period}): ${(error as Error).message}`);
      }
    }
    return drafted;
  }
}
