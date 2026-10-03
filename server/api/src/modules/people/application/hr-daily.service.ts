import { Injectable, Logger } from '@nestjs/common';

import { kigaliToday } from '../domain/hr-calendar';
import { EmployeesRepository } from '../infrastructure/employees.repository';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { PeopleDirectoryRepository } from '../infrastructure/people-directory.repository';
import { LeaveService } from './leave.service';

/**
 * The HR module's daily job (ADR-058): contract statuses on Kigali dates
 * (AC-P4), then leave types and accruals for every business with staff
 * (AC-L1, AC-L2).
 *
 * Everything it writes is idempotent: a status move is guarded on the status
 * it moves from, and an accrual is unique per period. So a rerun the same day
 * writes nothing, and the first run after downtime catches up every day and
 * month it missed.
 */
@Injectable()
export class HrDailyService {
  private readonly logger = new Logger(HrDailyService.name);

  constructor(
    private readonly employees: EmployeesRepository,
    private readonly leaveRows: LeaveRepository,
    private readonly directory: PeopleDirectoryRepository,
    private readonly leave: LeaveService,
  ) {}

  async run(now: Date = new Date()): Promise<{ ended: number; started: number; accrued: number; skippedOrgs: number }> {
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
    return { ended, started, accrued, skippedOrgs };
  }
}
