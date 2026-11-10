import type {
  FulfillmentType,
  OrderContext,
  RraItemTypeCode,
  SelectedOptionSnapshot,
  ServiceCatalogStatus,
  ServiceItemOption,
  ServiceOrderChannel,
  ServiceOrderStatus,
  TaxCode,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import {
  configEntries,
  departments,
  ebmInvoiceLines,
  ebmInvoices,
  folios,
  guestStays,
  outlets,
  posAuditEvents,
  properties,
  rooms,
  rraItemClassifications,
  serviceCategories,
  serviceItems,
  serviceOrderEvents,
  serviceOrderItems,
  serviceOrders,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { writeOutboxTx } from '../../../shared/outbox/outbox';
import { orderEmissionKeyFor } from '../../platform/fiscal/domain/emission-keys';
import {
  insertHeldTx,
  mintReceiptNumberTx,
} from '../../platform/fiscal/infrastructure/ebm-emission.repository';
import type { DeclarationPlan } from '../../platform/fiscal/application/declaration-plan.service';
import { MAX_ITEM_SERIAL, itemCode, serialOf } from '../domain/sellable-item';
import { NO_CONNECTION, type ChargeDraft, postChargesTx } from '../../pms/application/folio-port';
import { writeOrderThreadLineTx } from './order-thread-lines';

export interface CategoryRow {
  id: string;
  workspaceId: string;
  departmentId: string;
  departmentName: string | null;
  propertyId: string;
  outletId: string | null;
  name: string;
  sortOrder: number;
  guestVisible: boolean;
  status: 'active' | 'archived';
  defaultRraItemClsCd: string | null;
  defaultRraItemTyCd: RraItemTypeCode | null;
  defaultRraPkgUnitCd: string | null;
  defaultRraQtyUnitCd: string | null;
  defaultTaxCode: TaxCode | null;
}

export interface ItemRow {
  id: string;
  workspaceId: string;
  serviceCategoryId: string;
  departmentId: string;
  propertyId: string;
  /** The item's own outlet, else its category's. */
  outletId: string | null;
  name: string;
  description: string | null;
  priceRwf: number;
  taxCode: TaxCode;
  fulfillmentType: FulfillmentType;
  prepTimeMinutes: number | null;
  guestOrderable: boolean;
  stockQty: number | null;
  status: ServiceCatalogStatus;
  options: unknown;
  rraItemClsCd: string | null;
  rraItemClsName: string | null;
  rraItemTyCd: RraItemTypeCode | null;
  rraItemCd: string | null;
  rraPkgUnitCd: string | null;
  rraQtyUnitCd: string | null;
}

export interface OrderRow {
  id: string;
  workspaceId: string;
  propertyId: string | null;
  /**
   * The branch the order belongs to (ADR-054): its own property, else its
   * outlet's. Null for a standalone outlet order, which only a member
   * covering every branch sees (AC-T3).
   */
  branchPropertyId: string | null;
  /** The outlet it was ordered from, whose taxpayer its charge belongs to. */
  outletId: string | null;
  orderedByUserId: string | null;
  customerUserId: string | null;
  orderNumber: string;
  departmentId: string;
  departmentName: string | null;
  folioId: string | null;
  guestStayId: string | null;
  roomId: string | null;
  roomLabel: string | null;
  channel: ServiceOrderChannel;
  status: ServiceOrderStatus;
  orderContext: OrderContext;
  taxEntityOrgId: string;
  paymentAttemptId: string | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  fulfillmentType: FulfillmentType;
  subtotalRwf: number;
  taxRwf: number;
  totalRwf: number;
  guestNote: string | null;
  createdAt: Date;
}

/** An order's branch: its own property, else its outlet's (ADR-054). */
const ORDER_BRANCH = sql<string | null>`coalesce(${serviceOrders.propertyId}, ${outlets.propertyId})`;

export interface OrderItemRow {
  id: string;
  serviceOrderId: string;
  serviceItemId: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPriceRwf: number;
  lineTotalRwf: number;
  taxCode: TaxCode | null;
  taxRate: string | null;
  selectedOptions: unknown;
  note: string | null;
}

export interface OrderEventRow {
  status: ServiceOrderStatus;
  occurredAt: Date;
}

/** One line to write onto an order, already priced from the item as it is now. */
export interface OrderLineDraft {
  serviceItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceRwf: number;
  lineTotalRwf: number;
  taxCode: TaxCode;
  taxRate: string;
  selectedOptions: SelectedOptionSnapshot[];
  note: string | null;
}

/** What settling a pay now order did. */
export type SettleOutcome =
  | {
      kind: 'settled';
      replayed: boolean;
      emissionId: string | null;
      /** A held row this settlement created, which the worker should be woken for. */
      wake: boolean;
    }
  | { kind: 'not_pending'; status: ServiceOrderStatus };

/** The RRA origin code when `config_entries` names none (ADR-050 D-m). */
const DEFAULT_RRA_ORIGIN = 'RW';

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
 * Who changed an item's stock through the catalogue, so the change is recorded with it. The catalogue is not the
 * Stock screen (which asks for a reason and a kind), but stock moved here must not be silent: it lands in the same
 * `stock.*` history, in the same transaction as the change itself.
 */
export interface StockEditAudit {
  workspaceId: string;
  outletId: string | null;
  actorUserId: string;
  itemName: string;
  /** `opening` for a new item's first quantity, `catalogue_edit` for a later change. */
  kind: 'opening' | 'catalogue_edit';
}

function stockAuditRow(a: StockEditAudit, itemId: string, before: number | null, after: number | null): typeof posAuditEvents.$inferInsert {
  return {
    workspaceId: a.workspaceId,
    outletId: a.outletId,
    actorUserId: a.actorUserId,
    action: `stock.${a.kind}`,
    entityType: 'service_item',
    entityId: itemId,
    before: { stockQty: before },
    after: { stockQty: after, delta: after === null ? null : after - (before ?? 0), item: a.itemName, kind: a.kind },
    reason: a.kind === 'opening' ? 'Opening quantity set when the item was added' : 'Changed on the menu, not counted on the Stock screen',
  };
}

/**
 * The only place that touches Drizzle for the menu and its orders
 * (ADR-016 slice 7, §14.6 and §14.7; ADR-050 slice 3).
 *
 * This is what unblocks `menu.manage` and `order.advance`, the food and
 * beverage gap ADR-012 recorded as owing its own decision.
 *
 * The one rule worth stating twice: an order SNAPSHOTS the name, the price, the
 * chosen modifiers and the tax code of every item at the moment it is placed
 * (D8, AC-23). Editing the menu afterwards never rewrites a placed order, so
 * last week's bill still says what last week's menu said.
 */
@Injectable()
export class ServiceCatalogRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- The menu ------------------------------------------------------------

  async listCategories(workspaceId: string, scope: BranchScope): Promise<CategoryRow[]> {
    return this.selectCategories(
      and(
        eq(serviceCategories.workspaceId, workspaceId),
        inBranchScope(serviceCategories.propertyId, scope),
      ) as SQL,
    );
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
    const [row] = await this.selectCategories(eq(serviceCategories.id, id));
    return row ?? null;
  }

  /** An outlet, for checking a menu is pointed at one its own workspace holds. */
  async findOutlet(id: string): Promise<{
    id: string;
    workspaceId: string;
    /** Null for a standalone outlet (ADR-050 D-l). */
    propertyId: string | null;
    taxEntityOrgId: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: outlets.id,
        workspaceId: outlets.workspaceId,
        propertyId: outlets.propertyId,
        taxEntityOrgId: outlets.taxEntityOrgId,
      })
      .from(outlets)
      .where(eq(outlets.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Whether a classification code is on RRA's list and still in use. */
  async classificationIsActive(code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ active: rraItemClassifications.active })
      .from(rraItemClassifications)
      .where(eq(rraItemClassifications.code, code))
      .limit(1);
    return row?.active === true;
  }

  /**
   * The menu's classification picker (ADR-050 D-m). Active codes only, by code
   * prefix or by name, and bounded: the list runs to thousands of rows and a
   * picker that ships all of them is a picker nobody can use.
   */
  async searchClassifications(
    q: string,
    limit = 25,
  ): Promise<Array<{ code: string; name: string; level: number }>> {
    const term = q.trim();
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    return this.db
      .select({
        code: rraItemClassifications.code,
        name: rraItemClassifications.name,
        level: rraItemClassifications.level,
      })
      .from(rraItemClassifications)
      .where(
        and(
          eq(rraItemClassifications.active, true),
          term
            ? or(
                ilike(rraItemClassifications.code, `${escaped}%`),
                ilike(rraItemClassifications.name, `%${escaped}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(rraItemClassifications.level), asc(rraItemClassifications.code))
      .limit(limit);
  }

  async createCategory(input: {
    workspaceId: string;
    propertyId: string;
    departmentId: string;
    outletId: string | null;
    name: string;
    guestVisible: boolean;
    sortOrder: number;
    defaultRraItemClsCd: string | null;
    defaultRraItemTyCd: RraItemTypeCode | null;
    defaultRraPkgUnitCd: string | null;
    defaultRraQtyUnitCd: string | null;
    defaultTaxCode: TaxCode | null;
  }): Promise<string | null> {
    const [row] = await this.db
      .insert(serviceCategories)
      .values(input)
      .returning({ id: serviceCategories.id });
    return row?.id ?? null;
  }

  async updateCategory(
    id: string,
    patch: Partial<{
      outletId: string | null;
      name: string;
      guestVisible: boolean;
      sortOrder: number;
      defaultRraItemClsCd: string;
      defaultRraItemTyCd: RraItemTypeCode;
      defaultRraPkgUnitCd: string;
      defaultRraQtyUnitCd: string;
      defaultTaxCode: TaxCode;
    }>,
  ): Promise<void> {
    await this.db
      .update(serviceCategories)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id));
  }

  /**
   * The item's department and property are copied from its category rather than
   * asked for. An item that could name a different department than the menu it
   * sits on is an item whose revenue lands in the wrong place. Every value here
   * is already resolved by the service, prefills included.
   */
  async createItem(input: {
    workspaceId: string;
    serviceCategoryId: string;
    departmentId: string;
    propertyId: string;
    name: string;
    description: string | null;
    priceRwf: number;
    taxCode: TaxCode;
    fulfillmentType: FulfillmentType;
    prepTimeMinutes: number | null;
    guestOrderable: boolean;
    stockQty: number | null;
    status: ServiceCatalogStatus;
    options: ServiceItemOption[];
    rraItemClsCd: string | null;
    rraItemTyCd: RraItemTypeCode | null;
    rraPkgUnitCd: string | null;
    rraQtyUnitCd: string | null;
  }, audit?: StockEditAudit): Promise<string | null> {
    if (!audit || input.stockQty === null) {
      const [row] = await this.db
        .insert(serviceItems)
        .values(input)
        .returning({ id: serviceItems.id });
      return row?.id ?? null;
    }
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(serviceItems).values(input).returning({ id: serviceItems.id });
      if (row) await tx.insert(posAuditEvents).values(stockAuditRow(audit, row.id, null, input.stockQty));
      return row?.id ?? null;
    });
  }

  async updateItem(
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      priceRwf: number;
      taxCode: TaxCode;
      fulfillmentType: FulfillmentType;
      prepTimeMinutes: number;
      guestOrderable: boolean;
      stockQty: number | null;
      status: ServiceCatalogStatus;
      options: ServiceItemOption[];
      rraItemClsCd: string;
      rraItemTyCd: RraItemTypeCode;
      rraPkgUnitCd: string;
      rraQtyUnitCd: string;
    }>,
    audit?: StockEditAudit,
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) set[key] = value;
    }
    if (!audit || patch.stockQty === undefined) {
      await this.db.update(serviceItems).set(set).where(eq(serviceItems.id, id));
      return;
    }
    await this.db.transaction(async (tx) => {
      // The quantity is read HERE, under a row lock, not taken from the caller's earlier read: a sale between that read and
      // this write would otherwise leave a history row whose "before" was never true. A change to the same number leaves no row.
      const [current] = await tx.select({ stockQty: serviceItems.stockQty }).from(serviceItems).where(eq(serviceItems.id, id)).for('update');
      await tx.update(serviceItems).set(set).where(eq(serviceItems.id, id));
      const next = patch.stockQty ?? null;
      if (current && current.stockQty !== next) {
        await tx.insert(posAuditEvents).values(stockAuditRow(audit, id, current.stockQty, next));
      }
    });
  }

  /**
   * MINT AN ITEM'S `itemCd`, once (ADR-050 D-m, VSDC v1.0.5 §4.17).
   *
   * Runs only for an item that holds a product type and both unit codes and has
   * no code yet, so a renamed dish, or one whose units change later, keeps the
   * code it was declared under.
   *
   * The serial is per ORG, because `itemCd` is unique per taxpayer, and one org
   * may sell through several workspaces. So the next serial is read across all
   * of them under a transaction scoped advisory lock keyed on the org: two items
   * minted at once for one business queue here rather than both taking the same
   * number. `service_items_workspace_item_cd_uk` is the backstop inside one
   * workspace.
   *
   * Returns the item's code, minted now or already held, or null when it cannot
   * be minted yet.
   */
  async mintItemCode(itemId: string): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: serviceItems.id,
          orgId: workspaces.orgId,
          rraItemCd: serviceItems.rraItemCd,
          rraItemTyCd: serviceItems.rraItemTyCd,
          rraPkgUnitCd: serviceItems.rraPkgUnitCd,
          rraQtyUnitCd: serviceItems.rraQtyUnitCd,
        })
        .from(serviceItems)
        .innerJoin(workspaces, eq(workspaces.id, serviceItems.workspaceId))
        .where(eq(serviceItems.id, itemId))
        .limit(1);
      if (!item) return null;
      if (item.rraItemCd) return item.rraItemCd;
      if (!item.rraItemTyCd || !item.rraPkgUnitCd || !item.rraQtyUnitCd || !item.orgId) {
        return null;
      }

      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`rra-item-cd:${item.orgId}`}, 0))`,
      );

      const minted = await tx
        .select({ code: serviceItems.rraItemCd })
        .from(serviceItems)
        .innerJoin(workspaces, eq(workspaces.id, serviceItems.workspaceId))
        .where(and(eq(workspaces.orgId, item.orgId), isNotNull(serviceItems.rraItemCd)));
      const last = minted.reduce((max, row) => Math.max(max, serialOf(row.code ?? '') ?? 0), 0);
      if (last >= MAX_ITEM_SERIAL) {
        throw new Error(`Org ${item.orgId} has minted every item code serial §4.17 allows.`);
      }

      const code = itemCode({
        origin: await this.rraOriginTx(tx),
        productType: item.rraItemTyCd,
        packagingUnit: item.rraPkgUnitCd,
        quantityUnit: item.rraQtyUnitCd,
        serial: last + 1,
      });
      await tx
        .update(serviceItems)
        .set({ rraItemCd: code, updatedAt: new Date() })
        .where(and(eq(serviceItems.id, item.id), isNull(serviceItems.rraItemCd)));
      return code;
    });
  }

  // --- Orders --------------------------------------------------------------

  async listOrders(workspaceId: string, scope: BranchScope): Promise<OrderRow[]> {
    return this.selectOrders(
      and(
        eq(serviceOrders.workspaceId, workspaceId),
        inBranchScope(ORDER_BRANCH, scope),
      ) as SQL,
    );
  }

  /**
   * A guest's own orders, newest first. Keyed on the PERSON, never a
   * workspace: an order they placed, or a walk in order they are the customer
   * of.
   */
  async listOrdersForGuest(userId: string): Promise<OrderRow[]> {
    return this.selectOrders(
      or(
        eq(serviceOrders.orderedByUserId, userId),
        eq(serviceOrders.customerUserId, userId),
      )!,
    );
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
        taxRate: serviceOrderItems.taxRate,
        selectedOptions: serviceOrderItems.selectedOptions,
        note: serviceOrderItems.note,
      })
      .from(serviceOrderItems)
      .where(inArray(serviceOrderItems.serviceOrderId, orderIds))
      .orderBy(asc(serviceOrderItems.createdAt));
  }

  async listOrderEvents(orderId: string): Promise<OrderEventRow[]> {
    return this.db
      .select({ status: serviceOrderEvents.status, occurredAt: serviceOrderEvents.occurredAt })
      .from(serviceOrderEvents)
      .where(eq(serviceOrderEvents.serviceOrderId, orderId))
      .orderBy(asc(serviceOrderEvents.occurredAt));
  }

  /**
   * The open stay's CURRENT bill, so an order knows where it will be charged:
   * the highest `folio_sequence`, because a stay holds several once a late
   * charge follows a signed bill (ADR-050 D-c).
   */
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
      .orderBy(desc(folios.folioSequence))
      .limit(1);
    return row ?? null;
  }

  /**
   * WHOSE TIN SIGNS AN ORDER (ADR-050, cross child contract 1): the outlet's
   * `tax_entity_org_id`, else the property's org for an order no outlet sells.
   * The same order `resolveTaxEntityTx` answers a charge in, so an order and the
   * bill line it becomes can never name two taxpayers.
   */
  async taxEntityFor(input: {
    outletId: string | null;
    propertyId: string | null;
  }): Promise<string | null> {
    if (input.outletId) {
      const outlet = await this.findOutlet(input.outletId);
      if (outlet) return outlet.taxEntityOrgId;
    }
    if (input.propertyId) {
      const [row] = await this.db
        .select({ orgId: properties.orgId })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);
      if (row) return row.orgId;
    }
    return null;
  }

  /**
   * Write the order and its snapshotted lines in one transaction.
   *
   * A half written order is a kitchen ticket with missing food on it, so the
   * header and the lines go together or neither goes. A pay now order is born
   * `pending_payment` with no bill; everything else is `submitted` on its bill.
   */
  async createOrder(input: {
    workspaceId: string;
    propertyId: string | null;
    departmentId: string;
    orderContext: OrderContext;
    folioId: string | null;
    guestStayId: string | null;
    roomId: string | null;
    taxEntityOrgId: string;
    channel: ServiceOrderChannel;
    fulfillmentType: FulfillmentType;
    guestNote: string | null;
    idempotencyKey: string | null;
    /** Set by the guest route (ADR-050 D-o); the staff route leaves both null. */
    outletId?: string | null;
    orderedByUserId?: string | null;
    /** A signed in walk in with no stay, who pays now. */
    customerUserId?: string | null;
    requestedForAt?: Date | null;
    /** The conversation it was placed from (ADR-050 D-s), already proved the guest's. */
    threadId?: string | null;
    subtotalRwf: number;
    taxRwf: number;
    lines: OrderLineDraft[];
  }): Promise<string | null> {
    const status: ServiceOrderStatus =
      input.orderContext === 'pay_now' ? 'pending_payment' : 'submitted';

    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(serviceOrders)
        .values({
          orderNumber: randomOrderNumber(),
          workspaceId: input.workspaceId,
          propertyId: input.propertyId,
          departmentId: input.departmentId,
          orderContext: input.orderContext,
          taxEntityOrgId: input.taxEntityOrgId,
          status,
          folioId: input.folioId,
          guestStayId: input.guestStayId,
          roomId: input.roomId,
          channel: input.channel,
          fulfillmentType: input.fulfillmentType,
          guestNote: input.guestNote,
          idempotencyKey: input.idempotencyKey,
          outletId: input.outletId ?? null,
          orderedByUserId: input.orderedByUserId ?? null,
          customerUserId: input.customerUserId ?? null,
          requestedForAt: input.requestedForAt ?? null,
          threadId: input.threadId ?? null,
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
          selectedOptions: l.selectedOptions,
          note: l.note,
        })),
      );

      await tx
        .insert(serviceOrderEvents)
        .values({ serviceOrderId: order.id, status, actorUserId: input.orderedByUserId ?? null });
      await writeOrderThreadLineTx(tx, order.id, status);

      await writeOutboxTx(tx, {
        eventType: 'order.status',
        aggregateType: 'service_order',
        aggregateId: order.id,
        change: status,
        workspaceId: input.workspaceId,
        payload: {
          orderId: order.id,
          status,
          propertyId: input.propertyId,
          departmentId: input.departmentId,
          roomId: input.roomId,
          userId: input.orderedByUserId ?? input.customerUserId ?? null,
        },
      });

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
        .returning({
          id: serviceOrders.id,
          workspaceId: serviceOrders.workspaceId,
          propertyId: serviceOrders.propertyId,
          departmentId: serviceOrders.departmentId,
          roomId: serviceOrders.roomId,
          orderedByUserId: serviceOrders.orderedByUserId,
          customerUserId: serviceOrders.customerUserId,
        });
      if (!moved) return false;

      // ADR-050 D-v: the guest's order card and the department's board re-read.
      await writeOutboxTx(tx, {
        eventType: 'order.status',
        aggregateType: 'service_order',
        aggregateId: moved.id,
        change: input.to,
        workspaceId: moved.workspaceId,
        payload: {
          orderId: moved.id,
          status: input.to,
          propertyId: moved.propertyId,
          departmentId: moved.departmentId,
          roomId: moved.roomId,
          userId: moved.orderedByUserId ?? moved.customerUserId,
        },
      });

      await tx.insert(serviceOrderEvents).values({
        serviceOrderId: input.orderId,
        status: input.to,
        actorUserId: input.actorUserId,
        note: input.note,
      });
      await writeOrderThreadLineTx(tx, input.orderId, input.to);

      if (input.charge) {
        // An order delivered after its bill was signed goes on the stay's next
        // bill (ADR-050 D-c), and the order follows it, so the order and the
        // bill that carries it never name two different folios.
        const posted = await postChargesTx(tx, { ...input.charge, onLocked: 'open_next' });
        if (posted.movedToFolioId) {
          await tx
            .update(serviceOrders)
            .set({ folioId: posted.movedToFolioId, updatedAt: new Date() })
            .where(eq(serviceOrders.id, input.orderId));
        }
      }

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

  /** Name the mobile money attempt a pay now order is waiting on. A retry replaces it. */
  async attachPaymentAttempt(orderId: string, paymentAttemptId: string): Promise<void> {
    await this.db
      .update(serviceOrders)
      .set({ paymentAttemptId, updatedAt: new Date() })
      .where(and(eq(serviceOrders.id, orderId), eq(serviceOrders.status, 'pending_payment')));
  }

  /**
   * A PAY NOW ORDER'S MONEY HAS LANDED: move it to the board and DECLARE ITS
   * SALE, in ONE transaction (ADR-050 D-n, AC-21, AC-24).
   *
   * The order moves `pending_payment -> submitted` only if it is still pending,
   * so a cash mark and a mobile money settlement racing each other cannot both
   * win. The sale is ONE `NS` (`source = outlet_order`) over the order's own
   * snapshots, under the order's taxpayer, and its receipt number is minted as
   * the last statement before commit, exactly as a folio close does it.
   *
   * A replay (the order is already paid by the same means) answers with the
   * declaration it raised rather than a refusal. A missing EBM connection writes
   * the declaration `failed` with `no_connection`, and the order still goes to
   * the kitchen: the money is taken and the guest is waiting (D-b).
   */
  async settlePayNow(input: {
    orderId: string;
    paymentMethod: '01' | '06';
    markedByUserId: string | null;
    paymentAttemptId: string | null;
    plan: DeclarationPlan;
  }): Promise<SettleOutcome> {
    return this.db.transaction(async (tx): Promise<SettleOutcome> => {
      const paidAt = new Date();
      const [order] = await tx
        .update(serviceOrders)
        .set({
          status: 'submitted',
          paidAt,
          paymentMethod: input.paymentMethod,
          paidMarkedByUserId: input.markedByUserId,
          ...(input.paymentAttemptId ? { paymentAttemptId: input.paymentAttemptId } : {}),
          updatedAt: paidAt,
        })
        .where(
          and(
            eq(serviceOrders.id, input.orderId),
            eq(serviceOrders.orderContext, 'pay_now'),
            eq(serviceOrders.status, 'pending_payment'),
          ),
        )
        .returning({
          id: serviceOrders.id,
          workspaceId: serviceOrders.workspaceId,
          propertyId: serviceOrders.propertyId,
          departmentId: serviceOrders.departmentId,
          outletId: serviceOrders.outletId,
          roomId: serviceOrders.roomId,
          taxEntityOrgId: serviceOrders.taxEntityOrgId,
          orderedByUserId: serviceOrders.orderedByUserId,
          customerUserId: serviceOrders.customerUserId,
        });

      if (!order) {
        const [now] = await tx
          .select({
            status: serviceOrders.status,
            paymentMethod: serviceOrders.paymentMethod,
            paidAt: serviceOrders.paidAt,
          })
          .from(serviceOrders)
          .where(eq(serviceOrders.id, input.orderId));
        if (now?.paidAt && now.paymentMethod === input.paymentMethod) {
          const [existing] = await tx
            .select({ id: ebmInvoices.id })
            .from(ebmInvoices)
            .where(eq(ebmInvoices.idempotencyKey, orderEmissionKeyFor(input.orderId)))
            .limit(1);
          return { kind: 'settled', replayed: true, emissionId: existing?.id ?? null, wake: false };
        }
        return { kind: 'not_pending', status: now?.status ?? 'cancelled' };
      }
      const guestUserId = order.orderedByUserId ?? order.customerUserId;

      await tx.insert(serviceOrderEvents).values({
        serviceOrderId: order.id,
        status: 'submitted',
        actorUserId: input.markedByUserId,
        note: input.paymentMethod === '01' ? 'Paid in cash' : 'Paid by mobile money',
      });
      await writeOrderThreadLineTx(tx, order.id, 'submitted');
      await writeOutboxTx(tx, {
        eventType: 'order.status',
        aggregateType: 'service_order',
        aggregateId: order.id,
        change: 'submitted',
        workspaceId: order.workspaceId,
        payload: {
          orderId: order.id,
          status: 'submitted',
          propertyId: order.propertyId,
          departmentId: order.departmentId,
          roomId: order.roomId,
          userId: guestUserId,
        },
      });

      // Null `declare` is the demo environment: nothing is ever declared.
      if (!input.plan.declare) {
        return { kind: 'settled', replayed: false, emissionId: null, wake: false };
      }

      const connected = input.plan.declare.connected;
      const status = connected ? 'held' : 'failed';
      const row = await insertHeldTx(tx, {
        source: 'outlet_order',
        serviceOrderId: order.id,
        outletId: order.outletId,
        orgId: order.taxEntityOrgId,
        tin: input.plan.declare.tin,
        receiptType: 'normal',
        rraBranchId: input.plan.declare.rraBranchId,
        adapterMode: input.plan.declare.adapterMode,
        idempotencyKey: orderEmissionKeyFor(order.id),
        status,
        lastError: connected ? null : NO_CONNECTION,
        // A row with no connection waits for a person, not for a timer.
        dueAt: connected ? paidAt : null,
      });

      if (row.created) {
        const items = await tx
          .select({
            id: serviceOrderItems.id,
            nameSnapshot: serviceOrderItems.nameSnapshot,
            quantity: serviceOrderItems.quantity,
            lineTotalRwf: serviceOrderItems.lineTotalRwf,
            taxCode: serviceOrderItems.taxCode,
            taxRate: serviceOrderItems.taxRate,
            rraItemClsCd: serviceItems.rraItemClsCd,
            rraItemCd: serviceItems.rraItemCd,
            rraPkgUnitCd: serviceItems.rraPkgUnitCd,
            rraQtyUnitCd: serviceItems.rraQtyUnitCd,
          })
          .from(serviceOrderItems)
          .leftJoin(serviceItems, eq(serviceItems.id, serviceOrderItems.serviceItemId))
          .where(eq(serviceOrderItems.serviceOrderId, order.id));

        const lines = items
          .filter((i) => i.taxCode)
          .map((i) => {
            // Tax INCLUSIVE, because the VSDC's `prc` is; the same per line
            // rounding the order priced its tax with, so the receipt adds up.
            const total = i.lineTotalRwf + Math.round(i.lineTotalRwf * Number(i.taxRate ?? 0));
            const quantity = Math.max(i.quantity, 1);
            return {
              ebmInvoiceId: row.id,
              serviceOrderItemId: i.id,
              description: i.nameSnapshot,
              quantity,
              unitPriceRwf: Math.round(total / quantity),
              taxCode: i.taxCode!,
              taxRate: i.taxRate,
              lineTotalRwf: total,
              taxTypeCode: i.taxCode,
              rraItemClsCd: i.rraItemClsCd,
              rraItemCd: i.rraItemCd,
              rraPkgUnitCd: i.rraPkgUnitCd,
              rraQtyUnitCd: i.rraQtyUnitCd,
            };
          });
        if (lines.length > 0) await tx.insert(ebmInvoiceLines).values(lines);

        await writeOutboxTx(tx, {
          eventType: 'ebm.sale',
          aggregateType: 'ebm_invoice',
          aggregateId: row.id,
          change: status,
          workspaceId: order.workspaceId,
          payload: {
            emissionId: row.id,
            orderId: order.id,
            propertyId: order.propertyId,
            userId: guestUserId,
            status,
          },
        });

        // The last statement before commit (AC-9).
        const number = await mintReceiptNumberTx(tx, {
          orgId: order.taxEntityOrgId,
          rraBranchId: input.plan.declare.rraBranchId,
          receiptLabel: 'NS',
        });
        await tx
          .update(ebmInvoices)
          .set({ cisReceiptNo: number })
          .where(eq(ebmInvoices.id, row.id));
      }

      return {
        kind: 'settled',
        replayed: !row.created,
        emissionId: row.id,
        wake: row.created && status === 'held',
      };
    });
  }

  /**
   * A pay now order whose money did not come: refused, or never answered
   * (D-n). `pending_payment -> payment_failed`, and only from there, so a late
   * failure can never undo a settlement that already landed.
   */
  async failPayNow(orderId: string, reason: string): Promise<boolean> {
    return this.moveGuarded(orderId, ['pending_payment'], 'payment_failed', null, reason);
  }

  /**
   * A guest cancelling their own order (catalog child, State transitions).
   *
   * Only before money has moved: a pay now order while it is still waiting for
   * payment or has failed, and a bill order before anyone acknowledged it. A
   * paid order is never cancelled here, because cancelling it is a refund and
   * that is staff only.
   */
  async cancelByGuest(orderId: string, userId: string): Promise<boolean> {
    return this.moveGuarded(
      orderId,
      ['pending_payment', 'payment_failed', 'submitted'],
      'cancelled',
      userId,
      'Cancelled by the guest',
      // A pay now order that reached `submitted` has been paid for.
      eq(serviceOrders.orderContext, 'in_house_folio'),
    );
  }

  /**
   * Move an order from one of `from` to `to` in one transaction with its event
   * and its outbox row. `submitted` in `from` is narrowed by `whenSubmitted`.
   */
  private async moveGuarded(
    orderId: string,
    from: ServiceOrderStatus[],
    to: ServiceOrderStatus,
    actorUserId: string | null,
    note: string,
    whenSubmitted?: SQL,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const others = from.filter((s) => s !== 'submitted');
      const allowed = from.includes('submitted')
        ? or(
            others.length ? inArray(serviceOrders.status, others) : undefined,
            and(eq(serviceOrders.status, 'submitted'), whenSubmitted),
          )
        : inArray(serviceOrders.status, from);

      const [moved] = await tx
        .update(serviceOrders)
        .set({ status: to, updatedAt: new Date() })
        .where(and(eq(serviceOrders.id, orderId), allowed))
        .returning({
          id: serviceOrders.id,
          workspaceId: serviceOrders.workspaceId,
          propertyId: serviceOrders.propertyId,
          departmentId: serviceOrders.departmentId,
          roomId: serviceOrders.roomId,
          orderedByUserId: serviceOrders.orderedByUserId,
          customerUserId: serviceOrders.customerUserId,
        });
      if (!moved) return false;

      await tx
        .insert(serviceOrderEvents)
        .values({ serviceOrderId: moved.id, status: to, actorUserId, note });
      await writeOrderThreadLineTx(tx, moved.id, to);
      await writeOutboxTx(tx, {
        eventType: 'order.status',
        aggregateType: 'service_order',
        aggregateId: moved.id,
        change: to,
        workspaceId: moved.workspaceId,
        payload: {
          orderId: moved.id,
          status: to,
          propertyId: moved.propertyId,
          departmentId: moved.departmentId,
          roomId: moved.roomId,
          userId: moved.orderedByUserId ?? moved.customerUserId,
        },
      });
      return true;
    });
  }

  // --- Query builders ------------------------------------------------------

  /** `RW` unless `config_entries` names another origin (ADR-050 D-m). */
  private async rraOriginTx(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  ): Promise<string> {
    const [row] = await tx
      .select({ value: configEntries.value })
      .from(configEntries)
      .where(eq(configEntries.configType, 'rra_item_origin'))
      .orderBy(desc(configEntries.effectiveFrom), desc(configEntries.version))
      .limit(1);
    const value = row?.value;
    const code =
      typeof value === 'string'
        ? value
        : value && typeof value === 'object' && typeof (value as { code?: unknown }).code === 'string'
          ? (value as { code: string }).code
          : null;
    return code && /^[A-Z]{2}$/.test(code) ? code : DEFAULT_RRA_ORIGIN;
  }

  private selectCategories(where: SQL): Promise<CategoryRow[]> {
    return this.db
      .select({
        id: serviceCategories.id,
        workspaceId: serviceCategories.workspaceId,
        departmentId: serviceCategories.departmentId,
        departmentName: departments.name,
        propertyId: serviceCategories.propertyId,
        outletId: serviceCategories.outletId,
        name: serviceCategories.name,
        sortOrder: serviceCategories.sortOrder,
        guestVisible: serviceCategories.guestVisible,
        status: serviceCategories.status,
        defaultRraItemClsCd: serviceCategories.defaultRraItemClsCd,
        defaultRraItemTyCd: sql<RraItemTypeCode | null>`${serviceCategories.defaultRraItemTyCd}`,
        defaultRraPkgUnitCd: serviceCategories.defaultRraPkgUnitCd,
        defaultRraQtyUnitCd: serviceCategories.defaultRraQtyUnitCd,
        defaultTaxCode: serviceCategories.defaultTaxCode,
      })
      .from(serviceCategories)
      .leftJoin(departments, eq(departments.id, serviceCategories.departmentId))
      .where(where)
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  }

  private selectItems(where: SQL): Promise<ItemRow[]> {
    return this.db
      .select({
        id: serviceItems.id,
        workspaceId: serviceItems.workspaceId,
        serviceCategoryId: serviceItems.serviceCategoryId,
        departmentId: serviceItems.departmentId,
        propertyId: serviceItems.propertyId,
        outletId: sql<string | null>`coalesce(${serviceItems.outletId}, ${serviceCategories.outletId})`,
        name: serviceItems.name,
        description: serviceItems.description,
        priceRwf: serviceItems.priceRwf,
        taxCode: serviceItems.taxCode,
        fulfillmentType: serviceItems.fulfillmentType,
        prepTimeMinutes: serviceItems.prepTimeMinutes,
        guestOrderable: serviceItems.guestOrderable,
        stockQty: serviceItems.stockQty,
        status: serviceItems.status,
        options: serviceItems.options,
        rraItemClsCd: serviceItems.rraItemClsCd,
        rraItemClsName: rraItemClassifications.name,
        rraItemTyCd: sql<RraItemTypeCode | null>`${serviceItems.rraItemTyCd}`,
        rraItemCd: serviceItems.rraItemCd,
        rraPkgUnitCd: serviceItems.rraPkgUnitCd,
        rraQtyUnitCd: serviceItems.rraQtyUnitCd,
      })
      .from(serviceItems)
      .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
      .leftJoin(
        rraItemClassifications,
        eq(rraItemClassifications.code, serviceItems.rraItemClsCd),
      )
      .where(where)
      .orderBy(asc(serviceItems.name));
  }

  private selectOrders(where: SQL): Promise<OrderRow[]> {
    return this.db
      .select({
        id: serviceOrders.id,
        workspaceId: serviceOrders.workspaceId,
        propertyId: serviceOrders.propertyId,
        branchPropertyId: ORDER_BRANCH,
        outletId: serviceOrders.outletId,
        orderedByUserId: serviceOrders.orderedByUserId,
        customerUserId: serviceOrders.customerUserId,
        orderNumber: serviceOrders.orderNumber,
        departmentId: serviceOrders.departmentId,
        departmentName: departments.name,
        folioId: serviceOrders.folioId,
        guestStayId: serviceOrders.guestStayId,
        roomId: serviceOrders.roomId,
        roomLabel: rooms.label,
        channel: serviceOrders.channel,
        status: serviceOrders.status,
        orderContext: serviceOrders.orderContext,
        taxEntityOrgId: serviceOrders.taxEntityOrgId,
        paymentAttemptId: serviceOrders.paymentAttemptId,
        paidAt: serviceOrders.paidAt,
        paymentMethod: serviceOrders.paymentMethod,
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
      .leftJoin(outlets, eq(outlets.id, serviceOrders.outletId))
      .where(where)
      .orderBy(desc(serviceOrders.createdAt));
  }
}
