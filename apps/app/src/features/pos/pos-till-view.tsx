"use client";

import {
  ArrowLeft,
  ArrowRightArrowLeft,
  Ban,
  CreditCard,
  Minus,
  PaperPlane,
  Plus,
  Printer,
  Receipt,
  Scissors,
  TagDollar,
  TrashBin,
} from "@gravity-ui/icons";
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  SearchField,
  Tabs,
  TextArea,
  TextField,
  ToggleButton,
} from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import { LinkButton } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import {
  type BillPrint,
  isMobileMethod,
  METHOD_LABEL,
  ORDER_STATUS_LABEL,
  type PaymentMethod,
  type PosMenu,
  type PosMenuItem,
  type PosOrder,
  type PosOrderLine,
  type PosOutlet,
  type PosShift,
  type PosStationRow,
  type PosTable,
} from "@/server/pos";
import {
  addLinesAction,
  cancelAction,
  decideDiscountAction,
  discountAction,
  payAction,
  printBillAction,
  refundAction,
  removeLineAction,
  resolvePaymentAction,
  sendAction,
  splitAction,
  transferAction,
  updateLineAction,
  voidLineAction,
} from "./actions";
import { DishArt } from "./dish-art";
import { ReceiptDialog } from "./ebm-receipt";
import { mentionsAllergy } from "./kds";
import { EmailReceiptDialog, MobilePayDialog } from "./mobile-payment";
import { destinationOf, kindsOf, type StationKind, sendPlan } from "./outlet-type";
import { OrderCustomer } from "./pos-customer-picker";
import { PosShell } from "./pos-shell";
import {
  GuestQrChip,
  money,
  ORDER_COLOR,
  PosDialog,
  parseRwf,
  SimulationNotice,
  StatusChip,
  usePosAction,
  usePressKey,
} from "./shared";

type Dialog =
  | { kind: "options"; item: PosMenuItem }
  | { kind: "void"; line: PosOrderLine }
  | { kind: "cancel" }
  | { kind: "discount" }
  | { kind: "split" }
  | { kind: "transfer" }
  | { kind: "pay" }
  | { kind: "mobile" }
  | { kind: "email" }
  | { kind: "refund"; paymentId: string; left: number }
  | { kind: "bill"; print: BillPrint }
  | { kind: "receipt" }
  | null;

const ASYNC: PaymentMethod[] = ["mtn_momo", "airtel_money", "bank_transfer"];

const STEPS = ["Ordered", "Sent", "Preparing", "Ready", "Served", "Paid"] as const;
const STEP_OF: Record<string, number> = {
  draft: 0,
  submitted: 1,
  in_progress: 2,
  ready: 3,
  delivered: 4,
  completed: 5,
};

