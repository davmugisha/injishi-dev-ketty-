import type {
  CreateServiceCategoryRequest,
  FulfillmentType,
  ServiceCatalogStatus,
  ServiceOrderChannel,
  ServiceOrderStatus,
  TaxCode,
  UpsertServiceItemRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import {
  departments,
  folios,
  guestStays,
  rooms,
  serviceCategories,
  serviceItems,
  serviceOrderEvents,
  serviceOrderItems,
  serviceOrders,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { type ChargeDraft, postChargesTx } from './folio.repository';

export interface CategoryRow {
  id: string;
  workspaceId: string;
  departmentId: string;
  departmentName: string | null;
  name: string;
  sortOrder: number;
  guestVisible: boolean;
  status: 'active' | 'archived';
}

export interface ItemRow {
  id: string;
  workspaceId: string;
  serviceCategoryId: string;
  departmentId: string;
  name: string;
  description: string | null;
  priceRwf: number;
  taxCode: TaxCode;
  fulfillmentType: FulfillmentType;
  prepTimeMinutes: number | null;
  guestOrderable: boolean;
  stockQty: number | null;
  status: ServiceCatalogStatus;
}

export interface OrderRow {
  id: string;
  workspaceId: string;
  orderNumber: string;
  departmentId: string;
  departmentName: string | null;
  folioId: string | null;
  roomId: string | null;
  roomLabel: string | null;
  channel: ServiceOrderChannel;
  status: ServiceOrderStatus;
  fulfillmentType: FulfillmentType;
  subtotalRwf: number;
  taxRwf: number;
  totalRwf: number;
  guestNote: string | null;
  createdAt: Date;
}

export interface OrderItemRow {
  id: string;
  serviceOrderId: string;
  serviceItemId: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPriceRwf: number;
  lineTotalRwf: number;
  taxCode: TaxCode | null;
  note: string | null;
}

/** Base32 without the letters a reader confuses: no I, L, O, U. */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomOrderNumber(): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += BASE32[Math.floor(Math.random() * BASE32.length)];
  }
  return out;
}

/**
 * The only place that touches Drizzle for the menu and its orders
 * (ADR-016 slice 7, §14.6 and §14.7).
 *
 * This is what unblocks `menu.manage` and `order.advance`, the food and
 * beverage gap ADR-012 recorded as owing its own decision.
 *
 * The one rule worth stating twice: an order SNAPSHOTS the name, the price and
 * the tax code of every item at the moment it is placed (D8). Editing the menu
 * afterwards never rewrites a placed order, so last week's bill still says what
 * last week's menu said.
 */
