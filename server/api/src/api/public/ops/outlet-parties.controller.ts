import {
  CreateOutletPartyRequest,
  type OutletParty,
  type OutletPartyList,
  UpdateOutletPartyRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { OutletsService } from '../../../modules/outlets/application/outlets.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireEveryBranch,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Outlet parties -> /api/v1/ops/outlet-parties (ADR-050 D-h, slice 4).
 *
 * Who runs and who owns an outlet. The whole surface is `outlet.manage`, the
 * list included: a party row carries a TIN and contact details, and only the
 * people who manage outlets have a reason to read them.
 */
@Controller({ path: 'ops/outlet-parties', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsOutletPartiesController {
  constructor(private readonly outlets: OutletsService) {}

  @Get()
  @RequirePermission('outlet.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OutletPartyList> {
    return this.outlets.listParties(workspace);
  }

  @Post()
  @RequirePermission('outlet.manage')
  @RequireEveryBranch()
  create(
    @Body(new ZodValidationPipe(CreateOutletPartyRequest)) body: CreateOutletPartyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OutletParty> {
    return this.outlets.createParty(workspace, body);
  }

  @Patch(':id')
  @RequirePermission('outlet.manage')
  @RequireEveryBranch()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOutletPartyRequest)) body: UpdateOutletPartyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OutletParty> {
    return this.outlets.updateParty(workspace, id, body);
  }
}
