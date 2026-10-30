import {
  AddWorkOrderNoteRequest,
  AssignWorkOrderRequest,
  type ConditionSignal,
  type ConditionSignalList,
  CreateWorkOrderRequest,
  DecideRoomBlockRequest,
  DismissConditionSignalRequest,
  ReleaseRoomRequest,
  type WorkOrder,
  type WorkOrderList,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { WorkOrdersService } from '../../../modules/pms/application/work-orders.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The hotel's work orders -> /api/v1/ops/work-orders (real-data 1.2.3).
 *
 * `ticket.advance` for everything the people doing the work do (it is the permission the Maintenance
 * leaf already sits behind, and a housekeeper who reports a fault holds it). `listing.manage` for the
 * two acts that change what is on sale: approving or declining a block, and releasing the room.
 * Residence tickets stay on `/ops/tickets`; this board lists only orders with no lease.
 */
@Controller({ path: 'ops/work-orders', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsWorkOrdersController {
  constructor(private readonly orders: WorkOrdersService) {}

  @Get()
  @RequirePermission('ticket.advance')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<WorkOrderList> {
    return this.orders.list(workspace);
  }

  @Get(':id')
  @RequirePermission('ticket.advance')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<WorkOrder> {
    return this.orders.get(workspace, id);
  }

  @Post()
  @RequirePermission('ticket.advance')
  create(
    @Body(new ZodValidationPipe(CreateWorkOrderRequest)) body: CreateWorkOrderRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.orders.create(workspace, body, user.id);
  }

  @Post(':id/assign')
  @RequirePermission('ticket.advance')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignWorkOrderRequest)) body: AssignWorkOrderRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.orders.assign(workspace, id, body, user.id);
  }

  @Post(':id/notes')
  @RequirePermission('ticket.advance')
  note(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddWorkOrderNoteRequest)) body: AddWorkOrderNoteRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.orders.addNote(workspace, id, body, user.id);
  }

  @Post(':id/block/decision')
  @RequirePermission('listing.manage')
  decideBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideRoomBlockRequest)) body: DecideRoomBlockRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.orders.decideBlock(workspace, id, body, user.id);
  }

  @Post(':id/release')
  @RequirePermission('listing.manage')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReleaseRoomRequest)) body: ReleaseRoomRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.orders.release(workspace, id, body, user.id);
  }
}

/**
 * Condition signals -> /api/v1/ops/condition-signals (real-data 1.2.3).
 *
 * Signals recommend; people decide. Reading and deciding are the maintenance board's
 * (`ticket.advance`): acting on one raises a work order, which that permission already allows.
 */
@Controller({ path: 'ops/condition-signals', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsConditionSignalsController {
  constructor(private readonly orders: WorkOrdersService) {}

  @Get()
  @RequirePermission('ticket.advance')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<ConditionSignalList> {
    return this.orders.signals(workspace);
  }

  @Post(':id/work-order')
  @RequirePermission('ticket.advance')
  act(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ConditionSignal> {
    return this.orders.actOnSignal(workspace, id, user.id);
  }

  @Post(':id/dismiss')
  @RequirePermission('ticket.advance')
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DismissConditionSignalRequest)) body: DismissConditionSignalRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ConditionSignal> {
    return this.orders.dismissSignal(workspace, id, body, user.id);
  }
}
