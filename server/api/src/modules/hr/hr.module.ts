import { Module } from '@nestjs/common';

import { EmployeeService } from './application/employee.service';
import { EmployeeRepository } from './infrastructure/employee.repository';
import { ChecklistService } from './application/checklist.service';
import { ChecklistRepository } from './infrastructure/checklist.repository';
import { LeaveService } from './application/leave.service';
import { LeaveRepository } from './infrastructure/leave.repository';

/**
 * HR (Phase 1: employees, Phase 3: onboarding/offboarding checklists,
 * Phase 4: leave. First pass — no ADR yet).
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
  ],
  exports: [EmployeeService, ChecklistService, LeaveService],
})
export class HrModule {}