import type {
  AdvanceServiceOrderRequest,
  CreateServiceCategoryRequest,
  CreateServiceOrderRequest,
  OperatorServiceCatalog,
  OperatorServiceItem,
  OperatorServiceOrder,
  ServiceOrderStatus,
  UpsertServiceItemRequest,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  type ChargeDraft,
  FolioRepository,
} from '../infrastructure/folio.repository';
import { accountCodeFor } from '../infrastructure/ledger-posting';
import {
  type ItemRow,
  type OrderItemRow,
  type OrderRow,
  ServiceCatalogRepository,
} from '../infrastructure/service-catalog.repository';

/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered ->
 * completed`, plus `submitted -> rejected`, and anything before `delivered` to
 * `cancelled` (§14.7).
 */
const ORDER_TRANSITIONS: Readonly<
  Record<ServiceOrderStatus, ServiceOrderStatus[]>
> = {
  submitted: ['acknowledged', 'in_progress', 'rejected', 'cancelled'],
  acknowledged: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
};

/** Reaching either of these puts the order on the bill. */
const FULFILLED = new Set<ServiceOrderStatus>(['delivered', 'completed']);

/**
 * The menu and the orders placed against it (ADR-016 slice 7).
 *
 * Two things here are worth reading twice:
 *
 * 1. **An order snapshots its prices** (D8). The name, the unit price and the
 *    tax code are copied onto the order line at the moment it is placed, so
 *    editing the menu never rewrites a bill that was already run.
 * 2. **Fulfilment posts the folio charge in the same transaction** as the
 *    status move (§14.7). Splitting them is how a delivered order ends up with
 *    nothing on the bill, and nobody notices until the guest checks out.
 */
@Injectable()
export class ServiceCatalogService {
  constructor(
    private readonly catalog: ServiceCatalogRepository,
    private readonly folios: FolioRepository,
  ) {}

  /** The whole menu, grouped, which is the only way anyone reads it. */
  async menu(ws: WorkspaceAccess): Promise<OperatorServiceCatalog> {
    const categories = await this.catalog.listCategories(ws.workspaceId);
    const items = await this.catalog.listItems(categories.map((c) => c.id));
    return {
      categories: categories.map((c) => ({
        id: c.id,
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        name: c.name,
        sortOrder: c.sortOrder,
        guestVisible: c.guestVisible,
        status: c.status,
        items: items
          .filter((i) => i.serviceCategoryId === c.id)
          .map((i) => this.presentItem(i)),
      })),
    };
  }

  async createCategory(
    ws: WorkspaceAccess,
    body: CreateServiceCategoryRequest,
  ): Promise<OperatorServiceCatalog> {
    const department = assertOwned(
      await this.folios.findDepartment(body.departmentId),
      ws,
    );
    if (!department.isRevenueCenter) {
      throw new UnprocessableEntityException(
        'A menu belongs to a revenue centre. That department is a cost centre.',
      );
    }
    const id = await this.catalog.createCategory({
      workspaceId: ws.workspaceId,
      request: body,
    });
    if (!id) throw this.vanished();
    return this.menu(ws);
  }

  async createItem(
    ws: WorkspaceAccess,
    body: UpsertServiceItemRequest,
  ): Promise<OperatorServiceCatalog> {
    const category = assertOwned(
      await this.catalog.findCategory(body.serviceCategoryId),
      ws,
    );
    const department = assertOwned(
      await this.folios.findDepartment(category.departmentId),
      ws,
    );
    if (!department.propertyId) {
      throw new UnprocessableEntityException(
        'That menu sits on a corporate department, which has no property to sell from.',
      );
    }

    const id = await this.catalog.createItem({
      workspaceId: ws.workspaceId,
      departmentId: category.departmentId,
      propertyId: department.propertyId,
      request: body,
    });
    if (!id) throw this.vanished();
    return this.menu(ws);
  }

  async updateItem(
    ws: WorkspaceAccess,
    id: string,
    patch: Partial<UpsertServiceItemRequest>,
  ): Promise<OperatorServiceCatalog> {
    const item = assertOwned(await this.catalog.findItem(id), ws);
    await this.catalog.updateItem(item.id, patch);
    return this.menu(ws);
  }

  // --- Orders --------------------------------------------------------------

  async listOrders(ws: WorkspaceAccess): Promise<OperatorServiceOrder[]> {
    const orders = await this.catalog.listOrders(ws.workspaceId);
    const lines = await this.catalog.listOrderItems(orders.map((o) => o.id));
    return orders.map((o) => this.presentOrder(o, lines));
  }

  /**
   * Place an order against a stay.
   *
   * The DEPARTMENT is not asked for: it comes from the items, because an item
   * carries its own department and a caller who could choose would eventually
   * route a club sandwich to Engineering. Every item on one order has to belong
   * to the same department, which is what "an order routes to a department"
   * means in practice.
   */
  async createOrder(
    ws: WorkspaceAccess,
    body: CreateServiceOrderRequest,
    clientKey: string | null,
  ): Promise<OperatorServiceOrder> {
    const key = clientKey ? `${ws.workspaceId}:${clientKey}` : null;
    if (key) {
      const replay = await this.catalog.findOrderByIdempotencyKey(key);
      if (replay) {
        const lines = await this.catalog.listOrderItems([replay.id]);
        return this.presentOrder(replay, lines);
      }
    }

    const stay = assertOwned(
      await this.catalog.folioForStay(body.guestStayId),
      ws,
    );

    const rates = await this.folios.effectiveTaxRates(new Date());
    if (!rates) {
      throw new UnprocessableEntityException(
        'No tax rates are effective right now, so nothing can be priced. Set them in config first.',
      );
    }

    const lines: Parameters<ServiceCatalogRepository['createOrder']>[0]['lines'] =
      [];
    let departmentId: string | null = null;
    let subtotalRwf = 0;
    let taxRwf = 0;
    let fulfillmentType: OperatorServiceOrder['fulfillmentType'] =
      'in_room_delivery';

    for (const requested of body.items) {
      const item = assertOwned(
        await this.catalog.findItem(requested.serviceItemId),
        ws,
      );
      if (item.status !== 'active') {
        throw new ConflictException(`${item.name} is not available right now.`);
      }
      departmentId ??= item.departmentId;
      if (departmentId !== item.departmentId) {
        throw new UnprocessableEntityException(
          'Everything on one order has to come from the same department. Split it.',
        );
      }
      fulfillmentType = item.fulfillmentType;

      const rate = rates[item.taxCode];
      if (typeof rate !== 'number') {
        throw new UnprocessableEntityException(
          `The effective tax rates do not cover ${item.taxCode}.`,
        );
      }
      const lineTotalRwf = item.priceRwf * requested.quantity;
      subtotalRwf += lineTotalRwf;
      taxRwf += Math.round(lineTotalRwf * rate);

      lines.push({
        serviceItemId: item.id,
        // Locked at order time. The menu may change tomorrow; this bill may not.
        nameSnapshot: item.name,
        quantity: requested.quantity,
        unitPriceRwf: item.priceRwf,
        lineTotalRwf,
        taxCode: item.taxCode,
        taxRate: String(rate),
        note: requested.note ?? null,
      });
    }
    if (!departmentId) {
      throw new UnprocessableEntityException('An order needs at least one item.');
    }

    const id = await this.catalog.createOrder({
      workspaceId: ws.workspaceId,
      propertyId: stay.propertyId,
      departmentId,
      folioId: stay.folioId,
      guestStayId: body.guestStayId,
      roomId: stay.roomId,
      channel: body.channel ?? 'front_desk',
      fulfillmentType,
      guestNote: body.guestNote ?? null,
      idempotencyKey: key,
      subtotalRwf,
      taxRwf,
      lines,
    });
    if (!id) throw this.vanished();

    const created = await this.catalog.findOrder(id);
    if (!created) throw this.vanished();
    return this.presentOrder(created, await this.catalog.listOrderItems([id]));
  }

  /**
   * Move an order along the department's board.
   *
   * Reaching `delivered` posts the bill line, in the same transaction, once.
   * Moving on to `completed` posts nothing further: the charge went on at
   * delivery and posting again would bill the guest twice for one club
   * sandwich.
   */
  async advanceOrder(
    ws: WorkspaceAccess,
    id: string,
    body: AdvanceServiceOrderRequest,
    actorUserId: string,
  ): Promise<OperatorServiceOrder> {
    const order = assertOwned(await this.catalog.findOrder(id), ws);
    if (order.status === body.to) {
      return this.presentOrder(order, await this.catalog.listOrderItems([id]));
    }
    if (!ORDER_TRANSITIONS[order.status].includes(body.to)) {
      throw new ConflictException(
        `An order that is ${order.status.replace('_', ' ')} cannot go straight to ${body.to.replace('_', ' ')}.`,
      );
    }

    let charge: {
      folioId: string;
      workspaceId: string;
      drafts: ChargeDraft[];
    } | null = null;

    if (FULFILLED.has(body.to) && order.folioId) {
      const alreadyCharged = await this.catalog.isAlreadyCharged(order.id);
      if (!alreadyCharged) {
        charge = await this.buildOrderCharge(ws, order);
      }
    }

    await this.catalog.advanceOrder({
      orderId: order.id,
      from: order.status,
      to: body.to,
      actorUserId,
      note: body.note ?? null,
      charge,
    });

    const updated = await this.catalog.findOrder(id);
    if (!updated) throw this.vanished();
    return this.presentOrder(updated, await this.catalog.listOrderItems([id]));
  }

  /**
   * The bill lines a fulfilled order owes: the goods, then the tax.
   *
   * Two lines, not one with tax folded in (D-n). `amount_rwf` is tax exclusive
   * everywhere on a folio, so an invoice never has to pull the two apart again.
   */
  private async buildOrderCharge(
    ws: WorkspaceAccess,
    order: OrderRow,
  ): Promise<{
    folioId: string;
    workspaceId: string;
    drafts: ChargeDraft[];
  } | null> {
    if (!order.folioId) return null;

    const department = await this.folios.findDepartment(order.departmentId);
    const accountCode = accountCodeFor({
      chargeType: 'service_order',
      departmentCategory: department?.departmentCategory ?? null,
    });
    if (!accountCode) return null;

    const drafts: ChargeDraft[] = [
      {
        chargeType: 'service_order',
        description: `Order ${order.orderNumber}`,
        departmentId: order.departmentId,
        quantity: 1,
        unitPriceRwf: order.subtotalRwf,
        amountRwf: order.subtotalRwf,
        taxCode: null,
        taxRate: null,
        taxAmountRwf: order.taxRwf,
        sourceRefType: 'service_order',
        sourceRefId: order.id,
        postedByUserId: null,
        businessDate: null,
        idempotencyKey: `${ws.workspaceId}:order:${order.id}`,
        accountCode,
      },
    ];

    if (order.taxRwf !== 0) {
      drafts.push({
        chargeType: 'tax',
        description: `Tax on order ${order.orderNumber}`,
        departmentId: null,
        quantity: 1,
        unitPriceRwf: order.taxRwf,
        amountRwf: order.taxRwf,
        taxCode: null,
        taxRate: null,
        taxAmountRwf: null,
        sourceRefType: 'service_order',
        sourceRefId: order.id,
        postedByUserId: null,
        businessDate: null,
        idempotencyKey: `${ws.workspaceId}:order:${order.id}:tax`,
        accountCode: 'TAX_PAYABLE',
      });
    }

    return { folioId: order.folioId, workspaceId: ws.workspaceId, drafts };
  }

  private presentItem(row: ItemRow): OperatorServiceItem {
    return {
      id: row.id,
      serviceCategoryId: row.serviceCategoryId,
      departmentId: row.departmentId,
      name: row.name,
      description: row.description,
      priceRwf: row.priceRwf,
      taxCode: row.taxCode,
      fulfillmentType: row.fulfillmentType,
      prepTimeMinutes: row.prepTimeMinutes,
      guestOrderable: row.guestOrderable,
      stockQty: row.stockQty,
      status: row.status,
    };
  }

  private presentOrder(
    row: OrderRow,
    lines: OrderItemRow[],
  ): OperatorServiceOrder {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      folioId: row.folioId,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      channel: row.channel,
      status: row.status,
      fulfillmentType: row.fulfillmentType,
      subtotalRwf: row.subtotalRwf,
      taxRwf: row.taxRwf,
      totalRwf: row.totalRwf,
      guestNote: row.guestNote,
      createdAt: row.createdAt.toISOString(),
      items: lines
        .filter((l) => l.serviceOrderId === row.id)
        .map((l) => ({
          id: l.id,
          serviceItemId: l.serviceItemId,
          nameSnapshot: l.nameSnapshot,
          quantity: l.quantity,
          unitPriceRwf: l.unitPriceRwf,
          lineTotalRwf: l.lineTotalRwf,
          taxCode: l.taxCode,
          note: l.note,
        })),
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
