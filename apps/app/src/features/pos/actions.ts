"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  type ArchivedKind,
  type BillPrint,
  type CatalogStatus,
  type CustomerInput,
  catalogWrite,
  customerWrite,
  type LineRequest,
  type MobileMethod,
  type OrderType,
  outletWrite,
  type PaymentMethod,
  type PosArchivedVenue,
  type PosCatalog,
  type PosCustomerExport,
  type PosCustomerList,
  type PosCustomerProfile,
  type PosExpenseRow,
  type PosFloor,
  type PosOrder,
  type PosOrderSummary,
  type PosOutlet,
  type PosPaymentUpdate,
  type PosShift,
  type PosStockItem,
  type PosTicket,
  type PosVenue,
  type PosVenueTemplatePlan,
  posArchived,
  posBackOffice,
  posCustomers,
  posFirstOutletTarget,
  posOrder,
  posOrders,
  posOutletRefs,
  posOutlets,
  posPaymentUpdates,
  posStations,
  posVenueTemplates,
  posWrite,
  type SettingsInput,
  type StationKind,
  type StockMovementKind,
  type TableStatus,
  type TicketStatus,
  type VenueTemplateKey,
  venueWrite,
} from "@/server/pos";
import { SECTION_PRESETS, type SectionKind } from "./menu-presets";
import { POS_BOARDS } from "./pos-boards";

/**
 * The point of sale's commands. Each checks the person may open the POS, calls the API through
 * `server/pos.ts`, and refreshes the POS screens. A refusal comes back as the API's own sentence (a sold out
 * item, a discount over the limit, cash without an open shift), never as an error the floor cannot read.
 * Every rule is the API's; nothing here decides.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona("PosFloor");
  try {
    const value = await act();
    for (const board of Object.values(POS_BOARDS)) revalidatePath(board.href);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

// ── Floor ──────────────────────────────────────────────────────────────────────────────────────────

export async function seatAction(tableId: string, guestCount: number): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.seat(await ctx(), tableId, guestCount));
}

export async function tableStatusAction(tableId: string, status: TableStatus): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.tableStatus(await ctx(), tableId, status));
}

export async function releaseAction(sessionId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.release(await ctx(), sessionId));
}

export async function moveSessionAction(sessionId: string, toTableId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.moveSession(await ctx(), sessionId, toTableId));
}

export async function mergeSessionsAction(sessionId: string, fromSessionId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.mergeSessions(await ctx(), sessionId, fromSessionId));
}

// ── Orders ─────────────────────────────────────────────────────────────────────────────────────────

/** `clientKey` is minted once per press in the browser, so a double tap opens one order. */
export async function createOrderAction(
  body: { outletId: string; orderType: OrderType; tableSessionId?: string; guestNote?: string },
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.createOrder(await ctx(), body, clientKey));
}

export async function addLinesAction(orderId: string, lines: LineRequest[]): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.addLines(await ctx(), orderId, lines));
}

export async function updateLineAction(
  orderId: string,
  lineId: string,
  body: { quantity?: number; note?: string | null },
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.updateLine(await ctx(), orderId, lineId, body));
}

export async function removeLineAction(orderId: string, lineId: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.removeLine(await ctx(), orderId, lineId));
}

export async function voidLineAction(orderId: string, lineId: string, reason: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.voidLine(await ctx(), orderId, lineId, reason));
}

export async function sendAction(orderId: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.send(await ctx(), orderId));
}

export async function cancelAction(orderId: string, reason: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.cancel(await ctx(), orderId, reason));
}

export async function discountAction(
  orderId: string,
  body: { orderItemId?: string; kind: "amount" | "percent"; value: number; reason: string },
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.discount(await ctx(), orderId, body));
}

export async function decideDiscountAction(
  orderId: string,
  discountId: string,
  approve: boolean,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.decideDiscount(await ctx(), orderId, discountId, approve));
}

export async function transferAction(
  orderId: string,
  toTableSessionId: string,
  reason: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.transfer(await ctx(), orderId, toTableSessionId, reason));
}

export async function splitAction(orderId: string, orderItemIds: string[]): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.split(await ctx(), orderId, orderItemIds));
}

