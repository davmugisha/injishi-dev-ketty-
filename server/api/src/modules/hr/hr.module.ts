import { Module } from '@nestjs/common';

import { EmployeeService } from './application/employee.service';
import { EmployeeRepository } from './infrastructure/employee.repository';
import { ChecklistService } from './application/checklist.service';
import { ChecklistRepository } from './infrastructure/checklist.repository';
import { LeaveService } from './application/leave.service';
import { LeaveRepository } from './infrastructure/leave.repository';
import { MyHrService } from './application/my-hr.service';
import { MyHrRepository } from './infrastructure/my-hr.repository';
import { AttendanceService } from './application/attendance.service';
import { RosterService } from './application/roster.service';
import { AttendanceRepository } from './infrastructure/attendance.repository';
// The class, not `PayrollModule`: that module imports this one for attendance,
// and the renderer holds no state and injects nothing, so each may have its own.
import { PayslipPdfRenderer } from '../payroll/infrastructure/payslip-pdf.renderer';

/**
 * HR (Phase 1: employees, Phase 3: onboarding/offboarding checklists,
 * Phase 4: leave, Phase 5: the shift roster and attendance. First pass — no
 * ADR yet).
 *
 * Layering matches every other module: application/ (the use case),
 * infrastructure/ (Drizzle). Only the services are exported, mirroring
 * `OrganizationModule`, so nothing outside this module can reach a
 * repository directly.
 */
@Module({
  providers: [
    EmployeeRepository,
    EmployeeService,
    ChecklistRepository,
    ChecklistService,
    LeaveRepository,
    LeaveService,
    MyHrRepository,
    MyHrService,
    AttendanceRepository,
    RosterService,
    AttendanceService,
    PayslipPdfRenderer,
  ],
  exports: [EmployeeService, ChecklistService, LeaveService, MyHrService, RosterService, AttendanceService],
})
export class HrModule {}