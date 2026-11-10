import { HR_PERMISSIONS, type HrFeaturesOff } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { HrFeaturesService } from '../../../modules/hr/application/hr-features.service';
import { orgOf } from '../../../modules/hr/application/hr-access';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequireAnyPermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';

/** The HR features switched off for this business, so HR's screens hide them (Injishi staff switch them). */
@Controller({ path: 'ops/hr/features', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHrFeaturesController {
  constructor(private readonly features: HrFeaturesService) {}

  @Get()
  @RequireAnyPermission(...HR_PERMISSIONS)
  async off(@CurrentWorkspace() ws: ScopedWorkspace): Promise<HrFeaturesOff> {
    return { off: [...(await this.features.offFor(orgOf(ws)))] };
  }
}
