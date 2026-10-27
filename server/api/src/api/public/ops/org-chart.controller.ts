import type { OrgChart } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { HrContentService } from '../../../modules/hr/application/hr-content.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * Who reports to whom -> /api/v1/ops/org-chart (058-people-file AC-PF10).
 *
 * Roster card fields only, so any file reader may draw it. Everyone active in
 * the caller's branches; a person whose manager is outside them is drawn as a
 * root rather than pointing at somebody the caller cannot read.
 */
@Controller({ path: 'ops/org-chart', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsOrgChartController {
  constructor(private readonly content: HrContentService) {}

  @Get()
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  chart(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OrgChart> {
    return this.content.orgChart(workspace);
  }
}