export async function printBillAction(orderId: string): Promise<ActionResult<BillPrint>> {
  return run(async () => posWrite.printBill(await ctx(), orderId));
}

// ── Payments ───────────────────────────────────────────────────────────────────────────────────────

export async function payAction(
  orderId: string,
  body: {
    method: PaymentMethod;
    amountRwf: number;
    tenderedRwf?: number;
    tipRwf?: number;
    simulate?: "success" | "pending" | "failure" | "timeout";
    payerPhone?: string;
    voucherCode?: string;
  },
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.pay(await ctx(), orderId, { ...body, idempotencyKey: clientKey }));
}

export async function resolvePaymentAction(
  paymentId: string,
  outcome: "success" | "failure" | "timeout",
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.resolvePayment(await ctx(), paymentId, outcome));
}

export async function refundAction(
  paymentId: string,
  amountRwf: number,
  reason: string,
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.refund(await ctx(), paymentId, { amountRwf, reason, idempotencyKey: clientKey }));
}

// ── Mobile money confirmed by the cashier ───────────────────────────────────────────────────────────

/** The waiter's (or cashier's) Pay: the payment is recorded PENDING, never paid, until the cashier confirms it. */
export async function startMobilePaymentAction(
  orderId: string,
  body: { method: MobileMethod; amountRwf: number; payerPhone: string },
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.startMobilePayment(await ctx(), orderId, { ...body, idempotencyKey: clientKey }));
}

/** The cashier saw the money arrive. */
export async function confirmPaymentAction(paymentId: string, transactionId?: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.confirmPayment(await ctx(), paymentId, transactionId?.trim() || undefined));
}

/** The money did not arrive. */
export async function paymentNotReceivedAction(paymentId: string, reason: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.paymentNotReceived(await ctx(), paymentId, reason));
}

/** Mail a paid bill's receipt to the address the customer gave. */
export async function emailReceiptAction(
  orderId: string,
  email: string,
): Promise<ActionResult<{ sent: true; to: string }>> {
  return run(async () => posWrite.emailReceipt(await ctx(), orderId, email.trim()));
}

/** A read, so no screen is revalidated: what a few-second poll of the Cashier Desk or the waiter's screen asks. */
async function read<T>(act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona("PosFloor");
  try {
    return { ok: true, value: await act() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer." };
    throw error;
  }
}

/** Payments on the waiter's bills that the cashier answered since `since`. */
export async function paymentUpdatesAction(
  outletId: string,
  since?: string,
): Promise<ActionResult<PosPaymentUpdate[]>> {
  return read(async () => posPaymentUpdates(await ctx(), outletId, since));
}

/** One bill, for its receipt. */
export async function orderAction(orderId: string): Promise<ActionResult<PosOrder>> {
  return read(async () => posOrder(await ctx(), orderId));
}

/**
 * READ ONLY: the bills still open on one table sitting (drafts included), from the same list the floor reads, so the
 * waiter's payment card can say why the table cannot be released yet. Nothing is changed; the API still decides.
 */
export async function sittingBillsAction(
  outletId: string,
  sessionId: string,
): Promise<ActionResult<PosOrderSummary[]>> {
  return read(async () =>
    (await posOrders(await ctx(), { outletId, status: "open", limit: 200 })).filter(
      (o) => o.tableSessionId === sessionId,
    ),
  );
}

// ── Kitchen and bar ────────────────────────────────────────────────────────────────────────────────

export async function advanceTicketAction(ticketId: string, to: TicketStatus): Promise<ActionResult<PosTicket>> {
  return run(async () => posWrite.advanceTicket(await ctx(), ticketId, to));
}

export async function reprintTicketAction(ticketId: string): Promise<ActionResult<PosTicket>> {
  return run(async () => posWrite.reprintTicket(await ctx(), ticketId));
}

// ── Shifts ─────────────────────────────────────────────────────────────────────────────────────────

export async function openShiftAction(registerId: string, openingFloatRwf: number): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.openShift(await ctx(), registerId, openingFloatRwf));
}

