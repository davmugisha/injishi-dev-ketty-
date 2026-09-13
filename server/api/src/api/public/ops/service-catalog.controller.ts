import {
  AdvanceServiceOrderRequest,
  CreateServiceCategoryRequest,
  CreateServiceOrderRequest,
  MarkOrderPaidCashRequest,
  type MarkOrderPaidCashResult,
  type OperatorServiceCatalog,
  type OperatorServiceOrder,
  type OperatorServiceOrderList,
  RraClassificationSearch,
  type RraClassificationList,
  UpdateServiceCategoryRequest,
  UpdateServiceItemRequest,
  UpsertServiceItemRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ServiceCatalogService } from '../../../modules/operations/application/service-catalog.service';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The menu -> /api/v1/ops/service-catalog (ADR-016 slice 7, §14.6).
 *
 * This is what `menu.manage` was waiting for. ADR-012 carved food and beverage
 * out of its scope because `service_items` did not exist, and the permission
 * has been sitting in the contracts unused ever since.
 *
 * The read is ungated beyond the workspace, because a receptionist takes orders
 * and has to see the menu to do it. Editing it is `menu.manage`.
 */
@Controller({ path: 'ops/service-catalog', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  menu(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceCatalog> {
    return this.catalog.menu(workspace);
  }

  @Post('categories')
  @RequirePermission('menu.manage')
  createCategory(
    @Body(new ZodValidationPipe(CreateServiceCategoryRequest))
    body: CreateServiceCategoryRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceCatalog> {
    return this.catalog.createCategory(workspace, body);
  }

  /** Rename a menu, hide it from guests, point it at an outlet, change its RRA prefills. */
  @Patch('categories/:id')
  @RequirePermission('menu.manage')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateServiceCategoryRequest))
    body: UpdateServiceCategoryRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceCatalog> {
    return this.catalog.updateCategory(workspace, id, body);
  }

  @Post('items')
  @RequirePermission('menu.manage')
  createItem(
    @Body(new ZodValidationPipe(UpsertServiceItemRequest))
    body: UpsertServiceItemRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceCatalog> {
    return this.catalog.createItem(workspace, body);
  }

  /**
   * Change a price, take something off the menu, mark it out of stock, add its
   * RRA codes.
   *
   * Never rewrites a placed order: an order snapshots the name, the price and
   * the tax code at the moment it was placed, so last week's bill still says
   * what last week's menu said. Turning an item orderable without every RRA
   * value is a 422 (ADR-050 D-m, AC-20).
   */
  @Patch('items/:id')
  @RequirePermission('menu.manage')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateServiceItemRequest))
    body: UpdateServiceItemRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceCatalog> {
    return this.catalog.updateItem(workspace, id, body);
  }
}

/**
 * The department's order board -> /api/v1/ops/service-orders (§14.7).
 *
 * Reaching `delivered` posts the bill line in the SAME transaction as the
 * status move, so the board and the folio can never disagree.
 *
 * `Idempotency-Key` is optional here and required on the money commands, which
 * is a real difference rather than an inconsistency: a duplicated order is a
 * kitchen ticket somebody cancels, and a duplicated payment is a guest out real
 * money.
 */
@Controller({ path: 'ops/service-orders', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsServiceOrdersController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  async list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorServiceOrderList> {
    return { orders: await this.catalog.listOrders(workspace) };
  }

  @Post()
  @RequirePermission('order.advance')
  create(
    @Body(new ZodValidationPipe(CreateServiceOrderRequest))
    body: CreateServiceOrderRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<OperatorServiceOrder> {
    return this.catalog.createOrder(workspace, body, key ?? null);
  }

  @Post(':id/advance')
  @RequirePermission('order.advance')
  advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdvanceServiceOrderRequest))
    body: AdvanceServiceOrderRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorServiceOrder> {
    return this.catalog.advanceOrder(workspace, id, body, user.id);
  }

  /**
   * Mark a pay now order paid in CASH (ADR-050 D-p, AC-24).
   *
   * `folio.payment`, the permission that takes money at the desk, and an
   * `Idempotency-Key` like every command here that moves money. Moves the
   * order to the board and raises its `NS` with means of payment `01`.
   */
  @Post(':id/paid-cash')
  @RequirePermission('folio.payment')
  markPaidCash(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MarkOrderPaidCashRequest))
    body: MarkOrderPaidCashRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    // Required, and refused when missing or malformed, before anything runs.
    // Its value is not needed: the replay is the order's own state and NS key.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @IdempotencyKey() _key: string,
  ): Promise<MarkOrderPaidCashResult> {
    return this.catalog.markPaidCash(workspace, id, body, user.id);
  }
}

/**
 * RRA's item classification list -> /api/v1/ops/rra/classifications
 * (ADR-050 D-m).
 *
 * Behind `menu.manage`, because the list is large and a public read of it
 * serves nobody: the only person who needs it is the one classifying a menu.
 */
@Controller({ path: 'ops/rra', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRraController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get('classifications')
  @RequirePermission('menu.manage')
  classifications(
    @Query(new ZodValidationPipe(RraClassificationSearch)) query: RraClassificationSearch,
  ): Promise<RraClassificationList> {
    return this.catalog.classifications(query.q);
  }
}