@Injectable()
export class ServiceCatalogRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- The menu ------------------------------------------------------------

  async listCategories(workspaceId: string): Promise<CategoryRow[]> {
    return this.db
      .select({
        id: serviceCategories.id,
        workspaceId: serviceCategories.workspaceId,
        departmentId: serviceCategories.departmentId,
        departmentName: departments.name,
        name: serviceCategories.name,
        sortOrder: serviceCategories.sortOrder,
        guestVisible: serviceCategories.guestVisible,
        status: serviceCategories.status,
      })
      .from(serviceCategories)
      .leftJoin(departments, eq(departments.id, serviceCategories.departmentId))
      .where(eq(serviceCategories.workspaceId, workspaceId))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  }

  async listItems(categoryIds: string[]): Promise<ItemRow[]> {
    if (categoryIds.length === 0) return [];
    return this.selectItems(
      inArray(serviceItems.serviceCategoryId, categoryIds),
    );
  }

  async findItem(id: string): Promise<ItemRow | null> {
    const [row] = await this.selectItems(eq(serviceItems.id, id));
    return row ?? null;
  }

  async findCategory(id: string): Promise<CategoryRow | null> {
    const rows = await this.db
      .select({
        id: serviceCategories.id,
        workspaceId: serviceCategories.workspaceId,
        departmentId: serviceCategories.departmentId,
        departmentName: departments.name,
        name: serviceCategories.name,
        sortOrder: serviceCategories.sortOrder,
        guestVisible: serviceCategories.guestVisible,
        status: serviceCategories.status,
      })
      .from(serviceCategories)
      .leftJoin(departments, eq(departments.id, serviceCategories.departmentId))
      .where(eq(serviceCategories.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createCategory(input: {
    workspaceId: string;
    request: CreateServiceCategoryRequest;
  }): Promise<string | null> {
    const r = input.request;
    const [row] = await this.db
      .insert(serviceCategories)
      .values({
        departmentId: r.departmentId,
        propertyId: r.propertyId,
        workspaceId: input.workspaceId,
        name: r.name,
        guestVisible: r.guestVisible ?? true,
        sortOrder: r.sortOrder ?? 500,
      })
      .returning({ id: serviceCategories.id });
    return row?.id ?? null;
  }

  /**
   * The item's department and property are copied from its category rather than
   * asked for. An item that could name a different department than the menu it
   * sits on is an item whose revenue lands in the wrong place.
   */
  async createItem(input: {
    workspaceId: string;
    departmentId: string;
    propertyId: string;
    request: UpsertServiceItemRequest;
  }): Promise<string | null> {
    const r = input.request;
    const [row] = await this.db
      .insert(serviceItems)
      .values({
        serviceCategoryId: r.serviceCategoryId,
        departmentId: input.departmentId,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
        name: r.name,
        description: r.description ?? null,
        priceRwf: r.priceRwf,
        taxCode: r.taxCode ?? 'TAX_B',
        fulfillmentType: r.fulfillmentType ?? 'in_room_delivery',
        prepTimeMinutes: r.prepTimeMinutes ?? null,
        guestOrderable: r.guestOrderable ?? true,
        stockQty: r.stockQty ?? null,
        status: r.status ?? 'active',
      })
      .returning({ id: serviceItems.id });
    return row?.id ?? null;
  }

  async updateItem(
    id: string,
    patch: Partial<UpsertServiceItemRequest>,
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      'name',
      'description',
      'priceRwf',
      'taxCode',
      'fulfillmentType',
      'prepTimeMinutes',
      'guestOrderable',
      'stockQty',
      'status',
    ] as const) {
      if (patch[key] !== undefined) set[key] = patch[key];
    }
    await this.db.update(serviceItems).set(set).where(eq(serviceItems.id, id));
  }

  // --- Orders --------------------------------------------------------------

  async listOrders(workspaceId: string): Promise<OrderRow[]> {
    return this.selectOrders(eq(serviceOrders.workspaceId, workspaceId));
  }

  async findOrder(id: string): Promise<OrderRow | null> {
    const [row] = await this.selectOrders(eq(serviceOrders.id, id));
    return row ?? null;
  }

  async findOrderByIdempotencyKey(key: string): Promise<OrderRow | null> {
    const [row] = await this.selectOrders(eq(serviceOrders.idempotencyKey, key));
    return row ?? null;
  }

  async listOrderItems(orderIds: string[]): Promise<OrderItemRow[]> {
    if (orderIds.length === 0) return [];
    return this.db
      .select({
        id: serviceOrderItems.id,
        serviceOrderId: serviceOrderItems.serviceOrderId,
        serviceItemId: serviceOrderItems.serviceItemId,
        nameSnapshot: serviceOrderItems.nameSnapshot,
        quantity: serviceOrderItems.quantity,
        unitPriceRwf: serviceOrderItems.unitPriceRwf,
        lineTotalRwf: serviceOrderItems.lineTotalRwf,
        taxCode: serviceOrderItems.taxCode,
        note: serviceOrderItems.note,
      })
      .from(serviceOrderItems)
      .where(inArray(serviceOrderItems.serviceOrderId, orderIds))
      .orderBy(asc(serviceOrderItems.createdAt));
  }

  /** The open stay's bill, so an order knows where it will be charged. */
  async folioForStay(guestStayId: string): Promise<{
    folioId: string;
    workspaceId: string;
    propertyId: string;
    roomId: string;
  } | null> {
    const [row] = await this.db
      .select({
        folioId: folios.id,
        workspaceId: folios.workspaceId,
        propertyId: folios.propertyId,
        roomId: guestStays.roomId,
      })
      .from(guestStays)
      .innerJoin(folios, eq(folios.guestStayId, guestStays.id))
      .where(eq(guestStays.id, guestStayId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Write the order and its snapshotted lines in one transaction.
   *
   * A half written order is a kitchen ticket with missing food on it, so the
   * header and the lines go together or neither goes.
   */
  async createOrder(input: {
    workspaceId: string;
    propertyId: string;
    departmentId: string;
    folioId: string;
    guestStayId: string;
    roomId: string | null;
    channel: ServiceOrderChannel;
    fulfillmentType: FulfillmentType;
    guestNote: string | null;
    idempotencyKey: string | null;
    subtotalRwf: number;
    taxRwf: number;
    lines: {
      serviceItemId: string;
      nameSnapshot: string;
      quantity: number;
      unitPriceRwf: number;
      lineTotalRwf: number;
      taxCode: TaxCode;
      taxRate: string;
      note: string | null;
    }[];
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(serviceOrders)
        .values({
          orderNumber: randomOrderNumber(),
          workspaceId: input.workspaceId,
          propertyId: input.propertyId,
          departmentId: input.departmentId,
          folioId: input.folioId,
          guestStayId: input.guestStayId,
          roomId: input.roomId,
          channel: input.channel,
          fulfillmentType: input.fulfillmentType,
          guestNote: input.guestNote,
          idempotencyKey: input.idempotencyKey,
          subtotalRwf: input.subtotalRwf,
          taxRwf: input.taxRwf,
          totalRwf: input.subtotalRwf + input.taxRwf,
        })
        .returning({ id: serviceOrders.id });
      if (!order) return null;

      await tx.insert(serviceOrderItems).values(
        input.lines.map((l) => ({
          serviceOrderId: order.id,
          serviceItemId: l.serviceItemId,
          nameSnapshot: l.nameSnapshot,
          quantity: l.quantity,
          unitPriceRwf: l.unitPriceRwf,
          lineTotalRwf: l.lineTotalRwf,
          taxCode: l.taxCode,
          taxRate: l.taxRate,
          note: l.note,
        })),
      );

      await tx
        .insert(serviceOrderEvents)
        .values({ serviceOrderId: order.id, status: 'submitted' });

      return order.id;
    });
  }

  /**
   * Move an order, and post its charge when it is fulfilled, in ONE
   * transaction (§14.7).
   *
   * The charge and the status move together or neither happens. Splitting them
   * is how a delivered order ends up with nothing on the bill, which nobody
   * notices until the guest checks out.
   */
  async advanceOrder(input: {
    orderId: string;
    from: ServiceOrderStatus;
    to: ServiceOrderStatus;
    actorUserId: string;
    note: string | null;
    charge: { folioId: string; workspaceId: string; drafts: ChargeDraft[] } | null;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [moved] = await tx
        .update(serviceOrders)
        .set({ status: input.to, updatedAt: new Date() })
        .where(
          and(
            eq(serviceOrders.id, input.orderId),
            eq(serviceOrders.status, input.from),
          ),
        )
        .returning({ id: serviceOrders.id });
      if (!moved) return false;

      await tx.insert(serviceOrderEvents).values({
        serviceOrderId: input.orderId,
        status: input.to,
        actorUserId: input.actorUserId,
        note: input.note,
      });

      if (input.charge) await postChargesTx(tx, input.charge);

      return true;
    });
  }

  /** Has this order already put a line on the bill? */
  async isAlreadyCharged(orderId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(serviceOrderEvents)
      .where(
        and(
          eq(serviceOrderEvents.serviceOrderId, orderId),
          inArray(serviceOrderEvents.status, ['delivered', 'completed']),
        ),
      );
    return (row?.n ?? 0) > 0;
  }

  private selectItems(where: SQL): Promise<ItemRow[]> {
    return this.db
      .select({
        id: serviceItems.id,
        workspaceId: serviceItems.workspaceId,
        serviceCategoryId: serviceItems.serviceCategoryId,
        departmentId: serviceItems.departmentId,
        name: serviceItems.name,
        description: serviceItems.description,
        priceRwf: serviceItems.priceRwf,
        taxCode: serviceItems.taxCode,
        fulfillmentType: serviceItems.fulfillmentType,
        prepTimeMinutes: serviceItems.prepTimeMinutes,
        guestOrderable: serviceItems.guestOrderable,
        stockQty: serviceItems.stockQty,
        status: serviceItems.status,
      })
      .from(serviceItems)
      .where(where)
      .orderBy(asc(serviceItems.name));
  }

  private selectOrders(where: SQL): Promise<OrderRow[]> {
    return this.db
      .select({
        id: serviceOrders.id,
        workspaceId: serviceOrders.workspaceId,
        orderNumber: serviceOrders.orderNumber,
        departmentId: serviceOrders.departmentId,
        departmentName: departments.name,
        folioId: serviceOrders.folioId,
        roomId: serviceOrders.roomId,
        roomLabel: rooms.label,
        channel: serviceOrders.channel,
        status: serviceOrders.status,
        fulfillmentType: serviceOrders.fulfillmentType,
        subtotalRwf: serviceOrders.subtotalRwf,
        taxRwf: serviceOrders.taxRwf,
        totalRwf: serviceOrders.totalRwf,
        guestNote: serviceOrders.guestNote,
        createdAt: serviceOrders.createdAt,
      })
      .from(serviceOrders)
      .leftJoin(departments, eq(departments.id, serviceOrders.departmentId))
      .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
      .where(where)
      .orderBy(desc(serviceOrders.createdAt));
  }
}
