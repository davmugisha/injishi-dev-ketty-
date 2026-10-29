import {
  BulkUnitsRequest,
  CreateBlockRequest,
  CreateUnitRequest,
  UnitListQuery,
  UpdateBlockRequest,
  UpdateUnitRequest,
  type BlockList,
  type BlockView,
  type BulkUnitsResult,
  type RentalUnitList,
  type RentalUnitView,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { UnitsService } from '../../../../modules/rentals/application/units.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * Units → /api/v1/ops/units (blueprint 2.3, WP 1.5a). A unit is a
 * `rental_units` row; adding one makes no hotel room. Reads admit whoever
 * works units, leases or the money; every write is `unit.manage`.
 */
@Controller({ path: 'ops/units', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsUnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequireAnyPermission('unit.manage', 'lease.manage', 'money.view')
  list(
    @Query(new ZodValidationPipe(UnitListQuery)) query: UnitListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<RentalUnitList> {
    return this.units.list(workspace, query);
  }

  @Post()
  @RequirePermission('unit.manage')
  create(
    @Body(new ZodValidationPipe(CreateUnitRequest)) body: CreateUnitRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RentalUnitView> {
    return this.units.create(workspace, user.id, body);
  }

  @Post('bulk')
  @RequirePermission('unit.manage')
  bulk(
    @Body(new ZodValidationPipe(BulkUnitsRequest)) body: BulkUnitsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkUnitsResult> {
    return this.units.bulk(workspace, user.id, body);
  }

  @Get(':id')
  @RequireAnyPermission('unit.manage', 'lease.manage', 'money.view')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentalUnitView> {
    return this.units.get(workspace, id);
  }

  @Patch(':id')
  @RequirePermission('unit.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUnitRequest)) body: UpdateUnitRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RentalUnitView> {
    return this.units.update(workspace, user.id, id, body);
  }

  @Post(':id/retire')
  @HttpCode(200)
  @RequirePermission('unit.manage')
  retire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RentalUnitView> {
    return this.units.retire(workspace, user.id, id);
  }
}

/** Blocks → /api/v1/ops/blocks: the buildings, wings or blocks units stand in. */
@Controller({ path: 'ops/blocks', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsBlocksController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequireAnyPermission('unit.manage', 'lease.manage', 'money.view')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<BlockList> {
    return this.units.blocks(workspace);
  }

  @Post()
  @RequirePermission('unit.manage')
  create(
    @Body(new ZodValidationPipe(CreateBlockRequest)) body: CreateBlockRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<BlockView> {
    return this.units.createBlock(workspace, body);
  }

  @Patch(':id')
  @RequirePermission('unit.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateBlockRequest)) body: UpdateBlockRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BlockView> {
    return this.units.updateBlock(workspace, user.id, id, body);
  }
}
