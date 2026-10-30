import {
  PROPERTY_TIME_ZONE,
  instrumentProblem,
  type GuestOrder,
  type GuestOrderDetail,
  type GuestOrderList,
  type OrderableCategory,
  type OrderableList,
  type OrderableOutlet,
  type OrderableQuery,
  type PlaceOrderRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { isOutletOpen } from '../domain/outlet-hours';
import {
  isSellable,
  priceLine,
  readOptions,
  snapshotsOf,
  unclassifiedSentence,
} from '../domain/sellable-item';
import { PaymentSeam } from '../../pay/domain/payment-seam';
import { FolioPort } from '../../pms/application/folio-port';
import { MessagingService } from '../../operations/application/messaging.service';
import {
  GuestOrderingRepository,
  type InHouseStay,
  type MenuItemRow,
  type OutletRow,
} from '../infrastructure/guest-ordering.repository';
import {
  type OrderItemRow,
  type OrderLineDraft,
  type OrderRow,
  ServiceCatalogRepository,
} from '../infrastructure/service-catalog.repository';

/** What placing an order hands the route, which may still have money to ask for. */
export interface PlacedOrder {
  order: GuestOrder;
  /** The workspace that owns the order, whose provider account a capture runs on. */
  workspaceId: string;
  /** A pay now order still waiting for its money. */
  awaitingPayment: boolean;
}

/**
 * ONE PLACE FOR A GUEST TO ORDER ANYTHING (ADR-050 D-n, D-o; AC-19, AC-21 to
 * AC-23).
 *
 * The listing and the order resolve the same inputs on the server: the caller's
 * open stays, where they are when they say, each outlet's `ordering_access`,
 * its hours against the property's clock, and each item's status, stock and RRA
 * codes. The policy is enforced AGAIN when an order is placed, before anything
 * is written, because a button the client hid is not a control.
 *
 * An in house guest charges to their room and nothing here takes money: the
 * order posts to the bill when it is delivered. A walk in pays now, and this
 * service writes the order `pending_payment`; asking for the money is the
 * payment attempt service's job, and settling it is `OrderPaymentService`'s.
 */
@Injectable()
export class GuestOrderingService {
  constructor(
    private readonly guests: GuestOrderingRepository,
    private readonly catalog: ServiceCatalogRepository,
    private readonly folios: FolioPort,
    private readonly messaging: MessagingService,
    private readonly seam: PaymentSeam,
  ) {}

  protected now(): Date {
    return new Date();
  }

  /**
   * Every outlet this caller may order from right now, with its live menu
   * (AC-22, D-o).
   *
   * In house outlets at every property the caller is staying at, the property
   * they name, and, when they give coordinates, every walk in outlet within
   * 5 km. One list; in house first, then nearest first.
   */
  async orderable(userId: string, query: OrderableQuery): Promise<OrderableList> {
    const stays = await this.guests.inHouseStays(userId);
    const propertyIds = [
      ...new Set([...stays.map((s) => s.propertyId), ...(query.propertyId ? [query.propertyId] : [])]),
    ];
    const near =
      query.lat !== undefined && query.lng !== undefined
        ? await this.guests.walkInOutletsNear(query.lat, query.lng)
        : [];

    const byId = new Map<string, OutletRow>();
    for (const outlet of [...(await this.guests.outletsAt(propertyIds)), ...near]) {
      const seen = byId.get(outlet.id);
      byId.set(outlet.id, seen && seen.distanceKm !== null ? seen : outlet);
    }

    const now = this.now();
    const open = [...byId.values()].filter((o) => isOutletOpen(o.hours, now, PROPERTY_TIME_ZONE));
    const menu = await this.guests.menuFor(open.map((o) => o.id));

    const listed: OrderableOutlet[] = [];
    for (const outlet of open) {
      const chargeToRoom =
        outlet.orderingAccess !== 'walk_in_only' && Boolean(this.stayFor(stays, outlet)?.folioId);
      const payNow = outlet.orderingAccess !== 'in_house_only';
      const categories = this.categoriesOf(menu.filter((m) => m.outletId === outlet.id));
      if ((!chargeToRoom && !payNow) || categories.length === 0) continue;
      listed.push({
        id: outlet.id,
        name: outlet.name,
        outletKind: outlet.outletKind,
        propertyId: outlet.propertyId,
        propertyName: outlet.propertyName,
        orderingAccess: outlet.orderingAccess,
        hours: (outlet.hours ?? null) as OrderableOutlet['hours'],
        chargeToRoom,
        payNow,
        distanceKm: outlet.distanceKm,
        // Slice 4 sets this from `outlet_parties` for a tenant outlet.
        operatorLabel: null,
        categories,
      });
    }

    const inHouse = new Set(stays.map((s) => s.propertyId));
    listed.sort(
      (a, b) =>
        Number(inHouse.has(b.propertyId)) - Number(inHouse.has(a.propertyId)) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
    return { outlets: listed };
  }

  /**
   * Place an order (AC-19, AC-20, AC-21, AC-23).
   *
   * The refusals run in the order a guest can act on them, and every one runs
   * before anything is written. A replay of the same key by the same person
   * answers with the first order; the same key from somebody else is refused,
   * because answering it would show one guest another guest's order.
   */
  async place(
    userId: string,
    body: PlaceOrderRequest,
    clientKey: string,
  ): Promise<PlacedOrder> {
    const outlet = await this.guests.findOutlet(body.outletId);
    if (!outlet || outlet.status !== 'active') {
      throw new NotFoundException('That outlet is not taking orders.');
    }

    // Scoped by the workspace that owns the row, as every key in this layer
    // is, and by the person, because two guests may pick the same UUID.
    const key = `${outlet.workspaceId}:guest:${userId}:${clientKey}`;
    const replay = await this.catalog.findOrderByIdempotencyKey(key);
    if (replay) {
      if (replay.orderedByUserId !== userId) {
        throw new ConflictException(
          'That Idempotency-Key was already used. Generate a new one.',
        );
      }
      return {
        order: this.present(replay, await this.catalog.listOrderItems([replay.id]), outlet),
        workspaceId: replay.workspaceId,
        awaitingPayment: replay.status === 'pending_payment',
      };
    }

    const stay = this.stayFor(await this.guests.inHouseStays(userId), outlet);
    this.assertPolicy(outlet, stay, body);
    // Ordering from inside a conversation (ADR-050 D-s): the thread must be the
    // caller's own, still open, and at this outlet's property.
    if (body.threadId) {
      await this.messaging.assertOrderableThread(userId, body.threadId, outlet.propertyId);
    }
    if (!isOutletOpen(outlet.hours, this.now(), PROPERTY_TIME_ZONE)) {
      throw new ConflictException(`${outlet.name} is closed right now.`);
    }

    const rates = await this.folios.effectiveTaxRates(this.now());
    if (!rates) {
      throw new UnprocessableEntityException(
        'Orders cannot be priced right now. Please ask at the counter.',
      );
    }

    const menu = new Map(
      (await this.guests.menuFor([outlet.id])).map((item) => [item.id, item]),
    );
    const lines: OrderLineDraft[] = [];
    let departmentId: string | null = null;
    let fulfillmentType: MenuItemRow['fulfillmentType'] = 'in_room_delivery';
    let subtotalRwf = 0;
    let taxRwf = 0;

    for (const requested of body.items) {
      const item = menu.get(requested.serviceItemId);
      if (!item) {
        // Say WHY when the reason is the codes (422), because that one is the
        // host's to fix and a guest reading "not available" would just retry.
        const known = await this.catalog.findItem(requested.serviceItemId);
        if (known && known.outletId === outlet.id && known.status === 'active' && !isSellable(known)) {
          throw new UnprocessableEntityException(unclassifiedSentence(known.name));
        }
        throw new ConflictException(
          `One of the things you picked is not available from ${outlet.name} right now.`,
        );
      }
      if (item.stockQty !== null && item.stockQty < requested.quantity) {
        throw new ConflictException(`${item.name} has sold out.`);
      }
      departmentId ??= item.departmentId;
      if (departmentId !== item.departmentId) {
        throw new UnprocessableEntityException(
          'Everything on one order has to come from the same place. Split it into two orders.',
        );
      }
      fulfillmentType = item.fulfillmentType;
      const rate = rates[item.taxCode];
      if (typeof rate !== 'number') {
        throw new UnprocessableEntityException(
          'Orders cannot be priced right now. Please ask at the counter.',
        );
      }
      // Snapshotted now: editing or archiving the item never changes this order.
      const priced = priceLine(item, requested.quantity, requested.selectedOptions);
      if (!priced.ok) throw new UnprocessableEntityException(priced.problem);
      subtotalRwf += priced.lineTotalRwf;
      taxRwf += Math.round(priced.lineTotalRwf * rate);
      lines.push({
        serviceItemId: item.id,
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
    if (!departmentId) {
      throw new UnprocessableEntityException('Pick at least one thing.');
    }
    // Paying now: the bank's rules, refused before the order or its prompt
    // exists (073-gtbank-payments AC-23, AC-24).
    if (body.instrument) {
      const ruleFault = this.seam.ruleProblem(subtotalRwf + taxRwf, body.instrument);
      if (ruleFault) throw new UnprocessableEntityException(ruleFault);
    }

    const inHouse = body.context === 'in_house_folio';
    const id = await this.catalog.createOrder({
      workspaceId: outlet.workspaceId,
      propertyId: outlet.propertyId,
      departmentId,
      orderContext: body.context,
      folioId: inHouse ? stay!.folioId : null,
      guestStayId: inHouse ? stay!.guestStayId : null,
      roomId: inHouse ? stay!.roomId : null,
      // The outlet's, copied at write time and never derived again (contract 1).
      taxEntityOrgId: outlet.taxEntityOrgId,
      channel: 'guest_app',
      fulfillmentType,
      guestNote: body.guestNote ?? null,
      idempotencyKey: key,
      outletId: outlet.id,
      orderedByUserId: userId,
      customerUserId: inHouse ? null : userId,
      requestedForAt: body.requestedForAt ? new Date(body.requestedForAt) : null,
      threadId: body.threadId ?? null,
      subtotalRwf,
      taxRwf,
      lines,
    });
    const created = id ? await this.catalog.findOrder(id) : null;
    if (!created) throw new Error('The order was written and could not be read back.');
    return {
      order: this.present(created, await this.catalog.listOrderItems([created.id]), outlet),
      workspaceId: created.workspaceId,
      awaitingPayment: created.status === 'pending_payment',
    };
  }

  /** The caller's own orders, newest first. */
  async list(userId: string): Promise<GuestOrderList> {
    const orders = await this.catalog.listOrdersForGuest(userId);
    const [items, outlets] = await Promise.all([
      this.catalog.listOrderItems(orders.map((o) => o.id)),
      this.guests.outletsByIds([...new Set(orders.map((o) => o.outletId).filter((x): x is string => Boolean(x)))]),
    ]);
    const byId = new Map(outlets.map((o) => [o.id, o]));
    return {
      orders: orders
        .filter((o) => o.outletId && byId.has(o.outletId))
        .map((o) => this.present(o, items, byId.get(o.outletId!)!)),
    };
  }

  /**
   * One of the caller's own orders, with its trail. A 404, never a 403, for
   * an order that is somebody else's, so a guessed id says nothing.
   */
  async detail(userId: string, orderId: string): Promise<GuestOrderDetail> {
    const order = await this.ownOrder(userId, orderId);
    const outlet = order.outletId ? await this.guests.findOutlet(order.outletId) : null;
    if (!outlet) throw new NotFoundException('No such order.');
    const [items, events] = await Promise.all([
      this.catalog.listOrderItems([order.id]),
      this.catalog.listOrderEvents(order.id),
    ]);
    return {
      ...this.present(order, items, outlet),
      events: events.map((e) => ({ status: e.status, occurredAt: e.occurredAt.toISOString() })),
    };
  }

  /**
   * Cancel one of the caller's own orders (catalog child, State transitions).
   *
   * Before money moves only. A paid order is refused with a sentence that sends
   * the guest to the outlet, because cancelling it is a refund, which needs
   * `ebm.refund` and three fields a guest has no way to give.
   */
  async cancel(userId: string, orderId: string): Promise<GuestOrderDetail> {
    const order = await this.ownOrder(userId, orderId);
    if (order.status === 'cancelled') return this.detail(userId, orderId);
    if (order.paidAt) {
      throw new ConflictException(
        'This order has been paid for, so it can only be cancelled by the outlet. Please ask them.',
      );
    }
    if (!cancellable(order)) {
      throw new ConflictException(
        'This order is already being prepared, so it can no longer be cancelled here. Please ask the outlet.',
      );
    }
    if (!(await this.catalog.cancelByGuest(order.id, userId))) {
      throw new ConflictException('This order changed a moment ago. Refresh and try again.');
    }
    return this.detail(userId, orderId);
  }

  private async ownOrder(userId: string, orderId: string): Promise<OrderRow> {
    const order = await this.catalog.findOrder(orderId);
    if (!order || (order.orderedByUserId !== userId && order.customerUserId !== userId)) {
      throw new NotFoundException('No such order.');
    }
    return order;
  }

  /**
   * AC-19, in a sentence a guest can act on. Charging to a room needs a stay
   * with an open bill at an outlet that serves in house guests; paying now
   * needs an outlet that serves walk ins, and a rail that exists.
   */
  private assertPolicy(
    outlet: OutletRow,
    stay: InHouseStay | undefined,
    body: PlaceOrderRequest,
  ): void {
    if (body.context === 'in_house_folio') {
      if (outlet.orderingAccess === 'walk_in_only') {
        throw new ForbiddenException(
          `${outlet.name} serves walk in guests only. Pay now, or order at the counter.`,
        );
      }
      if (!stay) {
        throw new ForbiddenException(
          outlet.orderingAccess === 'in_house_only'
            ? `${outlet.name} takes orders only from guests staying at ${outlet.propertyName}.`
            : `You are not staying at ${outlet.propertyName}, so this cannot go on a room bill. Pay now instead.`,
        );
      }
      if (!stay.folioId) {
        throw new ConflictException(
          'Your bill here has already been signed, so nothing more can be charged to your room. Ask the front desk.',
        );
      }
      return;
    }

    if (outlet.orderingAccess === 'in_house_only') {
      throw new ForbiddenException(
        `${outlet.name} takes orders only from guests staying at ${outlet.propertyName}.`,
      );
    }
    if (body.instrument?.kind === 'card') {
      throw new UnprocessableEntityException(
        'Card payments are not available here yet. Pay by mobile money, or in cash at the counter.',
      );
    }
    // The same check `POST /bookings` makes: an Airtel number filed under MTN
    // is refused by the provider with a message about the account, not the number.
    const problem = body.instrument ? instrumentProblem(body.instrument) : null;
    if (problem) throw new UnprocessableEntityException(problem);
  }

  /** The caller's stay at this outlet's property, preferring one whose bill is open. */
  private stayFor(stays: InHouseStay[], outlet: OutletRow): InHouseStay | undefined {
    const here = stays.filter((s) => s.propertyId === outlet.propertyId);
    return here.find((s) => s.folioId) ?? here[0];
  }

  private categoriesOf(items: MenuItemRow[]): OrderableCategory[] {
    const byCategory = new Map<string, OrderableCategory>();
    for (const item of items) {
      const category = byCategory.get(item.categoryId) ?? {
        id: item.categoryId,
        name: item.categoryName,
        items: [],
      };
      category.items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        priceRwf: item.priceRwf,
        prepTimeMinutes: item.prepTimeMinutes,
        options: readOptions(item.options),
      });
      byCategory.set(item.categoryId, category);
    }
    return [...byCategory.values()];
  }

  present(order: OrderRow, items: OrderItemRow[], outlet: OutletRow): GuestOrder {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      outletId: outlet.id,
      outletName: outlet.name,
      propertyName: outlet.propertyName,
      context: order.orderContext,
      lines: items
        .filter((i) => i.serviceOrderId === order.id)
        .map((i) => ({
          name: i.nameSnapshot,
          quantity: i.quantity,
          unitPriceRwf: i.unitPriceRwf,
          lineTotalRwf: i.lineTotalRwf,
          selectedOptions: snapshotsOf(i.selectedOptions),
        })),
      subtotalRwf: order.subtotalRwf,
      taxRwf: order.taxRwf,
      totalRwf: order.totalRwf,
      paidAt: order.paidAt?.toISOString() ?? null,
      paymentMethod: order.paymentMethod,
      cancellable: cancellable(order),
      createdAt: order.createdAt.toISOString(),
    };
  }
}

/** A guest may cancel before money moves: an unpaid pay now order, or a bill order nobody has acknowledged. */
function cancellable(order: Pick<OrderRow, 'status' | 'orderContext' | 'paidAt'>): boolean {
  if (order.paidAt) return false;
  if (order.status === 'pending_payment' || order.status === 'payment_failed') return true;
  return order.orderContext === 'in_house_folio' && order.status === 'submitted';
}
