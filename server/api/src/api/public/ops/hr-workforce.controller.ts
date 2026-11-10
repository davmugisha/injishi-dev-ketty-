import {
  CoverQuery,
  ExpiringDocumentQuery,
  HR_PERMISSIONS,
  HrReportQuery,
  SaveCoverRequest,
  type HrReport,
  type CoverRequirementList,
  type EmployeeDependantList,
  type ExpiringDocumentList,
  type HrCompensation,
  type HrTeamList,
} from '@injishi/contracts';
import { Body, Controller, Get, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';

import { HrReportService } from '../../../modules/hr/application/hr-report.service';
import { HrWorkforceService } from '../../../modules/hr/application/hr-workforce.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The workforce reads of the new interface's HR screens -> /api/v1/ops/hr
 * (real-data, people), beside `OpsHrController` on the same path.
 *
 * Who may read what follows the HR file (058-people-file AC-PF2):
 *
 * - teams and placements (a team, whether a kiosk PIN is set) are read under
 *   any HR permission, as a leave type's name is; a grade and a probation
 *   end come from the file, so the service sends them to a file reader only;
 * - compensation (what each contract pays, why, and where pay goes) is
 *   `people.manage` or `payroll.run`, as the contracts list and pay accounts;
 * - expiring documents, checklists and dependants are `people.manage` alone,
 *   as documents and notes are: they say things about a person's family, their
 *   departure and their papers.
 *
 * Ticking a checklist step is `people.manage`; a step marked owner only also
 * needs `team.manage`, checked in the service.
 */
@Controller({ path: 'ops/hr', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsHrWorkforceController {
  constructor(
    private readonly workforce: HrWorkforceService,
    private readonly reports: HrReportService,
  ) {}

  /** Everything that took place over a period: staff, attendance, leave, pay and requests. */
  @Get('report')
  @RequirePermission('people.manage')
  report(
    @Query(new ZodValidationPipe(HrReportQuery)) query: HrReportQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<HrReport> {
    return this.reports.report(workspace, query);
  }

  @Get('teams')
  @RequireAnyPermission(...HR_PERMISSIONS)
  teams(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<HrTeamList> {
    return this.workforce.teams(workspace);
  }

  @Get('compensation')
  @RequireAnyPermission('people.manage', 'payroll.run')
  compensation(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<HrCompensation> {
    return this.workforce.compensation(workspace);
  }

  @Get('expiring-documents')
  @RequirePermission('people.manage')
  expiringDocuments(
    @Query(new ZodValidationPipe(ExpiringDocumentQuery)) query: ExpiringDocumentQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ExpiringDocumentList> {
    return this.workforce.expiringDocuments(workspace, query.withinDays);
  }

  @Get('dependants')
  @RequirePermission('people.manage')
  dependants(
    @Query('employeeId', new ParseUUIDPipe({ optional: true })) employeeId: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeeDependantList> {
    return this.workforce.dependants(workspace, employeeId);
  }
}

/**
 * Minimum cover -> /api/v1/ops/roster/cover (real-data, people): read like the
 * roster it is counted against, so whoever builds it, the desk that clocks
 * people onto it, and a file reader.
 */
@Controller({ path: 'ops/roster/cover', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsRosterCoverController {
  constructor(private readonly workforce: HrWorkforceService) {}

  @Get()
  @RequireAnyPermission('roster.manage', 'attendance.record', 'people.view')
  cover(
    @Query(new ZodValidationPipe(CoverQuery)) query: CoverQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<CoverRequirementList> {
    return this.workforce.cover(workspace, query.propertyId);
  }

  @Put()
  @RequirePermission('roster.manage')
  save(
    @Body(new ZodValidationPipe(SaveCoverRequest)) body: SaveCoverRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CoverRequirementList> {
    return this.workforce.saveCover(workspace, user.id, body);
  }
}
