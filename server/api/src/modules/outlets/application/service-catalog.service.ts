import type {
  AdvanceServiceOrderRequest,
  CreateServiceCategoryRequest,
  CreateServiceOrderRequest,
  MarkOrderPaidCashRequest,
  MarkOrderPaidCashResult,
  OperatorServiceCatalog,
  OperatorServiceItem,
  OperatorServiceOrder,
  RraClassificationList,
  ServiceOrderStatus,
  UpdateServiceCategoryRequest,
  UpdateServiceItemRequest,
  UpsertServiceItemRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import {
  isSellable,
  missingRra,
  priceLine,
  readOptions,
  snapshotsOf,
  unclassifiedSentence,
} from '../domain/sellable-item';
import { itemPhoto, NEW_UPLOAD, photoColumn, uploadColumn } from '../domain/menu-photo';
import {
  accountCodeFor,
  type ChargeDraft,
  FolioPort,
} from '../../pms/application/folio-port';
import {
  type ItemRow,
  type OrderItemRow,
  type OrderLineDraft,
  type OrderRow,
  ServiceCatalogRepository,
} from '../infrastructure/service-catalog.repository';
import { OrderPaymentService } from './order-payment.service';

/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered ->
 * completed`, plus `submitted -> rejected`, and anything before `delivered` to
 * `cancelled` (§14.7).
 *
 * A pay now order waiting for its money may only be cancelled from the board.
 * It reaches `submitted` by being PAID, through the cash mark or a settled
 * mobile money prompt, and never by a status move somebody typed.
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
  pending_payment: ['cancelled'],
  payment_failed: ['cancelled'],
};

/** Reaching either of these puts the order on the bill. */
const FULFILLED = new Set<ServiceOrderStatus>(['delivered', 'completed']);

/**
 * The menu and the orders placed against it (ADR-016 slice 7, ADR-050 slice 3).
 *
 * Three things here are worth reading twice:
 *
 * 1. **An order snapshots its prices** (D8, AC-23). The name, the unit price,
 *    the chosen modifiers and the tax code are copied onto the order line at
 *    the moment it is placed, so editing the menu never rewrites a bill.
 * 2. **Fulfilment posts the folio charge in the same transaction** as the
 *    status move (§14.7). Splitting them is how a delivered order ends up with
 *    nothing on the bill, and nobody notices until the guest checks out.
 * 3. **Nothing sells without its RRA codes, on any channel** (ADR-050 D-m,
 *    amended). Refused when an item is turned orderable, and again when any
 *    order names it, because an item on sale before the codes existed is still
 *    flagged orderable and must not reach a receipt the Authority refuses.
 */
@Injectable()
export class ServiceCatalogService {
  constructor(
    private readonly catalog: ServiceCatalogRepository,
    private readonly folios: FolioPort,
    private readonly payments: OrderPaymentService,
  ) {}

  /** The whole menu, grouped, which is the only way anyone reads it. */
  async menu(ws: ScopedWorkspace): Promise<OperatorServiceCatalog> {
    const categories = await this.catalog.listCategories(ws.workspaceId, ws.branchScope);
    const items = await this.catalog.listItems(categories.map((c) => c.id));
    return {
      categories: categories.map((c) => ({
        id: c.id,
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        outletId: c.outletId,
        name: c.name,
        sortOrder: c.sortOrder,
        guestVisible: c.guestVisible,
        status: c.status,
        defaultRraItemClsCd: c.defaultRraItemClsCd,
        defaultRraItemTyCd: c.defaultRraItemTyCd,
        defaultRraPkgUnitCd: c.defaultRraPkgUnitCd,
        defaultRraQtyUnitCd: c.defaultRraQtyUnitCd,
        defaultTaxCode: c.defaultTaxCode,
        items: items
          .filter((i) => i.serviceCategoryId === c.id)
          .map((i) => this.presentItem(i)),
      })),
    };
  }

  /** The menu's classification picker (ADR-050 D-m). */
  async classifications(q: string): Promise<RraClassificationList> {
    return { classifications: await this.catalog.searchClassifications(q) };
  }

  async createCategory(
    ws: ScopedWorkspace,
    body: CreateServiceCategoryRequest,
  ): Promise<OperatorServiceCatalog> {
    // A menu is made on a branch in scope, or not at all (ADR-054 AC-T2).
    assertInBranchScope(ws, body.propertyId);
    const department = assertOwned(
      await this.folios.findDepartment(body.departmentId),
      ws,
    );
    if (!department.isRevenueCenter) {
      throw new UnprocessableEntityException(
        'A menu belongs to a revenue centre. That department is a cost centre.',
      );
    }
    if (department.propertyId && department.propertyId !== body.propertyId) {
      throw new UnprocessableEntityException('That department belongs to a different property.');
    }
    const outletId = await this.resolveOutlet(ws, body.outletId, body.propertyId);
    await this.assertClassification(body.defaultRraItemClsCd);

    const id = await this.catalog.createCategory({
      workspaceId: ws.workspaceId,
      propertyId: body.propertyId,
      departmentId: body.departmentId,
      outletId,
      name: body.name,
      guestVisible: body.guestVisible ?? true,
      sortOrder: body.sortOrder ?? 500,
      defaultRraItemClsCd: body.defaultRraItemClsCd ?? null,
      defaultRraItemTyCd: body.defaultRraItemTyCd ?? null,
      defaultRraPkgUnitCd: body.defaultRraPkgUnitCd ?? null,
      defaultRraQtyUnitCd: body.defaultRraQtyUnitCd ?? null,
      defaultTaxCode: body.defaultTaxCode ?? null,
    });
    if (!id) throw this.vanished();
    return this.menu(ws);
  }

  async updateCategory(
    ws: ScopedWorkspace,
    id: string,
    patch: UpdateServiceCategoryRequest,
  ): Promise<OperatorServiceCatalog> {
    const category = assertOwned(await this.catalog.findCategory(id), ws);
    assertInBranchScope(ws, category.propertyId);
    const outletId =
      patch.outletId === undefined
        ? undefined
        : await this.resolveOutlet(ws, patch.outletId, category.propertyId);
    await this.assertClassification(patch.defaultRraItemClsCd);
    await this.catalog.updateCategory(category.id, { ...patch, outletId });
    return this.menu(ws);
  }

  /**
   * Add an item (ADR-050 D-m).
   *
   * The RRA values it leaves out are prefilled from its category. Turning it
   * orderable without every one is refused; left unsaid, it is orderable
   * exactly when it can be sold. Its `itemCd` is minted as soon as it holds a
   * product type and both units.
   */
  async createItem(
    ws: ScopedWorkspace,
    body: UpsertServiceItemRequest,
    actorUserId?: string,
  ): Promise<OperatorServiceCatalog> {
    const category = assertOwned(
      await this.catalog.findCategory(body.serviceCategoryId),
      ws,
    );
    assertInBranchScope(ws, category.propertyId);
    const department = assertOwned(
      await this.folios.findDepartment(category.departmentId),
      ws,
    );
    if (!department.propertyId) {
      throw new UnprocessableEntityException(
        'That menu sits on a corporate department, which has no property to sell from.',
      );
    }

    const codes = {
      rraItemClsCd: body.rraItemClsCd ?? category.defaultRraItemClsCd,
      rraItemTyCd: body.rraItemTyCd ?? category.defaultRraItemTyCd,
      rraPkgUnitCd: body.rraPkgUnitCd ?? category.defaultRraPkgUnitCd,
      rraQtyUnitCd: body.rraQtyUnitCd ?? category.defaultRraQtyUnitCd,
    };
    await this.assertClassification(codes.rraItemClsCd ?? undefined);
    // The code is minted after insert, so "could be sold" counts it as coming.
    const couldSell = isSellable({ ...codes, rraItemCd: mintable(codes) ? 'pending' : null });
    if (body.guestOrderable === true && !couldSell) {
      throw this.notSellable(body.name, { ...codes, rraItemCd: null });
    }

    const id = await this.catalog.createItem({
      workspaceId: ws.workspaceId,
      serviceCategoryId: category.id,
      departmentId: category.departmentId,
      propertyId: department.propertyId,
      name: body.name,
      description: body.description ?? null,
      priceRwf: body.priceRwf,
      taxCode: body.taxCode ?? category.defaultTaxCode ?? 'TAX_B',
      fulfillmentType: body.fulfillmentType ?? 'in_room_delivery',
      prepTimeMinutes: body.prepTimeMinutes ?? null,
      guestOrderable: body.guestOrderable ?? couldSell,
      stockQty: body.stockQty ?? null,
      status: body.status ?? 'active',
      options: body.options ?? [],
      ...codes,
      photoObjectKeys: (await this.photoWrite(ws, body.photo ?? null, null)).photoObjectKeys ?? null,
    }, actorUserId
      ? { workspaceId: ws.workspaceId, outletId: category.outletId, actorUserId, itemName: body.name, kind: 'opening' }
      : undefined);
    if (!id) throw this.vanished();
    await this.catalog.mintItemCode(id);
    return this.menu(ws);
  }

  /**
   * Change an item. Refused with 422 when the change would leave it orderable
   * without its RRA values, which covers turning it on and nothing else: an
   * item already on sale without them stays flagged, and is refused where it
   * is ordered instead.
   */
  async updateItem(
    ws: ScopedWorkspace,
    id: string,
    patch: UpdateServiceItemRequest,
    actorUserId?: string,
  ): Promise<OperatorServiceCatalog> {
    const item = assertOwned(await this.catalog.findItem(id), ws);
    assertInBranchScope(ws, item.propertyId);
    await this.assertClassification(patch.rraItemClsCd);

    const next = {
      rraItemClsCd: patch.rraItemClsCd ?? item.rraItemClsCd,
      rraItemTyCd: patch.rraItemTyCd ?? item.rraItemTyCd,
      rraPkgUnitCd: patch.rraPkgUnitCd ?? item.rraPkgUnitCd,
      rraQtyUnitCd: patch.rraQtyUnitCd ?? item.rraQtyUnitCd,
      rraItemCd: item.rraItemCd,
    };
    const couldSell = isSellable({
      ...next,
      rraItemCd: next.rraItemCd ?? (mintable(next) ? 'pending' : null),
    });
    if (patch.guestOrderable === true && !couldSell) {
      throw this.notSellable(patch.name ?? item.name, next);
    }

    // Stock moved here is recorded with who moved it, like every change made on the Stock screen. Whether it really
    // moved is decided inside the write, under a lock, against the quantity as it is at that moment.
    // The photo is a library name or an upload on the wire and a column of keys in the table (domain/menu-photo).
    const { photo, ...fields } = patch;
    const photoPatch = photo !== undefined ? await this.photoWrite(ws, photo, item) : {};
    await this.catalog.updateItem(
      item.id,
      { ...fields, ...photoPatch },
      actorUserId !== undefined && patch.stockQty !== undefined
        ? { workspaceId: ws.workspaceId, outletId: item.outletId, actorUserId, itemName: item.name, kind: 'catalogue_edit' }
        : undefined,
    );
    await this.catalog.mintItemCode(item.id);
    return this.menu(ws);
  }

  // --- Orders --------------------------------------------------------------

  async listOrders(ws: ScopedWorkspace): Promise<OperatorServiceOrder[]> {
    const orders = await this.catalog.listOrders(ws.workspaceId, ws.branchScope);
    const lines = await this.catalog.listOrderItems(orders.map((o) => o.id));
    return orders.map((o) => this.presentOrder(o, lines));
  }

  /**
   * Place an order on a guest's behalf.
   *
   * The DEPARTMENT is not asked for: it comes from the items, because an item
   * carries its own department and a caller who could choose would eventually
   * route a club sandwich to Engineering. Every item on one order has to belong
   * to the same department, and a pay now order to the same outlet as well,
   * because an outlet is whose TIN signs it.
   */
  async createOrder(
    ws: ScopedWorkspace,
    body: CreateServiceOrderRequest,
    clientKey: string | null,
  ): Promise<OperatorServiceOrder> {
    const key = clientKey ? `${ws.workspaceId}:${clientKey}` : null;
    if (key) {
      const replay = await this.catalog.findOrderByIdempotencyKey(key);
      if (replay) {
        assertInBranchScope(ws, replay.branchPropertyId);
        const lines = await this.catalog.listOrderItems([replay.id]);
        return this.presentOrder(replay, lines);
      }
    }

    const stay =
      body.context === 'in_house_folio' && body.guestStayId
        ? assertOwned(await this.catalog.folioForStay(body.guestStayId), ws)
        : null;
    if (stay) assertInBranchScope(ws, stay.propertyId);

    const rates = await this.folios.effectiveTaxRates(new Date());
    if (!rates) {
      throw new UnprocessableEntityException(
        'No tax rates are effective right now, so nothing can be priced. Set them in config first.',
      );
    }

    const lines: OrderLineDraft[] = [];
    let first: ItemRow | null = null;
    let subtotalRwf = 0;
    let taxRwf = 0;

    for (const requested of body.items) {
      const item = assertOwned(
        await this.catalog.findItem(requested.serviceItemId),
        ws,
      );
      assertInBranchScope(ws, item.propertyId);
      if (item.status !== 'active') {
        throw new ConflictException(`${item.name} is not available right now.`);
      }
      if (!isSellable(item)) {
        throw new UnprocessableEntityException(unclassifiedSentence(item.name));
      }
      first ??= item;
      if (first.departmentId !== item.departmentId) {
        throw new UnprocessableEntityException(
          'Everything on one order has to come from the same department. Split it.',
        );
      }
      // One order, one taxpayer (contract 1), so one outlet.
      if (first.outletId !== item.outletId) {
        throw new UnprocessableEntityException(
          'Everything on one order has to come from the same outlet. Split it.',
        );
      }

      const rate = rates[item.taxCode];
      if (typeof rate !== 'number') {
        throw new UnprocessableEntityException(
          `The effective tax rates do not cover ${item.taxCode}.`,
        );
      }
      const priced = priceLine(item, requested.quantity, requested.selectedOptions);
      if (!priced.ok) throw new UnprocessableEntityException(priced.problem);
      subtotalRwf += priced.lineTotalRwf;
      taxRwf += Math.round(priced.lineTotalRwf * rate);

      lines.push({
        serviceItemId: item.id,
        // Locked at order time. The menu may change tomorrow; this bill may not.
        nameSnapshot: item.name,
        quantity: requested.quantity,
        unitPriceRwf: priced.unitPriceRwf,
        lineTotalRwf: priced.lineTotalRwf,
        taxCode: item.taxCode,
        taxRate: String(rate),
        selectedOptions: priced.selectedOptions,
        note: requested.note ?? null,
      });
    }
    if (!first) {
      throw new UnprocessableEntityException('An order needs at least one item.');
    }

    const propertyId = stay?.propertyId ?? first.propertyId;
    // The outlet the items sell from, which is whose TIN signs the order.
    const outletId = first.outletId;
    const taxEntityOrgId = await this.catalog.taxEntityFor({ outletId, propertyId });
    if (!taxEntityOrgId) throw this.vanished();

    const id = await this.catalog.createOrder({
      workspaceId: ws.workspaceId,
      propertyId,
      departmentId: first.departmentId,
      orderContext: body.context,
      folioId: stay?.folioId ?? null,
      guestStayId: stay ? body.guestStayId! : null,
      roomId: stay?.roomId ?? null,
      taxEntityOrgId,
      outletId,
      channel: body.channel ?? 'front_desk',
      fulfillmentType: first.fulfillmentType,
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
   * sandwich. A pay now order has no bill and posts nothing.
   */
  async advanceOrder(
    ws: ScopedWorkspace,
    id: string,
    body: AdvanceServiceOrderRequest,
    actorUserId: string,
  ): Promise<OperatorServiceOrder> {
    const order = assertOwned(await this.catalog.findOrder(id), ws);
    assertInBranchScope(ws, order.branchPropertyId);
    if (order.status === body.to) {
      return this.presentOrder(order, await this.catalog.listOrderItems([id]));
    }
    if (order.status === 'pending_payment' && body.to !== 'cancelled') {
      throw new ConflictException(
        'This order has not been paid for yet. Mark it paid in cash, or wait for the mobile money payment.',
      );
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

    if (FULFILLED.has(body.to) && order.orderContext === 'in_house_folio' && order.folioId) {
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
   * Mark a pay now order paid in CASH (ADR-050 D-p, AC-24).
   *
   * The amount must be exactly the order's total: the person holding the cash
   * confirms the number they took, and a mismatch is refused rather than
   * recorded. Records who took it and RRA means of payment `01`, moves the order
   * to the board and raises its `NS`, all in one transaction.
   *
   * A repeat of a cash mark that already landed answers with the first,
   * whatever key it carries, because both describe the one payment: the replay
   * is decided by the order's own state and the `NS` key, so the route requires
   * an `Idempotency-Key` like every command here that moves money and this
   * method needs nothing from it.
   */
  async markPaidCash(
    ws: ScopedWorkspace,
    id: string,
    body: MarkOrderPaidCashRequest,
    actorUserId: string,
  ): Promise<MarkOrderPaidCashResult> {
    const order = assertOwned(await this.catalog.findOrder(id), ws);
    assertInBranchScope(ws, order.branchPropertyId);
    if (order.orderContext !== 'pay_now') {
      throw new ConflictException('This order is charged to a room. Take the payment on the bill.');
    }
    if (body.amountRwf !== order.totalRwf) {
      throw new UnprocessableEntityException(
        `This order comes to ${order.totalRwf.toLocaleString('en-RW')} RWF, not ${body.amountRwf.toLocaleString('en-RW')} RWF. Take exactly the total.`,
      );
    }

    const outcome = await this.payments.settle(order.id, {
      method: '01',
      markedByUserId: actorUserId,
      paymentAttemptId: null,
    });
    if (outcome.kind === 'not_pending') {
      throw new ConflictException(
        `This order is ${outcome.status.replace('_', ' ')}, so it cannot be marked paid.`,
      );
    }

    const updated = await this.catalog.findOrder(id);
    if (!updated) throw this.vanished();
    return {
      ...this.presentOrder(updated, await this.catalog.listOrderItems([id])),
      emissionId: outcome.emissionId,
    };
  }

  /**
   * The bill lines a fulfilled order owes: the goods, then the tax.
   *
   * Two lines, not one with tax folded in (D-n). `amount_rwf` is tax exclusive
   * everywhere on a folio, so an invoice never has to pull the two apart again.
   */
  private async buildOrderCharge(
    ws: ScopedWorkspace,
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
        // The outlet is THE answer to whose TIN this line belongs to (ADR-050,
        // contract 1); the charge resolver reads its tax entity from here, and
        // the order's own copy of it names the same org.
        outletId: order.outletId,
        taxEntityOrgId: order.taxEntityOrgId,
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
        // Its `source_ref_id` names the ORDER, not a charge, so the resolver
        // could not inherit through it; the order carries the taxpayer instead.
        outletId: order.outletId,
        taxEntityOrgId: order.taxEntityOrgId,
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

  /** An outlet this workspace holds, at this property, or a 422 naming why not. */
  private async resolveOutlet(
    ws: ScopedWorkspace,
    outletId: string | null | undefined,
    propertyId: string,
  ): Promise<string | null> {
    if (!outletId) return null;
    const outlet = assertOwned(await this.catalog.findOutlet(outletId), ws);
    if (outlet.propertyId !== propertyId) {
      throw new UnprocessableEntityException('That outlet belongs to a different property.');
    }
    return outlet.id;
  }

  /** A classification code must be on RRA's list and still in use. */
  private async assertClassification(code: string | null | undefined): Promise<void> {
    if (!code) return;
    if (!(await this.catalog.classificationIsActive(code))) {
      throw new UnprocessableEntityException(
        `${code} is not an active code on RRA's classification list. Pick one from the list.`,
      );
    }
  }

  private notSellable(
    name: string,
    codes: Parameters<typeof missingRra>[0],
  ): UnprocessableEntityException {
    const missing = missingRra(codes).filter((f) => f !== 'itemCode');
    const words: Record<string, string> = {
      classification: 'a classification',
      productType: 'a product type',
      packagingUnit: 'a packaging unit',
      quantityUnit: 'a quantity unit',
    };
    return new UnprocessableEntityException(
      `${name} cannot be put on sale without ${missing.map((f) => words[f]).join(', ')}. A receipt the Authority accepts needs every one.`,
    );
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
      options: readOptions(row.options),
      rraItemClsCd: row.rraItemClsCd,
      rraItemClsName: row.rraItemClsName,
      rraItemTyCd: row.rraItemTyCd,
      rraItemCd: row.rraItemCd,
      rraPkgUnitCd: row.rraPkgUnitCd,
      rraQtyUnitCd: row.rraQtyUnitCd,
      missingRra: missingRra(row),
      photo: itemPhoto(row.id, row.photoObjectKeys),
    };
  }

  /**
   * The photo column a write leaves (domain/menu-photo). Null clears it; a library name is kept as is; a new upload
   * (`upload:<storedObjectId>`) is kept by its storage key, only when that file was uploaded as a photo in this
   * workspace; the item's own current upload changes nothing. Anything else is refused with 422.
   */
  private async photoWrite(
    ws: ScopedWorkspace,
    photo: string | null,
    item: Pick<ItemRow, 'id' | 'photoObjectKeys'> | null,
  ): Promise<{ photoObjectKeys?: string[] | null }> {
    if (photo === null) return { photoObjectKeys: null };
    if (item && itemPhoto(item.id, item.photoObjectKeys) === photo) return {};
    const upload = NEW_UPLOAD.exec(photo);
    if (upload?.[1]) {
      const stored = await this.catalog.findStoredObject(upload[1]);
      const column = stored ? uploadColumn(stored.objectKey) : null;
      if (!stored || stored.workspaceId !== ws.workspaceId || stored.kind !== 'property_photo' || !column) {
        throw new UnprocessableEntityException('That photo was not found. Upload it again.');
      }
      return { photoObjectKeys: column };
    }
    const column = photoColumn(photo);
    if (!column) throw new UnprocessableEntityException('That photo is not in the photo library.');
    return { photoObjectKeys: column };
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
      outletId: row.outletId,
      folioId: row.folioId,
      roomId: row.roomId,
      roomLabel: row.roomLabel,
      channel: row.channel,
      status: row.status,
      orderContext: row.orderContext,
      fulfillmentType: row.fulfillmentType,
      subtotalRwf: row.subtotalRwf,
      taxRwf: row.taxRwf,
      totalRwf: row.totalRwf,
      paidAt: row.paidAt?.toISOString() ?? null,
      paymentMethod: row.paymentMethod,
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
          selectedOptions: snapshotsOf(l.selectedOptions),
        })),
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}

/** Whether an item's code can be minted: it holds a product type and both units. */
function mintable(codes: { rraItemTyCd: string | null; rraPkgUnitCd: string | null; rraQtyUnitCd: string | null }): boolean {
  return Boolean(codes.rraItemTyCd && codes.rraPkgUnitCd && codes.rraQtyUnitCd);
}