export async function cashMovementAction(
  shiftId: string,
  body: { kind: "paid_in" | "paid_out"; amountRwf: number; reason: string },
): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.cashMovement(await ctx(), shiftId, body));
}

export async function decideMovementAction(movementId: string, approve: boolean): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.decideMovement(await ctx(), movementId, approve));
}

export async function closeShiftAction(
  shiftId: string,
  body: { countedCashRwf: number; closeNote?: string; handoverNote?: string },
): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.closeShift(await ctx(), shiftId, body));
}

export async function reviewShiftAction(shiftId: string, note?: string): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.reviewShift(await ctx(), shiftId, note));
}

// ── Back office: stock and expenses ─────────────────────────────────────────────────────────────────

/** Like `run`, gated by the back-office board the person is on (the stock controller is not a floor persona). */
async function runBackOffice<T>(
  board: "PosStock" | "PosReports" | "PosSetup" | "PosMenu",
  act: () => Promise<T>,
): Promise<ActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    for (const b of Object.values(POS_BOARDS)) revalidatePath(b.href);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function adjustStockAction(body: {
  serviceItemId: string;
  kind: StockMovementKind;
  quantity: number;
  reason: string;
}): Promise<ActionResult<PosStockItem>> {
  return runBackOffice("PosStock", async () => posBackOffice.adjustStock(await ctx(), body));
}

export async function recordExpenseAction(body: {
  outletId?: string;
  category: string;
  amountRwf: number;
  method: string;
  payeeName?: string;
  note?: string;
}): Promise<ActionResult<PosExpenseRow>> {
  return runBackOffice("PosReports", async () => posBackOffice.recordExpense(await ctx(), body));
}

export async function voidExpenseAction(expenseId: string, reason: string): Promise<ActionResult<PosExpenseRow>> {
  return runBackOffice("PosReports", async () => posBackOffice.voidExpense(await ctx(), expenseId, reason));
}

// ── Venue setup (the API refuses anything in use, with the reason) ─────────────────────────────────────

/** A new Bar & Restaurant business has no outlet yet. This creates its first one, in its Food and Beverage department. */
export async function createFirstOutletAction(body: {
  name: string;
  kind: "restaurant" | "bar";
}): Promise<ActionResult<{ outletId: string }>> {
  return runBackOffice("PosSetup", async () => {
    const c = await ctx();
    // Already has an outlet (a second press, or a second tab still showing this step): hand back that one, create nothing.
    const existing = await posOutlets(c);
    if (existing[0]) return { outletId: existing[0].id };
    const target = await posFirstOutletTarget(c);
    if (!target)
      throw new ApiError(
        422,
        "no_department",
        "This business has no Food and Beverage department to put an outlet in. Contact support.",
        null,
      );
    const created = await outletWrite.create(c, { name: body.name.trim(), outletKind: body.kind, ...target });
    return { outletId: created.id };
  });
}

export async function updateSettingsAction(outletId: string, body: SettingsInput): Promise<ActionResult<PosOutlet>> {
  return runBackOffice("PosSetup", async () => venueWrite.updateSettings(await ctx(), outletId, body));
}