/** Where the order is, from taking it to the bill being paid: the tracking the waiter and the guest ask about. */
function OrderProgress({ order }: { order: PosOrder }) {
  if (order.status === "cancelled") return null;
  // The food moves on its own track; payment can come before or after serving, so "Paid" is its own fact.
  const food = Math.min(STEP_OF[order.status] ?? 0, 4);
  const paid = order.settlement.settled;
  const reached = paid && food >= 4 ? 5 : food;
  return (
    <ol data-ui="order-progress" aria-label="Order progress" className="mx-4 mt-3 flex items-center gap-1">
      {STEPS.map((label, i) => {
        const done = i === 5 ? paid : i <= food;
        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            aria-current={i === reached ? "step" : undefined}
          >
            <span
              className={`h-1.5 w-full rounded-full ${done ? "bg-[#0b8442]" : "bg-[var(--pos-row)]"}`}
              aria-hidden="true"
            />
            <span
              className={`truncate text-[12px] ${i === reached ? "font-semibold text-foreground" : done ? "text-[var(--pos-ink-2)]" : "text-muted"}`}
            >
              {label}
              <span className="sr-only">{done ? " (done)" : " (to come)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function optionsLine(l: PosOrderLine): string {
  return l.selectedOptions.map((o) => `${o.name}: ${o.choices.map((c) => c.label).join(", ")}`).join(" · ");
}

/**
 * The till (POS spec §5): the outlet's menu beside one order, every command on the order, and checkout with
 * several payments. Every total on the screen is the API's; nothing is priced in the browser except the
 * options preview before a line is added.
 */
export function PosTillView({
  outlet,
  outlets,
  order,
  menu,
  tables,
  shift,
  stations = null,
  can,
  startWithPayment = false,
}: {
  outlet: PosOutlet;
  outlets: PosOutlet[];
  order: PosOrder;
  menu: PosMenu;
  tables: PosTable[];
  shift: PosShift | null;
  /** The outlet's kitchen and bar stations (null when they could not be read): they name the Send button. */
  stations?: PosStationRow[] | null;
  can: string[];
  /** Opened from the Cashier Desk's "Take payment": show the bill with the payment dialog, and go back there after. */
  startWithPayment?: boolean;
}) {
  const router = useRouter();
  const { run, pending } = usePosAction();
  // Only the sections with something to sell: a section whose items were all archived is no use on the till.
  const categories = useMemo(
    () => menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id)),
    [menu.categories, menu.items],
  );
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  // On a phone the menu and the order each get the whole width, one at a time; from a tablet up they sit side by side.
  const has = (p: string) => can.includes(p);
  const editable = order.status !== "completed" && order.status !== "cancelled";
  // From the Cashier Desk the cashier came to collect money: open on the bill and its payment, never on the menu.
  // Any bill still owed: when a pending (simulated) payment covers it, the dialog is where that payment is confirmed.
  const paying = startWithPayment && editable && has("pos.checkout") && order.settlement.outstandingRwf > 0;
  const [pane, setPane] = useState<"menu" | "order">(startWithPayment ? "order" : "menu");
  const [dialog, setDialog] = useState<Dialog>(paying ? { kind: "pay" } : null);
  const drafts = order.lines.filter((l) => l.status === "draft");
  const live = order.lines.filter((l) => l.status !== "voided");
  // Where each item is prepared: its route on the menu, then the kind of that station (kitchen or bar).
  const kindOfStation = useMemo(() => new Map((stations ?? []).map((s) => [s.id, s.kind as StationKind])), [stations]);
  const routeOf = useMemo(() => new Map(menu.items.map((i) => [i.id, i.stationId])), [menu.items]);
  // The photo saved with each item, so a line on the bill shows the same picture as its card.
  const photoOf = useMemo(() => new Map(menu.items.map((i) => [i.id, i.photo ?? null])), [menu.items]);
  const kindOfItem = (stationId: string | null | undefined): StationKind | null =>
    stationId ? (kindOfStation.get(stationId) ?? null) : null;
  const outletKinds = useMemo(() => kindsOf(stations ?? []), [stations]);
  // The Send button: "Send to Kitchen" or "Send to Bar" in a single-station outlet, "Send Order" with both; and the
  // summary of where the waiting quantities go. The waiter never chooses a station.
  const plan = stations
    ? sendPlan(
        outletKinds,
        drafts.map((l) => ({
          kind: kindOfItem(l.serviceItemId ? routeOf.get(l.serviceItemId) : null),
          quantity: l.quantity,
        })),
      )
    : null;
  // What a product card says about where it is prepared (its station; in a single-station outlet, that station).
  const destinationText = (stationId: string | null): string | null => {
    if (!stations) return stationId ? "Goes to a station" : "No ticket";
    const to = destinationOf(kindOfItem(stationId), outletKinds);
    return to === "bar" ? "Goes to the bar" : to === "kitchen" ? "Goes to the kitchen" : "No station set";
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.items.filter((i) =>
      q ? i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q) : i.categoryId === category,
    );
  }, [menu.items, category, query]);

  function addPlain(item: PosMenuItem) {
    if (item.options.length) return setDialog({ kind: "options", item });
    run(() => addLinesAction(order.id, [{ serviceItemId: item.id, quantity: 1 }]), `${item.name} added`);
  }

  const categoryName = new Map(menu.categories.map((c) => [c.id, c.name]));

  return (
    <PosShell
      board="PosFloor"
      title={`${order.orderNumber}${order.tableLabel ? ` · Table ${order.tableLabel}` : order.orderType === "takeaway" ? " · Takeaway" : ""}`}
      subtitle={`${outlet.name}${outlet.branchName ? ` · ${outlet.branchName}` : ""}${order.waiterName ? ` · ${order.waiterName}` : ""}`}
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/floor"
      can={can}
      actions={
        <>
          {order.source === "table_qr" ? <GuestQrChip /> : null}
          <StatusChip color={ORDER_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusChip>
          <LinkButton href={`/pos/floor?outlet=${outlet.id}`} variant="secondary" size="sm">
            <ArrowLeft className="size-4" />
            Floor
          </LinkButton>
        </>
      }
    >
      <fieldset
        className="m-0 mx-4 mb-3 flex min-w-0 gap-2 rounded-2xl border-0 bg-surface p-1.5 md:hidden"
        aria-label="Show"
      >
        <Button
          size="sm"
          fullWidth
          variant={pane === "menu" ? "primary" : "secondary"}
          aria-pressed={pane === "menu"}
          onPress={() => setPane("menu")}
        >
          Menu
        </Button>
        <Button
          size="sm"
          fullWidth
          variant={pane === "order" ? "primary" : "secondary"}
          aria-pressed={pane === "order"}
          onPress={() => setPane("order")}
        >
          Order · {live.length} · {money(order.totalRwf)}
        </Button>
      </fieldset>

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 md:px-6">
        {/* The menu */}
        <section
          aria-label="Menu"
          className={`flex min-w-0 flex-1 flex-col gap-3 overflow-hidden ${pane === "menu" ? "" : "max-md:hidden"}`}
        >
          <SearchField aria-label="Search the menu" value={query} onChange={setQuery} fullWidth>
            <SearchField.Group className="rounded-2xl bg-surface">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search dishes and drinks" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {!query ? (
            <Tabs variant="secondary" selectedKey={category} onSelectionChange={(k) => setCategory(String(k))}>
              <Tabs.ListContainer className="overflow-x-auto pb-1">
                <Tabs.List aria-label="Menu category" className="gap-2 border-0 shadow-none">
                  {categories.map((c) => {
                    const n = menu.items.filter((i) => i.categoryId === c.id).length;
                    return (
                      <Tabs.Tab
                        key={c.id}
                        id={c.id}
                        data-ui="category-pill"
                        data-category={c.id}
                        data-count={n}
                        className="pos-chip"
                      >
                        <span className="whitespace-nowrap">{c.name}</span>
                        <span className="pos-chip-count tabular">{n}</span>
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          ) : null}
          <div className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto pb-1 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {items.map((item) => {
              const off = !item.available || !editable || !has("pos.sell") || pending;
              const section = categoryName.get(item.categoryId) ?? "";
              return (
                <button
                  key={item.id}
                  type="button"
                  data-ui="product-card"
                  data-item={item.name}
                  disabled={off}
                  onClick={() => addPlain(item)}
                  className="group flex flex-col gap-2.5 rounded-[20px] border border-separator bg-surface p-2.5 text-left transition enabled:hover:border-accent enabled:hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--accent)_60%,transparent)] disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <DishArt name={item.name} section={section} photo={item.photo} />
                  <span className="flex min-w-0 flex-col gap-0.5 px-1">
                    <span className="truncate text-[12px] font-medium text-muted">{section}</span>
                    <span className="line-clamp-2 min-h-10 text-[14px] leading-5 font-semibold">{item.name}</span>
                  </span>
                  <span className="flex flex-col gap-1 px-1 pb-0.5">
                    {/* The price is never cut short: when the card is narrow it wraps above the add button instead. */}
                    <span className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
                      <span
                        data-ui="price"
                        className="text-[14px] font-semibold whitespace-nowrap text-accent-soft-foreground tabular"
                      >
                        {money(item.priceRwf)}
                      </span>
                      <span
                        data-ui="add"
                        className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_6px_14px_-6px_var(--accent)] transition group-enabled:group-hover:scale-105 group-disabled:bg-default group-disabled:text-muted group-disabled:shadow-none"
                      >
                        <Plus className="size-4" />
                        <span className="sr-only">Add</span>
                      </span>
                    </span>
                    <span className="truncate text-[12px] text-muted">
                      {item.available
                        ? item.options.length
                          ? "Sizes and options"
                          : destinationText(item.stationId)
                        : item.unavailableReason}
                    </span>
                  </span>
                </button>
              );
            })}
            {items.length === 0 ? <p className="text-[13px] text-muted">Nothing matches.</p> : null}
          </div>
        </section>

        {/* The order */}
        <section
          aria-label="Order"
          data-ui="order-panel"
          className={`flex w-full shrink-0 flex-col overflow-hidden rounded-[20px] border border-separator bg-surface md:w-[330px] lg:w-[360px] xl:w-[400px] ${pane === "order" ? "" : "max-md:hidden"}`}
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <h2 className="text-[16px] font-semibold">Order summary</h2>
            <span className="text-[12px] text-muted tabular">
              {live.length} line{live.length === 1 ? "" : "s"}
            </span>
          </div>
          <OrderProgress order={order} />
          <OrderCustomer order={order} can={can} editable={editable} />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {order.lines.length === 0 ? (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Title>Nothing ordered yet</EmptyState.Title>
                  <EmptyState.Description>Tap a dish or a drink to add it.</EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : null}
            {order.lines.map((l) => (
              <div
                key={l.id}
                className={`flex flex-col gap-1 rounded-2xl bg-background/70 p-3 ${l.status === "voided" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <DishArt name={l.name} photo={l.serviceItemId ? photoOf.get(l.serviceItemId) : null} size="thumb" />
                  <span
                    className={`min-w-0 flex-1 pt-0.5 text-[14px] font-semibold ${l.status === "voided" ? "line-through" : ""}`}
                  >
                    <span className="mr-1.5 inline-flex min-w-6 justify-center rounded-md bg-surface px-1 text-[12px] text-accent-soft-foreground tabular">
                      {l.quantity}×
                    </span>
                    {l.name}
                  </span>
                  <span className="text-[14px] font-semibold tabular">
                    {money(l.status === "voided" ? 0 : l.totalRwf)}
                  </span>
                </div>
                {l.selectedOptions.length ? <span className="text-[12px] text-muted">{optionsLine(l)}</span> : null}
                {l.note ? (
                  mentionsAllergy(l.note) ? (
                    <span className="text-[12px] font-semibold text-danger">Allergy: {l.note}</span>
                  ) : (
                    <span className="text-[12px] text-warning">Note: {l.note}</span>
                  )
                ) : null}
                {l.discountRwf > 0 && l.status !== "voided" ? (
                  <span className="text-[12px] text-success-soft-foreground tabular">
                    Discount −{money(l.discountRwf)}
                  </span>
                ) : null}
                {l.status === "voided" ? <span className="text-[12px] text-danger">Voided: {l.voidReason}</span> : null}
                <div className="flex items-center gap-1">
                  <StatusChip color={l.status === "draft" ? "accent" : l.status === "sent" ? "default" : "danger"}>
                    {l.status === "draft" ? "Not sent" : l.status === "sent" ? "Sent" : "Voided"}
                  </StatusChip>
                  <span className="flex-1" />
                  {l.status === "draft" && editable && has("pos.sell") ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`One fewer ${l.name}`}
                        isDisabled={pending || l.quantity <= 1}
                        onPress={() => run(() => updateLineAction(order.id, l.id, { quantity: l.quantity - 1 }))}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`One more ${l.name}`}
                        isDisabled={pending}
                        onPress={() => run(() => updateLineAction(order.id, l.id, { quantity: l.quantity + 1 }))}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Remove ${l.name}`}
                        isDisabled={pending}
                        onPress={() => run(() => removeLineAction(order.id, l.id), `${l.name} removed`)}
                      >
                        <TrashBin className="size-4" />
                      </Button>
                    </>
                  ) : null}
                  {l.status === "sent" && editable && has("pos.override") ? (
                    <Button size="sm" variant="danger-soft" onPress={() => setDialog({ kind: "void", line: l })}>
                      <Ban className="size-4" />
                      Void
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            {order.discounts.length ? (
              <div className="flex flex-col gap-1 border-t border-separator pt-2">
                {order.discounts.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span>
                      {d.orderItemId ? "Line" : "Order"} discount {money(d.amountRwf)} · {d.reason}
                    </span>
                    {d.status === "pending_approval" && has("pos.override") && editable ? (
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          isDisabled={pending}
                          onPress={() => run(() => decideDiscountAction(order.id, d.id, true), "Discount approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={pending}
                          onPress={() => run(() => decideDiscountAction(order.id, d.id, false), "Discount rejected")}
                        >
                          Reject
                        </Button>
                      </span>
                    ) : (
                      <StatusChip
                        color={d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning"}
                      >
                        {d.status === "pending_approval"
                          ? "Waiting for a manager"
                          : d.status === "approved"
                            ? "Approved"
                            : "Rejected"}
                      </StatusChip>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {order.payments.length ? (
              <div className="flex flex-col gap-1.5 border-t border-separator pt-2">
                <span className="text-[12px] font-semibold">Payments</span>
                {order.payments.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 rounded-lg bg-default/40 p-2 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{METHOD_LABEL[p.method]}</span>
                      <span className="tabular">{money(p.amountRwf)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-muted">
                      <StatusChip
                        color={
                          p.status === "successful"
                            ? "success"
                            : p.status === "pending" || p.status === "initiated"
                              ? "warning"
                              : p.status === "refunded"
                                ? "default"
                                : "danger"
                        }
                      >
                        {p.status}
                      </StatusChip>
                      <span className="tabular">{p.demoReference}</span>
                      {p.changeRwf ? <span>· change {money(p.changeRwf)}</span> : null}
                      {p.tipRwf ? <span>· tip {money(p.tipRwf)}</span> : null}
                      {p.refundedRwf ? <span>· refunded {money(p.refundedRwf)}</span> : null}
                      {p.failureReason ? <span className="text-danger">· {p.failureReason}</span> : null}
                    </div>
                    {(p.status === "pending" || p.status === "initiated") && isMobileMethod(p.method) ? (
                      <div className="flex flex-wrap items-center gap-1" data-ui="waiting-for-cashier">
                        <span className="text-warning-soft-foreground">
                          Waiting for the cashier to see the money arrive and confirm it.
                        </span>
                        {has("pos.checkout") ? (
                          <LinkButton href={`/pos/shift?outlet=${outlet.id}`} size="sm" variant="secondary">
                            Cashier desk
                          </LinkButton>
                        ) : null}
                      </div>
                    ) : null}
                    {(p.status === "pending" || p.status === "initiated") &&
                    !isMobileMethod(p.method) &&
                    has("pos.checkout") ? (
                      <div className="flex flex-wrap gap-1">
                        <span className="self-center text-muted">Simulate the provider:</span>
                        <Button
                          size="sm"
                          isDisabled={pending}
                          onPress={() => run(() => resolvePaymentAction(p.id, "success"), "Simulated: confirmed")}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={pending}
                          onPress={() => run(() => resolvePaymentAction(p.id, "failure"), "Simulated: declined")}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={pending}
                          onPress={() => run(() => resolvePaymentAction(p.id, "timeout"), "Simulated: timed out")}
                        >
                          Time out
                        </Button>
                      </div>
                    ) : null}
                    {p.status === "successful" &&
                    has("pos.refund") &&
                    order.settlement.settled &&
                    p.amountRwf > p.refundedRwf ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="self-start"
                        onPress={() =>
                          setDialog({ kind: "refund", paymentId: p.id, left: p.amountRwf - p.refundedRwf })
                        }
                      >
                        Refund
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Totals and commands */}
          <div className="flex flex-col gap-3 border-t border-separator bg-background/40 p-4">
            <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[13px] tabular">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-right">{money(order.grossRwf)}</dd>
              {order.discountRwf ? (
                <>
                  <dt className="text-muted">Discounts</dt>
                  <dd className="text-right text-success-soft-foreground">−{money(order.discountRwf)}</dd>
                </>
              ) : null}
              <dt className="text-muted">
                VAT {order.taxMode === "inclusive" ? "(included, illustrative)" : "(added, illustrative)"}
              </dt>
              <dd className="text-right">{money(order.taxRwf)}</dd>
              <dt className="mt-1 border-t border-dashed border-separator pt-2 text-[16px] font-bold">Total</dt>
              <dd
                data-ui="grand-total"
                className="mt-1 border-t border-dashed border-separator pt-2 text-right text-[16px] font-bold"
              >
                {money(order.totalRwf)}
              </dd>
              {order.settlement.collectedRwf ? (
                <>
                  <dt className="text-muted">Paid</dt>
                  <dd className="text-right">{money(order.settlement.collectedRwf)}</dd>
                </>
              ) : null}
              {order.settlement.refundedRwf ? (
                <>
                  <dt className="text-muted">Refunded</dt>
                  <dd className="text-right">{money(order.settlement.refundedRwf)}</dd>
                </>
              ) : null}
              {order.settlement.pendingRwf ? (
                <>
                  {/* Display only: started by the customer, NOT paid until the cashier confirms it. */}
                  <dt className="text-warning-soft-foreground" data-ui="waiting-for-cashier-total">
                    Waiting for the cashier
                  </dt>
                  <dd className="text-right text-warning-soft-foreground">{money(order.settlement.pendingRwf)}</dd>
                </>
              ) : null}
              <dt className="font-medium">To pay</dt>
              <dd className="text-right font-medium">{money(order.settlement.outstandingRwf)}</dd>
            </dl>
            {editable ? (
              <div className="grid grid-cols-3 gap-2">
                {has("pos.sell") ? (
                  <Button
                    className="col-span-3 h-12 rounded-2xl text-[15px] font-semibold"
                    size="lg"
                    fullWidth
                    variant={drafts.length ? "primary" : "secondary"}
                    isDisabled={pending || drafts.length === 0}
                    data-ui="send-button"
                    onPress={() => run(() => sendAction(order.id), plan?.done ?? "Sent to the kitchen and bar")}
                  >
                    <PaperPlane className="size-4" />
                    {plan?.label ?? `Send${drafts.length ? ` ${drafts.length} new` : ""}`}
                  </Button>
                ) : null}
                {has("pos.sell") && plan?.lines.length ? (
                  <ul
                    data-ui="send-summary"
                    aria-label="Where the items go"
                    className="col-span-3 -mt-1 flex flex-col items-center gap-0.5 text-[13px] tabular"
                  >
                    {plan.lines.map((l) => (
                      <li key={l} className={/No station set/.test(l) ? "font-medium text-warning" : "text-muted"}>
                        {l}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {has("pos.checkout") ? (
                  <Button
                    className="col-span-3 h-12 rounded-2xl text-[15px] font-semibold"
                    size="lg"
                    fullWidth
                    variant={drafts.length ? "secondary" : "primary"}
                    isDisabled={pending || order.settlement.payableRwf === 0}
                    onPress={() => setDialog({ kind: "pay" })}
                  >
                    <CreditCard className="size-4" />
                    Take payment · {money(order.settlement.payableRwf)}
                  </Button>
                ) : null}
                {/* The waiter's Pay: the customer pays by MTN MoMo or Airtel Money, the cashier confirms it. */}
                {!has("pos.checkout") && has("pos.sell") && order.settlement.outstandingRwf > 0 ? (
                  <Button
                    className="col-span-3 h-12 rounded-2xl text-[15px] font-semibold"
                    size="lg"
                    fullWidth
                    variant={drafts.length || order.settlement.payableRwf === 0 ? "secondary" : "primary"}
                    isDisabled={pending}
                    data-ui="waiter-pay"
                    onPress={() => setDialog({ kind: "mobile" })}
                  >
                    <CreditCard className="size-4" />
                    {order.settlement.payableRwf === 0
                      ? `Waiting for the cashier · ${money(order.settlement.pendingRwf)}`
                      : `Pay · ${money(order.settlement.payableRwf)}`}
                  </Button>
                ) : null}
                {has("pos.discount") || has("pos.override") ? (
                  <Button
                    fullWidth
                    size="sm"
                    variant="secondary"
                    isDisabled={live.length === 0}
                    onPress={() => setDialog({ kind: "discount" })}
                  >
                    <TagDollar className="size-4" />
                    Discount
                  </Button>
                ) : null}
                <Button
                  fullWidth
                  size="sm"
                  variant="secondary"
                  isDisabled={
                    live.length < 2 ||
                    order.payments.some(
                      (p) => p.status !== "failed" && p.status !== "expired" && p.status !== "cancelled",
                    )
                  }
                  onPress={() => setDialog({ kind: "split" })}
                >
                  <Scissors className="size-4" />
                  Split
                </Button>
                {order.orderType === "dine_in" && has("table.manage") ? (
                  <Button fullWidth size="sm" variant="secondary" onPress={() => setDialog({ kind: "transfer" })}>
                    <ArrowRightArrowLeft className="size-4" />
                    Move
                  </Button>
                ) : null}
                <Button
                  fullWidth
                  size="sm"
                  variant="secondary"
                  isDisabled={pending}
                  onPress={() =>
                    run(
                      () => printBillAction(order.id),
                      null,
                      (print) => setDialog({ kind: "bill", print }),
                    )
                  }
                >
                  <Printer className="size-4" />
                  Bill
                </Button>
                {order.settlement.collectedRwf > 0 ? (
                  <Button
                    fullWidth
                    size="sm"
                    variant="secondary"
                    data-ui="receipt-button"
                    onPress={() => setDialog({ kind: "receipt" })}
                  >
                    <Receipt className="size-4" />
                    Receipt
                  </Button>
                ) : null}
                {/* Paid in full, still being served: the customer may already want the receipt by email. */}
                {order.settlement.settled && order.totalRwf > 0 ? (
                  <Button
                    fullWidth
                    size="sm"
                    variant="secondary"
                    data-ui="email-receipt-button"
                    onPress={() => setDialog({ kind: "email" })}
                  >
                    Email receipt
                  </Button>
                ) : null}
                <Button fullWidth size="sm" variant="danger-soft" onPress={() => setDialog({ kind: "cancel" })}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {order.settlement.collectedRwf > 0 ? (
                  <Button
                    className="col-span-2 h-12 rounded-2xl text-[15px] font-semibold"
                    data-ui="receipt-button"
                    onPress={() => setDialog({ kind: "receipt" })}
                  >
                    <Receipt className="size-4" />
                    Customer receipt (EBM)
                  </Button>
                ) : null}
                {order.settlement.settled && order.totalRwf > 0 ? (
                  <Button
                    variant="secondary"
                    className="col-span-2"
                    data-ui="email-receipt-button"
                    onPress={() => setDialog({ kind: "email" })}
                  >
                    Email receipt
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="col-span-2"
                  isDisabled={pending}
                  onPress={() =>
                    run(
                      () => printBillAction(order.id),
                      null,
                      (print) => setDialog({ kind: "bill", print }),
                    )
                  }
                >
                  <Printer className="size-4" />
                  Print bill again
                </Button>
              </div>
            )}
            {order.cancelReason ? <p className="text-[12px] text-danger">Cancelled: {order.cancelReason}</p> : null}
          </div>
        </section>
      </div>

      <RegionOverlays>
        {dialog?.kind === "options" ? (
          <OptionsDialog
            item={dialog.item}
            onClose={() => setDialog(null)}
            onAdd={(line) =>
              run(
                () => addLinesAction(order.id, [line]),
                `${dialog.item.name} added`,
                () => setDialog(null),
              )
            }
            pending={pending}
          />
        ) : null}
        {dialog?.kind === "void" ? (
          <ReasonDialog
            title={`Void ${dialog.line.quantity} × ${dialog.line.name}`}
            subtitle="It has gone to the kitchen. The void is recorded under your name with this reason."
            confirm="Void line"
            danger
            pending={pending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              run(
                () => voidLineAction(order.id, dialog.line.id, reason),
                "Line voided",
                () => setDialog(null),
              )
            }
          />
        ) : null}
        {dialog?.kind === "cancel" ? (
          <ReasonDialog
            title={`Cancel ${order.orderNumber}`}
            subtitle="Lines already sent need a manager. Money collected must be refunded first."
            confirm="Cancel order"
            danger
            pending={pending}
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              run(
                () => cancelAction(order.id, reason),
                "Order cancelled",
                () => setDialog(null),
              )
            }
          />
        ) : null}
        {dialog?.kind === "discount" ? (
          <DiscountDialog
            order={order}
            limitBps={outlet.settings.discountLimitBps}
            override={has("pos.override")}
            pending={pending}
            onClose={() => setDialog(null)}
            onApply={(body) =>
              run(
                () => discountAction(order.id, body),
                (o) =>
                  o.discounts.at(-1)?.status === "pending_approval"
                    ? "Over the limit: waiting for a manager"
                    : "Discount applied",
                () => setDialog(null),
              )
            }
          />
        ) : null}
        {dialog?.kind === "split" ? (
          <SplitDialog
            order={order}
            pending={pending}
            onClose={() => setDialog(null)}
            onSplit={(ids) =>
              run(
                () => splitAction(order.id, ids),
                (o) => `Split into ${o.orderNumber}`,
                (o) => {
                  setDialog(null);
                  router.push(`/pos/till?order=${o.id}`);
                },
              )
            }
          />
        ) : null}
        {dialog?.kind === "transfer" ? (
          <TransferDialog
            tables={tables.filter((t) => t.sessionId && t.sessionId !== order.tableSessionId)}
            pending={pending}
            onClose={() => setDialog(null)}
            onMove={(sessionId, reason) =>
              run(
                () => transferAction(order.id, sessionId, reason),
                "Order moved",
                () => setDialog(null),
              )
            }
          />
        ) : null}
        {dialog?.kind === "pay" ? (
          <PayDialog
            order={order}
            outlet={outlet}
            shift={shift}
            pending={pending}
            onClose={() => {
              setDialog(null);
              // Paid or closed: a cashier who came from the desk goes back to the queue of bills.
              if (startWithPayment) router.push(`/pos/shift?outlet=${outlet.id}`);
            }}
            run={run}
          />
        ) : null}
        {dialog?.kind === "mobile" ? (
          <MobilePayDialog order={order} outlet={outlet} onClose={() => setDialog(null)} />
        ) : null}
        {dialog?.kind === "email" ? (
          <EmailReceiptDialog orderId={order.id} orderNumber={order.orderNumber} onClose={() => setDialog(null)} />
        ) : null}
        {dialog?.kind === "refund" ? (
          <RefundDialog
            left={dialog.left}
            pending={pending}
            onClose={() => setDialog(null)}
            onRefund={(amount, reason, key) =>
              run(
                () => refundAction(dialog.paymentId, amount, reason, key),
                "Refund recorded (simulated for non cash)",
                () => setDialog(null),
              )
            }
          />
        ) : null}
        {dialog?.kind === "bill" ? <BillDialog print={dialog.print} onClose={() => setDialog(null)} /> : null}
        {dialog?.kind === "receipt" ? (
          <ReceiptDialog order={order} outlet={outlet} onClose={() => setDialog(null)} />
        ) : null}
      </RegionOverlays>
    </PosShell>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────────────────────────────────────

function OptionsDialog({
  item,
  onClose,
  onAdd,
  pending,
}: {
  item: PosMenuItem;
  onClose: () => void;
  onAdd: (line: {
    serviceItemId: string;
    quantity: number;
    selectedOptions: { name: string; choices: string[] }[];
    note?: string;
  }) => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(item.options.filter((o) => o.required).map((o) => [o.name, [o.choices[0]?.label ?? ""]])),
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const delta = item.options.reduce(
    (a, o) =>
      a +
      (picked[o.name] ?? []).reduce(
        (b, label) => b + (o.choices.find((c) => c.label === label)?.priceDeltaRwf ?? 0),
        0,
      ),
    0,
  );
  const missing = item.options.filter((o) => o.required && !picked[o.name]?.length);
  const toggle = (name: string, label: string, max: number) =>
    setPicked((p) => {
      const now = p[name] ?? [];
      if (max === 1) return { ...p, [name]: [label] };
      if (now.includes(label)) return { ...p, [name]: now.filter((x) => x !== label) };
      if (now.length >= max) return p;
      return { ...p, [name]: [...now, label] };
    });
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={item.name}
      subtitle={`${money(item.priceRwf)}${item.description ? ` · ${item.description}` : ""}`}
      wide
      footer={
        <>
          <div className="mr-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              isIconOnly
              aria-label="One fewer"
              isDisabled={qty <= 1}
              onPress={() => setQty(qty - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-8 text-center tabular">{qty}</span>
            <Button size="sm" variant="secondary" isIconOnly aria-label="One more" onPress={() => setQty(qty + 1)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={pending || missing.length > 0}
            onPress={() =>
              onAdd({
                serviceItemId: item.id,
                quantity: qty,
                selectedOptions: Object.entries(picked)
                  .filter(([, v]) => v.length)
                  .map(([name, choices]) => ({ name, choices })),
                note: note.trim() || undefined,
              })
            }
          >
            Add · {money((item.priceRwf + delta) * qty)}
          </Button>
        </>
      }
    >
      {item.options.map((o) =>
        // A required option with a single choice is not a question: it is applied (it was picked above) and shown.
        o.required && o.choices.length === 1 ? (
          <p key={o.name} className="text-[13px]">
            <span className="text-muted">{o.name}:</span> {o.choices[0]?.label}
          </p>
        ) : (
          <div key={o.name} className="flex flex-col gap-1.5">
            <Label>
              {o.name}
              {o.required
                ? ` · pick one (${(picked[o.name] ?? [])[0] ?? "none"} selected)`
                : o.maxChoices > 1
                  ? ` · optional, up to ${o.maxChoices}`
                  : " · optional"}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {o.choices.map((c) => (
                <ToggleButton
                  key={c.label}
                  isSelected={(picked[o.name] ?? []).includes(c.label)}
                  onChange={() => toggle(o.name, c.label, o.maxChoices)}
                >
                  {c.label}
                  {o.required && o.maxChoices === 1
                    ? ` · ${money(item.priceRwf + c.priceDeltaRwf)}`
                    : c.priceDeltaRwf
                      ? ` +${money(c.priceDeltaRwf)}`
                      : ""}
                </ToggleButton>
              ))}
            </div>
          </div>
        ),
      )}
      <TextField value={note} onChange={setNote} fullWidth>
        <Label>Kitchen note or allergy (optional)</Label>
        <TextArea rows={2} placeholder="e.g. no ice · nut allergy · well done" />
      </TextField>
    </PosDialog>
  );
}

function ReasonDialog({
  title,
  subtitle,
  confirm,
  danger,
  pending,
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  confirm: string;
  danger?: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 3;
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Keep it
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            isDisabled={!ok || pending}
            onPress={() => onConfirm(reason.trim())}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason (required)</Label>
        <TextArea rows={2} />
      </TextField>
    </PosDialog>
  );
}

function DiscountDialog({
  order,
  limitBps,
  override,
  pending,
  onClose,
  onApply,
}: {
  order: PosOrder;
  limitBps: number;
  override: boolean;
  pending: boolean;
  onClose: () => void;
  onApply: (body: { orderItemId?: string; kind: "amount" | "percent"; value: number; reason: string }) => void;
}) {
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [target, setTarget] = useState("order");
  const [reason, setReason] = useState("");
  const n = parseRwf(value);
  const ok = n !== null && n > 0 && reason.trim().length >= 3 && (kind === "amount" || n <= 100);
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Discount"
      subtitle={`Up to ${limitBps / 100}% applies at once${override ? "; as a manager yours apply at any size" : "; above that a manager approves"}.`}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={!ok || pending}
            onPress={() =>
              onApply({
                orderItemId: target === "order" ? undefined : target,
                kind,
                value: kind === "percent" ? (n as number) * 100 : (n as number),
                reason: reason.trim(),
              })
            }
          >
            Apply
          </Button>
        </>
      }
    >
      <Segment
        aria-label="Discount kind"
        selectedKey={kind}
        onSelectionChange={(k) => setKind(k === "amount" ? "amount" : "percent")}
      >
        <Segment.Item id="percent">Percent</Segment.Item>
        <Segment.Item id="amount">Amount (RWF)</Segment.Item>
      </Segment>
      <TextField value={value} onChange={setValue} fullWidth>
        <Label>{kind === "percent" ? "Percent" : "Amount in RWF"}</Label>
        <Input inputMode="numeric" className="tabular" />
      </TextField>
      <div className="flex flex-col gap-1.5">
        <Label>On</Label>
        <div className="flex flex-wrap gap-1.5">
          <ToggleButton isSelected={target === "order"} onChange={() => setTarget("order")}>
            The whole order
          </ToggleButton>
          {order.lines
            .filter((l) => l.status !== "voided")
            .map((l) => (
              <ToggleButton key={l.id} isSelected={target === l.id} onChange={() => setTarget(l.id)}>
                {l.quantity} × {l.name}
              </ToggleButton>
            ))}
        </div>
      </div>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason (required)</Label>
        <Input />
      </TextField>
    </PosDialog>
  );
}

function SplitDialog({
  order,
  pending,
  onClose,
  onSplit,
}: {
  order: PosOrder;
  pending: boolean;
  onClose: () => void;
  onSplit: (ids: string[]) => void;
}) {
  const lines = order.lines.filter((l) => l.status !== "voided");
  const [chosen, setChosen] = useState<string[]>([]);
  const total = lines.filter((l) => chosen.includes(l.id)).reduce((a, l) => a + l.totalRwf, 0);
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Split the bill"
      subtitle="The chosen lines move to a new bill on the same table, paid on its own."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={pending || chosen.length === 0 || chosen.length === lines.length}
            onPress={() => onSplit(chosen)}
          >
            New bill · {money(total)}
          </Button>
        </>
      }
    >
      {lines.map((l) => (
        <Checkbox
          key={l.id}
          isSelected={chosen.includes(l.id)}
          onChange={(on) => setChosen(on ? [...chosen, l.id] : chosen.filter((x) => x !== l.id))}
        >
          <Checkbox.Content className="gap-2">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            {l.quantity} × {l.name} · {money(l.totalRwf)}
          </Checkbox.Content>
        </Checkbox>
      ))}
    </PosDialog>
  );
}

function TransferDialog({
  tables,
  pending,
  onClose,
  onMove,
}: {
  tables: PosTable[];
  pending: boolean;
  onClose: () => void;
  onMove: (sessionId: string, reason: string) => void;
}) {
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Move this order to another table"
      subtitle="Only tables with seated guests are listed."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={pending || !to || reason.trim().length < 3}
            onPress={() => to && onMove(to, reason.trim())}
          >
            Move order
          </Button>
        </>
      }
    >
      {tables.length === 0 ? <p className="text-[13px] text-muted">No other table has guests seated.</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {tables.map((t) => (
          <ToggleButton key={t.id} isSelected={to === t.sessionId} onChange={() => setTo(t.sessionId)}>
            {t.label}
          </ToggleButton>
        ))}
      </div>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason (required)</Label>
        <Input />
      </TextField>
    </PosDialog>
  );
}

function PayDialog({
  order,
  outlet,
  shift,
  pending,
  onClose,
  run,
}: {
  order: PosOrder;
  outlet: PosOutlet;
  shift: PosShift | null;
  pending: boolean;
  onClose: () => void;
  run: ReturnType<typeof usePosAction>["run"];
}) {
  const methods = outlet.settings.enabledMethods.filter((m) => m !== "customer_credit");
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? "cash");
  const [amount, setAmount] = useState(String(order.settlement.payableRwf));
  const [tendered, setTendered] = useState("");
  const [tip, setTip] = useState("");
  const [phone, setPhone] = useState("");
  const [voucher, setVoucher] = useState("");
  const [outcome, setOutcome] = useState<"success" | "pending" | "failure" | "timeout">("success");
  const [key, nextKey] = usePressKey();
  const amountRwf = parseRwf(amount) ?? 0;
  const tipRwf = parseRwf(tip) ?? 0;
  const tenderedRwf = parseRwf(tendered);
  const change = method === "cash" && tenderedRwf ? tenderedRwf - amountRwf - tipRwf : 0;
  const cashBlocked = method === "cash" && !shift;
  const mobile = isMobileMethod(method);
  const phoneDigits = phone.replace(/\D/g, "").length;
  const ok =
    amountRwf > 0 &&
    amountRwf <= order.settlement.payableRwf &&
    !cashBlocked &&
    (!mobile || (phoneDigits >= 9 && phoneDigits <= 15)) &&
    (method !== "cash" || !tenderedRwf || change >= 0) &&
    (method !== "voucher" || voucher.trim().length >= 3);
  // Payments sent to a (simulated) provider and not answered yet: they hold part or all of the bill.
  const waiting = order.payments.filter((p) => p.status === "pending" || p.status === "initiated");
  // Everything still owed is held by those payments: nothing new can be taken until they are answered.
  const onlyWaiting = order.settlement.payableRwf === 0 && waiting.length > 0;
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={
        onlyWaiting
          ? `Take payment · ${money(order.settlement.outstandingRwf)} waiting for the provider`
          : `Take payment · ${money(order.settlement.payableRwf)} to pay`
      }
      subtitle={`${order.orderNumber} · total ${money(order.totalRwf)}`}
      wide
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
          {onlyWaiting ? null : (
            <Button
              size="lg"
              isDisabled={!ok || pending}
              onPress={() =>
                run(
                  () =>
                    payAction(
                      order.id,
                      {
                        method,
                        amountRwf,
                        tenderedRwf: method === "cash" && tenderedRwf ? tenderedRwf : undefined,
                        tipRwf: tipRwf || undefined,
                        // MoMo and Airtel are never answered by a simulation: they wait for the cashier's check.
                        simulate: method === "cash" || method === "voucher" || mobile ? undefined : outcome,
                        payerPhone: method === "mtn_momo" || method === "airtel_money" ? phone : undefined,
                        voucherCode: method === "voucher" ? voucher.trim() : undefined,
                      },
                      key,
                    ),
                  (o) => {
                    const p = o.payments.at(-1);
                    return p?.status === "successful"
                      ? "Payment recorded"
                      : p?.status === "pending"
                        ? p && isMobileMethod(p.method)
                          ? "Pending: confirm it on the Cashier Desk once the money arrives"
                          : "Waiting for the simulated provider"
                        : `Payment ${p?.status ?? "recorded"}`;
                  },
                  (o) => {
                    nextKey();
                    if (o.settlement.payableRwf === 0) onClose();
                    else setAmount(String(o.settlement.payableRwf));
                  },
                )
              }
            >
              Take {money(amountRwf)}
            </Button>
          )}
        </>
      }
    >
      {waiting.length ? (
        <div data-ui="waiting-payments" className="flex flex-col gap-2 rounded-xl bg-warning-soft p-3 text-[13px]">
          <p className="font-medium text-warning-soft-foreground">
            {onlyWaiting
              ? "This bill is covered by a payment that is not confirmed yet. Confirm it to settle the bill, or mark it not received to take another payment."
              : "Part of this bill is held by a payment that is not confirmed yet."}
          </p>
          {waiting.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{METHOD_LABEL[p.method]}</span>
              <span className="tabular">{money(p.amountRwf)}</span>
              <span className="tabular text-muted">{p.demoReference}</span>
              {isMobileMethod(p.method) ? (
                <span className="ml-auto">
                  <LinkButton href={`/pos/shift?outlet=${outlet.id}`} size="sm">
                    Confirm on the Cashier Desk
                  </LinkButton>
                </span>
              ) : (
                <span className="ml-auto flex flex-wrap gap-1">
                  {(["success", "failure", "timeout"] as const).map((outcome) => (
                    <Button
                      key={outcome}
                      size="sm"
                      variant={outcome === "success" ? "primary" : "secondary"}
                      isDisabled={pending}
                      onPress={() =>
                        run(
                          () => resolvePaymentAction(p.id, outcome),
                          outcome === "success"
                            ? "Simulated: confirmed"
                            : outcome === "failure"
                              ? "Simulated: declined"
                              : "Simulated: timed out",
                          (o) => {
                            if (o.settlement.outstandingRwf === 0) onClose();
                            else setAmount(String(o.settlement.payableRwf));
                          },
                        )
                      }
                    >
                      {outcome === "success" ? "Confirm" : outcome === "failure" ? "Decline" : "Time out"}
                    </Button>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {onlyWaiting ? null : (
        <>
          <SimulationNotice>
            {method === "cash"
              ? "Cash is recorded in your drawer."
              : mobile
                ? "The customer pays from their own phone. The payment stays pending until you see the money arrive and confirm it on the Cashier Desk."
                : "This method is simulated: no money moves and no provider is contacted."}
          </SimulationNotice>
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m) => (
              <ToggleButton key={m} isSelected={method === m} onChange={() => setMethod(m)}>
                {METHOD_LABEL[m]}
              </ToggleButton>
            ))}
          </div>
          {cashBlocked ? <p className="text-[13px] text-danger">Open your cashier shift before taking cash.</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <TextField value={amount} onChange={setAmount} fullWidth>
              <Label>Amount toward the bill (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            <TextField value={tip} onChange={setTip} fullWidth>
              <Label>Tip (RWF, optional)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            {method === "cash" ? (
              <TextField value={tendered} onChange={setTendered} fullWidth>
                <Label>Cash handed over</Label>
                <Input inputMode="numeric" className="tabular" />
              </TextField>
            ) : null}
            {method === "cash" && tenderedRwf ? (
              <p className={`self-end pb-2 text-[15px] font-semibold tabular ${change < 0 ? "text-danger" : ""}`}>
                {change < 0 ? `Short ${money(-change)}` : `Change ${money(change)}`}
              </p>
            ) : null}
            {method === "mtn_momo" || method === "airtel_money" ? (
              <TextField value={phone} onChange={setPhone} fullWidth>
                <Label>Customer's phone (the one they pay from)</Label>
                <Input inputMode="tel" placeholder="078 812 3456" />
              </TextField>
            ) : null}
            {method === "voucher" ? (
              <TextField value={voucher} onChange={setVoucher} fullWidth>
                <Label>Voucher code</Label>
                <Input />
              </TextField>
            ) : null}
          </div>
          {method !== "cash" && method !== "voucher" && !mobile ? (
            <div className="flex flex-col gap-1.5">
              <Label>The simulated provider answers</Label>
              <Segment
                aria-label="Simulated outcome"
                selectedKey={outcome}
                onSelectionChange={(k) => setOutcome(String(k) as typeof outcome)}
              >
                <Segment.Item id="success">
                  {ASYNC.includes(method) ? "Approve (after waiting)" : "Approve"}
                </Segment.Item>
                <Segment.Item id="pending">Leave pending</Segment.Item>
                <Segment.Item id="failure">Decline</Segment.Item>
                <Segment.Item id="timeout">Time out</Segment.Item>
              </Segment>
            </div>
          ) : null}
        </>
      )}
    </PosDialog>
  );
}

function RefundDialog({
  left,
  pending,
  onClose,
  onRefund,
}: {
  left: number;
  pending: boolean;
  onClose: () => void;
  onRefund: (amount: number, reason: string, key: string) => void;
}) {
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [key] = usePressKey();
  const n = parseRwf(amount) ?? 0;
  const ok = n > 0 && n <= left && reason.trim().length >= 3;
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Refund"
      subtitle={`Up to ${money(left)} of this payment. Recorded under your name with the reason.`}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="danger" isDisabled={!ok || pending} onPress={() => onRefund(n, reason.trim(), key)}>
            Refund {money(n)}
          </Button>
        </>
      }
    >
      <SimulationNotice>
        A refund of a non cash payment is simulated. A cash refund comes out of your open shift.
      </SimulationNotice>
      <TextField value={amount} onChange={setAmount} fullWidth>
        <Label>Amount (RWF)</Label>
        <Input inputMode="numeric" className="tabular" />
      </TextField>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason (required)</Label>
        <Input />
      </TextField>
    </PosDialog>
  );
}

function BillDialog({ print, onClose }: { print: BillPrint; onClose: () => void }) {
  const p = print.payload;
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Bill · ${p.copy}`}
      subtitle="Simulated print: no printer is contacted."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
          <Button onPress={() => window.print()}>
            <Printer className="size-4" />
            Print this page
          </Button>
        </>
      }
    >
      <Card className="gap-1 p-4 font-mono text-[12px]">
        <p className="border border-danger p-1 text-center font-bold text-danger">{p.stamp}</p>
        <p className="text-center">{p.header}</p>
        <p className="text-center">
          {p.orderNumber}
          {p.table ? ` · Table ${p.table}` : ""}
        </p>
        <hr className="my-1 border-separator" />
        {p.lines.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a printed bill is static; two identical lines may repeat
          <p key={`${l.name}-${i}`} className="flex justify-between gap-2">
            <span>
              {l.quantity} × {l.name}
            </span>
            <span className="tabular">{money(l.totalRwf)}</span>
          </p>
        ))}
        <hr className="my-1 border-separator" />
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular">{money(p.grossRwf)}</span>
        </p>
        {p.discountRwf ? (
          <p className="flex justify-between">
            <span>Discount</span>
            <span className="tabular">−{money(p.discountRwf)}</span>
          </p>
        ) : null}
        <p className="flex justify-between">
          <span>VAT {p.taxMode === "inclusive" ? "included" : "added"} (illustrative)</span>
          <span className="tabular">{money(p.taxRwf)}</span>
        </p>
        <p className="flex justify-between font-bold">
          <span>Total</span>
          <span className="tabular">{money(p.totalRwf)}</span>
        </p>
        <p className="flex justify-between">
          <span>Paid</span>
          <span className="tabular">{money(p.collectedRwf)}</span>
        </p>
        <p className="flex justify-between">
          <span>To pay</span>
          <span className="tabular">{money(p.outstandingRwf)}</span>
        </p>
        <hr className="my-1 border-separator" />
        <p className="text-center">{p.footer}</p>
        <p className="text-center font-bold text-danger">{p.stamp}</p>
      </Card>
    </PosDialog>
  );
}
