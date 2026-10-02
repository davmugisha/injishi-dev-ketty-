import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { EmployeesService } from './application/employees.service';
import { HrDailyService } from './application/hr-daily.service';
import { LeaveService } from './application/leave.service';
import { PayRunsService } from './application/pay-runs.service';
import { TimeService } from './application/time.service';
import { EmployeesRepository } from './infrastructure/employees.repository';
import { HrDailyProcessor } from './infrastructure/hr-daily.processor';
import { HrRulesRepository } from './infrastructure/hr-rules.repository';
import { LeaveRepository } from './infrastructure/leave.repository';
import { PayrollRepository } from './infrastructure/payroll.repository';
import { PeopleDirectoryRepository } from './infrastructure/people-directory.repository';
import { TimeRepository } from './infrastructure/time.repository';

/**
 * The HR module (ADR-058, first thread), behind `/api/v1/ops/employees`,
 * `shift-templates`, `roster`, `attendance`, `leave` and `pay-runs`.
 *
 * Its own module rather than a corner of `operations`: HR is the largest body
 * of rules in the API and its data is the most sensitive after identity
 * documents. It crosses into `organization` (memberships) only through the
 * tables the offboarding transaction must move together, never through that
 * module's repositories.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named. The
 * daily processor runs ONLY in the worker process.
 */
@Module({
  providers: [
    EmployeesRepository,
    TimeRepository,
    LeaveRepository,
    PayrollRepository,
    HrRulesRepository,
    PeopleDirectoryRepository,
    EmployeesService,
    TimeService,
    LeaveService,
    PayRunsService,
    HrDailyService,
    ...(isWorkerProcess() ? [HrDailyProcessor] : []),
  ],
  exports: [EmployeesService, TimeService, LeaveService, PayRunsService, HrDailyService],
})
export class PeopleModule {}