export async function createAreaAction(outletId: string, name: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.createArea(await ctx(), outletId, { name }));
}
export async function renameAreaAction(outletId: string, id: string, name: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.updateArea(await ctx(), outletId, id, { name }));
}
export async function archiveAreaAction(outletId: string, id: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.archiveArea(await ctx(), outletId, id));
}
export async function createTableAction(
  outletId: string,
  body: { areaId: string; label: string; seats: number },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.createTable(await ctx(), outletId, body));
}
export async function updateTableAction(
  outletId: string,
  id: string,
  body: { areaId?: string; label?: string; seats?: number },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.updateTable(await ctx(), outletId, id, body));
}
export async function archiveTableAction(outletId: string, id: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.archiveTable(await ctx(), outletId, id));
}
export async function createStationAction(
  outletId: string,
  body: { name: string; kind: StationKind; printerName?: string | null },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.createStation(await ctx(), outletId, body));
}
export async function updateStationAction(
  outletId: string,
  id: string,
  body: { name?: string; kind?: StationKind; printerName?: string | null },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.updateStation(await ctx(), outletId, id, body));
}
export async function archiveStationAction(outletId: string, id: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.archiveStation(await ctx(), outletId, id));
}
export async function createRegisterAction(
  outletId: string,
  body: { name: string; deviceLabel?: string | null },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.createRegister(await ctx(), outletId, body));
}
export async function updateRegisterAction(
  outletId: string,
  id: string,
  body: { name?: string; deviceLabel?: string | null },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.updateRegister(await ctx(), outletId, id, body));
}
export async function archiveRegisterAction(outletId: string, id: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.archiveRegister(await ctx(), outletId, id));
}
export async function setRouteAction(
  outletId: string,
  serviceItemId: string,
  stationId: string | null,
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.setRoute(await ctx(), outletId, serviceItemId, stationId));
}
/** Several routes in one call (a whole section to one station): all are set, or none. */
export async function setRoutesAction(
  outletId: string,
  routes: { serviceItemId: string; stationId: string | null }[],
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.setRoutes(await ctx(), outletId, routes));
}
export async function bulkTablesAction(
  outletId: string,
  body: { areaId: string; prefix: string; start: number; count: number; seats: number },
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.bulkTables(await ctx(), outletId, body));
}
export async function reorderAction(
  outletId: string,
  kind: "areas" | "tables" | "stations",
  ids: string[],
): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.reorder(await ctx(), outletId, kind, ids));
}
export async function restoreAction(outletId: string, kind: ArchivedKind, id: string): Promise<ActionResult<PosVenue>> {
  return runBackOffice("PosSetup", async () => venueWrite.restore(await ctx(), outletId, kind, id));
}
export async function applyTemplateAction(
  outletId: string,
  template: VenueTemplateKey,
): Promise<ActionResult<{ venue: PosVenue; created: number; skipped: number }>> {
  return runBackOffice("PosSetup", async () => venueWrite.applyTemplate(await ctx(), outletId, template));
}

