import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolvePinPepper } from '../../shared/config/security.config';
import { PLATFORM, type Platform } from '../../shared/config/platform';
import { isWorkerProcess } from '../../shared/process/process-role';
import { ListsModule } from '../lists/lists.module';
import { StorageModule } from '../storage/storage.module';
import { AttendanceCloser } from './application/attendance-closer';
import { AttendanceInsightsService } from './application/attendance-insights.service';
import { AttendanceSweepService } from './application/attendance-sweep.service';
import { EmployeesService } from './application/employees.service';
import { HrContentService } from './application/hr-content.service';
import { HrDailyService } from './application/hr-daily.service';
import { HrFilesService } from './application/hr-files.service';
import { HrWorkforceService } from './application/hr-workforce.service';
import { KioskService } from './application/kiosk.service';
import { LeaveAllocationsService } from './application/leave-allocations.service';
import { LeaveTypesService } from './application/leave-types.service';
import { LeaveService } from './application/leave.service';
import { LoansService } from './application/loans.service';
import { MyLeaveService } from './application/my-leave.service';
import { MyPayService } from './application/my-pay.service';
import { MyStaffService } from './application/my-staff.service';
import { RestrictedPeriodsService } from './application/restricted-periods.service';
import { MyWorkService } from './application/my-work.service';
import { PayAdjustmentsService } from './application/pay-adjustments.service';
import { PayClaimsService } from './application/pay-claims.service';
import { PayComponentsService } from './application/pay-components.service';
import { PayFilesService } from './application/pay-files.service';
import { PayRunsService } from './application/pay-runs.service';
import { PayrollViewsService } from './application/payroll-views.service';
import { PayslipsService } from './application/payslips.service';
import { PeopleFileService } from './application/people-file.service';
import { RotationService } from './application/rotation.service';
import { TimeRequestsService } from './application/time-requests.service';
import { TimeSettingsService } from './application/time-settings.service';
import { TimeService } from './application/time.service';
import { EmployeesRepository } from './infrastructure/employees.repository';
import { HrContentRepository } from './infrastructure/hr-content.repository';
import { HrDailyProcessor } from './infrastructure/hr-daily.processor';
import { HrRulesRepository } from './infrastructure/hr-rules.repository';
import { HrWorkforceRepository } from './infrastructure/hr-workforce.repository';
import { KioskRepository } from './infrastructure/kiosk.repository';
import { LeaveExtraRepository } from './infrastructure/leave-extra.repository';
import { LeaveRepository } from './infrastructure/leave.repository';
import { MyStaffRepository } from './infrastructure/my-staff.repository';
import { MyWorkRepository } from './infrastructure/my-work.repository';
import { PayItemsRepository } from './infrastructure/pay-items.repository';
import { PayRecordsRepository } from './infrastructure/pay-records.repository';
import { PayrollRepository } from './infrastructure/payroll.repository';
import { PayslipPdfRenderer } from './infrastructure/payslip-pdf.renderer';
import { PeopleDirectoryRepository } from './infrastructure/people-directory.repository';
import { PeopleFileRepository } from './infrastructure/people-file.repository';
import { HR_PIN_PEPPER } from './infrastructure/pin-hash';
import { RotationRepository } from './infrastructure/rotation.repository';
import { TimeRequestsRepository } from './infrastructure/time-requests.repository';
import { TimeRepository } from './infrastructure/time.repository';
import { TimeSettingsRepository } from './infrastructure/time-settings.repository';

/**
 * The HR module (ADR-058), behind `/api/v1/ops/employees`, `shift-templates`,
 * `roster`, `attendance`, `leave`, `pay-runs`, payroll's own routes (058-payroll:
 * payslips, loans, claims, adjustments, components, structures and contracts)
 * and the people file's routes
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
 * daily processor, and the attendance sweep it schedules, run ONLY in the
 * worker process.
 *
 * `HR_PIN_PEPPER` is resolved once, here, at boot: a production platform
 * without a strong one refuses to start (058-time AC-TM11).
 */
@Module({
  // The list framework: export rules and the export log (058-list-framework).
  // Storage: photos, documents and attachments, private, behind short links.
  imports: [ListsModule, StorageModule],
  providers: [
    EmployeesRepository,
    TimeRepository,
    LeaveRepository,
    LeaveExtraRepository,
    PayrollRepository,
    PayItemsRepository,
    PayRecordsRepository,
    PayslipPdfRenderer,
    HrRulesRepository,
    PeopleDirectoryRepository,
    PeopleFileRepository,
    HrContentRepository,
    TimeSettingsRepository,
    RotationRepository,
    TimeRequestsRepository,
    KioskRepository,
    MyWorkRepository,
    MyStaffRepository,
    HrWorkforceRepository,
    {
      provide: HR_PIN_PEPPER,
      inject: [ConfigService, PLATFORM],
      useFactory: (config: ConfigService, platform: Platform): string =>
        resolvePinPepper({
          nodeEnv: config.get<string>('NODE_ENV'),
          environment: platform.environment,
          pinPepper: config.get<string>('HR_PIN_PEPPER'),
        }),
    },
    AttendanceCloser,
    EmployeesService,
    HrFilesService,
    PeopleFileService,
    HrContentService,
    HrWorkforceService,
    TimeService,
    RotationService,
    TimeRequestsService,
    TimeSettingsService,
    KioskService,
    AttendanceInsightsService,
    MyWorkService,
    AttendanceSweepService,
    LeaveService,
    LeaveTypesService,
    LeaveAllocationsService,
    RestrictedPeriodsService,
    MyLeaveService,
    PayAdjustmentsService,
    PayRunsService,
    PayslipsService,
    PayFilesService,
    LoansService,
    PayClaimsService,
    PayComponentsService,
    PayrollViewsService,
    MyPayService,
    MyStaffService,
    HrDailyService,
    ...(isWorkerProcess() ? [HrDailyProcessor] : []),
  ],
  exports: [
    EmployeesService,
    TimeService,
    RotationService,
    TimeRequestsService,
    TimeSettingsService,
    KioskService,
    AttendanceInsightsService,
    MyWorkService,
    LeaveService,
    LeaveTypesService,
    LeaveAllocationsService,
    RestrictedPeriodsService,
    MyLeaveService,
    MyStaffService,
    PayRunsService,
    PayslipsService,
    PayFilesService,
    LoansService,
    PayClaimsService,
    PayAdjustmentsService,
    PayComponentsService,
    PayrollViewsService,
    MyPayService,
    HrDailyService,
    HrFilesService,
    PeopleFileService,
    HrContentService,
    HrWorkforceService,
  ],
})
export class PeopleModule {}
