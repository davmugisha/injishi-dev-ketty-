import {
  ApplyLeaveDefaultsRequest,
  CreateLeaveAllocationRequest,
  CreateLeaveRequestRequest,
  CreateLeaveTypeRequest,
  CreateRestrictedLeavePeriodRequest,
  HR_PERMISSIONS,
  LeaveAllocationBulkRequest,
  LeaveBulkRequest,
  LeaveDecisionRequest,
  UpdateLeaveTypeRequest,
  UpdateRestrictedLeavePeriodRequest,
  type BulkResponse,
  type LeaveAllocationPage,
  type LeaveAllocationRequest,
  type LeaveBalancePage,
  type LeaveDashboard,
  type LeaveDefaultsDiff,
  type LeaveRequest,
  type LeaveRequestPage,
  type LeaveType,
  type LeaveTypeList,
  type ListIds,
  type ListQuery,
  type RestrictedLeavePeriod,
  type RestrictedLeavePeriodList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { LeaveAllocationsService } from '../../../modules/hr/application/leave-allocations.service';
import { LeaveTypesService } from '../../../modules/hr/application/leave-types.service';
import { LeaveService } from '../../../modules/hr/application/leave.service';
import { RestrictedPeriodsService } from '../../../modules/hr/application/restricted-periods.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Leave requests -> /api/v1/ops/leave/requests (ADR-058, AC-L1, AC-L4, AC-L5;
 * 058-leave AC-LV7).
 *
 * Deciding is `leave.approve`, never on one's own request, and a second step
 * never by whoever decided the first. A request is routed to the person's
 * reporting manager first; that orders the queue and grants nothing.
 */
@Controller({ path: 'ops/leave/requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsLeaveController {
  constructor(private readonly leave: LeaveService) {}

  /** One page of the queue through the list contract (058-list-framework). */
  @Get()
  @RequirePermission('leave.approve')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequestPage> {
    return this.leave.list(workspace, user.id, query);
  }

  /** Select all over the queue: the matching ids up to the bulk cap, and how many match. */
  @Get('ids')
  @RequirePermission('leave.approve')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ListIds> {
    return this.leave.ids(workspace, user.id, query);
  }

  /**
   * Approve or refuse several requests, each as the single command at its own
   * step. Answers 200 with a result per id, so a partial success is reported
   * row by row.
   */
  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  bulk(
    @Body(new ZodValidationPipe(LeaveBulkRequest)) body: LeaveBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.leave.bulk(workspace, user.id, body);
  }

  /** File leave for someone. Its days are an estimate until the final step. A past start needs `leave.approve`. */
  @Post()
  @RequireAnyPermission('leave.approve', 'people.manage')
  create(
    @Body(new ZodValidationPipe(CreateLeaveRequestRequest)) body: CreateLeaveRequestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.request(workspace, user.id, body);
  }

  /** The attachment, as a five minute link: who decides leave, or who keeps the files. */
  @Get(':id/attachment')
  @RequireAnyPermission('leave.approve', 'people.manage')
  attachment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.leave.attachmentLink(workspace, id);
  }

  /** Approves the step the request is at; only the final step writes the ledger. */
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.approve(workspace, user.id, id, body.note?.trim() || null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.reject(workspace, user.id, id, body.note?.trim() || null);
  }

  /** An approved leave cancelled writes a reversal for each row it took, naming the same lot. */
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.cancel(workspace, user.id, id, body.note?.trim() || null);
  }
}

/**
 * The leave views -> /api/v1/ops/leave (058-leave AC-LV13): everybody's
 * balances and the dashboard. Who decides leave and who keeps the files read
 * them; a receptionist does not.
 */
@Controller({ path: 'ops/leave', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsLeaveViewsController {
  constructor(private readonly leave: LeaveService) {}

  @Get('balances')
  @RequireAnyPermission('leave.approve', 'people.manage')
  balances(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LeaveBalancePage> {
    return this.leave.balanceList(workspace, query);
  }

  @Get('dashboard')
  @RequireAnyPermission('leave.approve', 'people.manage')
  dashboard(@CurrentWorkspace() workspace: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<LeaveDashboard> {
    return this.leave.dashboard(workspace, user.id);
  }
}

/**
 * Leave types -> /api/v1/ops/leave/types (058-leave AC-LV1, AC-LV12). Every HR
 * screen draws with a type's name, so any HR permission reads them; only
 * `people.manage` writes them or takes the national defaults.
 */
@Controller({ path: 'ops/leave/types', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsLeaveTypesController {
  constructor(private readonly types: LeaveTypesService) {}

  @Get()
  @RequireAnyPermission(...HR_PERMISSIONS)
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaveTypeList> {
    return this.types.list(workspace);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateLeaveTypeRequest)) body: CreateLeaveTypeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveType> {
    return this.types.create(workspace, user.id, body);
  }

  /** What the national row in force says that this business's types do not. */
  @Get('defaults')
  @RequirePermission('people.manage')
  defaults(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaveDefaultsDiff> {
    return this.types.defaultsDiff(workspace);
  }

  @Post('defaults/apply')
  @HttpCode(200)
  @RequirePermission('people.manage')
  applyDefaults(
    @Body(new ZodValidationPipe(ApplyLeaveDefaultsRequest)) body: ApplyLeaveDefaultsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveTypeList> {
    return this.types.applyDefaults(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLeaveTypeRequest)) body: UpdateLeaveTypeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveType> {
    return this.types.update(workspace, user.id, id, body);
  }
}

/**
 * Requests for more days -> /api/v1/ops/leave/allocation-requests (058-leave
 * AC-LV8): extra days on a type, or the compensatory days a worked holiday or
 * day off earns. Deciding is `leave.approve`, never on one's own.
 */
@Controller({ path: 'ops/leave/allocation-requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsLeaveAllocationsController {
  constructor(private readonly allocations: LeaveAllocationsService) {}

  @Get()
  @RequirePermission('leave.approve')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationPage> {
    return this.allocations.list(workspace, user.id, query);
  }

  @Get('ids')
  @RequirePermission('leave.approve')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ListIds> {
    return this.allocations.ids(workspace, user.id, query);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  bulk(
    @Body(new ZodValidationPipe(LeaveAllocationBulkRequest)) body: LeaveAllocationBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.allocations.bulk(workspace, user.id, body);
  }

  @Post()
  @RequireAnyPermission('leave.approve', 'people.manage')
  create(
    @Body(new ZodValidationPipe(CreateLeaveAllocationRequest)) body: CreateLeaveAllocationRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.allocations.create(workspace, user.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.allocations.approve(workspace, user.id, id, body.note?.trim() || null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.allocations.reject(workspace, user.id, id, body.note?.trim() || null);
  }
}

/**
 * Restricted periods -> /api/v1/ops/leave/restricted-periods (058-leave
 * AC-LV9). Whoever decides leave reads them, so a refusal can be explained;
 * `people.manage` declares them.
 */
@Controller({ path: 'ops/leave/restricted-periods', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsRestrictedPeriodsController {
  constructor(private readonly periods: RestrictedPeriodsService) {}

  @Get()
  @RequireAnyPermission('leave.approve', 'people.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RestrictedLeavePeriodList> {
    return this.periods.list(workspace);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateRestrictedLeavePeriodRequest)) body: CreateRestrictedLeavePeriodRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RestrictedLeavePeriod> {
    return this.periods.create(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRestrictedLeavePeriodRequest)) body: UpdateRestrictedLeavePeriodRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RestrictedLeavePeriod> {
    return this.periods.update(workspace, user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('people.manage')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.periods.remove(workspace, user.id, id);
  }
}