/** A read for the setup screen: no screens are refreshed, and a refusal comes back as its sentence. */
async function readSetup<T>(act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona("PosSetup");
  try {
    return { ok: true, value: await act() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
export async function archivedAction(outletId: string): Promise<ActionResult<PosArchivedVenue>> {
  return readSetup(async () => posArchived(await ctx(), outletId));
}
export async function templatesAction(outletId: string): Promise<ActionResult<PosVenueTemplatePlan[]>> {
  return readSetup(async () => posVenueTemplates(await ctx(), outletId));
}

// ── Menu management (the existing catalogue API, `menu.manage`) ─────────────────────────────────────────

export async function createSectionAction(
  outletId: string,
  body: { name: string; kind: SectionKind; guestVisible: boolean },
): Promise<ActionResult<PosCatalog>> {
  return runBackOffice("PosMenu", async () => {
    const c = await ctx();
    const outlet = (await posOutletRefs(c)).find((o) => o.id === outletId);
    if (!outlet?.propertyId) throw new ApiError(404, "not_found", "That outlet is not available to you.", null);
    // A server action is a public endpoint: the type says what the screen sends, not what a caller may send.
    if (!Object.hasOwn(SECTION_PRESETS, body.kind))
      throw new ApiError(400, "bad_request", "Choose Drinks, Food or Service.", null);
    const p = SECTION_PRESETS[body.kind];
    return catalogWrite.createCategory(c, {
      name: body.name,
      guestVisible: body.guestVisible,
      outletId,
      propertyId: outlet.propertyId,
      departmentId: outlet.departmentId,
      defaultRraItemClsCd: p.cls,
      defaultRraItemTyCd: p.ty,
      defaultRraPkgUnitCd: p.pkg,
      defaultRraQtyUnitCd: p.qty,
      defaultTaxCode: p.tax,
    });
  });
}
export async function updateSectionAction(
  id: string,
  body: { name?: string; guestVisible?: boolean },
): Promise<ActionResult<PosCatalog>> {
  return runBackOffice("PosMenu", async () => catalogWrite.updateCategory(await ctx(), id, body));
}
export async function createProductAction(body: {
  serviceCategoryId: string;
  name: string;
  description?: string;
  priceRwf: number;
  taxCode?: string;
  prepTimeMinutes?: number;
  stockQty?: number | null;
  photo?: string | null;
}): Promise<ActionResult<PosCatalog>> {
  return runBackOffice("PosMenu", async () => catalogWrite.createItem(await ctx(), body));
}
export async function updateProductAction(
  id: string,
  body: {
    name?: string;
    description?: string;
    priceRwf?: number;
    taxCode?: string;
    prepTimeMinutes?: number;
    stockQty?: number | null;
    status?: CatalogStatus;
    photo?: string | null;
  },
): Promise<ActionResult<PosCatalog>> {
  return runBackOffice("PosMenu", async () => catalogWrite.updateItem(await ctx(), id, body));
}

// ── Customers (CRM, phase 1) ────────────────────────────────────────────────────────────────────────

/** Like `ActionResult`, plus the customer already holding a phone number when a registration collides with one. */
export type CustomerActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; existingCustomerId?: string };

/**
 * Customers are a back-office board of their own (`PosCustomers`), but the picker on the floor and the till calls the
 * same actions, so each one is gated by the board it is called from. The API decides every permission.
 */
async function runCustomers<T>(
  board: "PosCustomers" | "PosFloor",
  act: () => Promise<T>,
): Promise<CustomerActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    for (const b of Object.values(POS_BOARDS)) revalidatePath(b.href);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = (error.body ?? {}) as { code?: string; customerId?: string | null };
      if (body.code === "CUSTOMER_PHONE_EXISTS") {
        return { ok: false, error: error.message, existingCustomerId: body.customerId ?? undefined };
      }
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

/** Find customers by name or phone. A read: it refreshes nothing, and is called as the person types. */
export async function searchCustomersAction(q: string): Promise<CustomerActionResult<PosCustomerList>> {
  await requirePersona("PosFloor");
  try {
    return { ok: true, value: await posCustomers(await ctx(), { q: q.trim() || undefined, limit: 8 }) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function createCustomerAction(
  body: CustomerInput,
  from: "PosCustomers" | "PosFloor" = "PosCustomers",
): Promise<CustomerActionResult<PosCustomerProfile>> {
  return runCustomers(from, async () => customerWrite.create(await ctx(), body));
}

export async function updateCustomerAction(
  id: string,
  body: Partial<CustomerInput>,
): Promise<CustomerActionResult<PosCustomerProfile>> {
  return runCustomers("PosCustomers", async () => customerWrite.update(await ctx(), id, body));
}

export async function mergeCustomerAction(
  id: string,
  intoCustomerId: string,
  reason: string,
): Promise<CustomerActionResult<PosCustomerProfile>> {
  return runCustomers("PosCustomers", async () => customerWrite.merge(await ctx(), id, { intoCustomerId, reason }));
}

export async function eraseCustomerAction(id: string, reason: string): Promise<CustomerActionResult<{ erased: true }>> {
  return runCustomers("PosCustomers", async () => customerWrite.erase(await ctx(), id, reason));
}

export async function exportCustomerAction(id: string): Promise<CustomerActionResult<PosCustomerExport>> {
  return runCustomers("PosCustomers", async () => customerWrite.export(await ctx(), id));
}

/** Put a customer on a bill, or (null) take them off it. */
export async function attachCustomerAction(
  orderId: string,
  customerId: string | null,
): Promise<CustomerActionResult<PosOrder>> {
  return runCustomers("PosFloor", async () => customerWrite.attach(await ctx(), orderId, customerId));
}

/**
 * The station kinds an outlet has (kitchen, bar, or both), for labels such as the sidebar's "Kitchen", "Bar" or
 * "Kitchen and bar". Read-only; null when the person may not read the stations or the API cannot be reached, and
 * the label then stays the general one.
 */
export async function stationKindsAction(outletId: string): Promise<StationKind[] | null> {
  try {
    const stations = await posStations(await ctx(), outletId);
    return [...new Set(stations.map((s) => s.kind))];
  } catch {
    return null;
  }
}
