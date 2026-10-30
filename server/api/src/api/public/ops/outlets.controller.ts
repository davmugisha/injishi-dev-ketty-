import {
  CreateOutletRequest,
  type OperatorOutlet,
  type OperatorOutletList,
  UpdateOutletRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Outlets -> /api/v1/ops/outlets (ADR-050 slice 4, task 21).
 *
 * The read is open beyond `outlet.manage`, for the reason the department list
 * is: a menu or an order screen names an outlet before anybody manages one, and
 * the Outlets lens sits under Services, which a receptionist opens
 * (`order.advance`). Every write carries `outlet.manage`, owner and manager
 * only (AC-31).
 */
@Controller({ path: 'ops/outlets', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsOutletsController {
  constructor(private readonly outlets: OutletsService) {}

  @Get()
  @RequireAnyPermission('outlet.manage', 'order.advance', 'menu.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OperatorOutletList> {
    return this.outlets.list(workspace);
  }

  @Post()
  @RequirePermission('outlet.manage')
  create(
    @Body(new ZodValidationPipe(CreateOutletRequest)) body: CreateOutletRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorOutlet> {
    return this.outlets.create(workspace, body);
  }

  @Patch(':id')
  @RequirePermission('outlet.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOutletRequest)) body: UpdateOutletRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorOutlet> {
    return this.outlets.update(workspace, id, body);
  }

  /** A state change, not an edit: an outlet is never deleted, because its sales name it. */
  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermission('outlet.manage')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorOutlet> {
    return this.outlets.archive(workspace, id);
  }
}
