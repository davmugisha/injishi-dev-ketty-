import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { ListsModule } from '../lists/lists.module';
import { StorageModule } from '../storage/storage.module';
import { EmployeesService } from './application/employees.service';
import { HrContentService } from './application/hr-content.service';
import { HrDailyService } from './application/hr-daily.service';
import { HrFilesService } from './application/hr-files.service';
import { LeaveService } from './application/leave.service';
import { PayRunsService } from './application/pay-runs.service';
import { PeopleFileService } from './application/people-file.service';
import { TimeService } from './application/time.service';
import { EmployeesRepository } from './infrastructure/employees.repository';
import { HrContentRepository } from './infrastructure/hr-content.repository';
import { HrDailyProcessor } from './infrastructure/hr-daily.processor';
import { HrRulesRepository } from './infrastructure/hr-rules.repository';
import { LeaveRepository } from './infrastructure/leave.repository';
import { PayrollRepository } from './infrastructure/payroll.repository';
import { PeopleDirectoryRepository } from './infrastructure/people-directory.repository';
import { PeopleFileRepository } from './infrastructure/people-file.repository';
import { TimeRepository } from './infrastructure/time.repository';

/**
 * The HR module (ADR-058), behind `/api/v1/ops/employees`, `shift-templates`,
 * `roster`, `attendance`, `leave`, `pay-runs` and the people file's routes
 * (058-people-file: documents, pay accounts, policies, announcements,
 * discipline, the org chart and the HR catalogs and settings).
 *
 * Its own module rather than a corner of `operations`: HR is the largest body
 * of rules in the API and its data is the most sensitive after identity
 * documents. It crosses into `organization` (memberships) only through the
 * tables the offboarding transaction must move together, never through that
 * module's repositories. Files go through the storage module and nowhere else.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named. The
 * daily processor runs ONLY in the worker process.
 */
@Module({
  // The list framework: export rules and the export log (058-list-framework).
  // Storage: photos, documents and attachments, private, behind short links.
  imports: [ListsModule, StorageModule],
  providers: [
    EmployeesRepository,
    TimeRepository,
    LeaveRepository,
    PayrollRepository,
    HrRulesRepository,
    PeopleDirectoryRepository,
    PeopleFileRepository,
    HrContentRepository,
    EmployeesService,
    HrFilesService,
    PeopleFileService,
    HrContentService,
    TimeService,
    LeaveService,
    PayRunsService,
    HrDailyService,
    ...(isWorkerProcess() ? [HrDailyProcessor] : []),
  ],
  exports: [
    EmployeesService,
    TimeService,
    LeaveService,
    PayRunsService,
    HrDailyService,
    HrFilesService,
    PeopleFileService,
    HrContentService,
  ],
})
export class PeopleModule {}
