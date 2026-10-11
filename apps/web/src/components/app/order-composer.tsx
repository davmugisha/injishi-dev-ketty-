"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuestThread, OrderableList, PlaceOrderResult } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { Icon } from "@/components/app/icon";
import { useOrderDraft } from "@/components/app/order-draft";
import {
  MenuList,
  OrderNoteField,
  OutletHeader,
  PaymentWait,
  SettlementPicker,
} from "@/components/app/order-menu";
import { fetchOrderable, itemCountLabel } from "@/data/ordering";
import { type ApiResult } from "@/lib/api";
import { mayAskOrderable, threadOrdering } from "@/lib/thread-ordering";

/**
 * Ordering INSIDE the conversation (ADR-050 D-n, D-s).
 *
 * WHAT THIS REPLACED was a link. The conversation screen rendered
 * `<Link href="/stay/order?thread=…">`, which took the guest to another route,
 * a 650 line menu screen, and pushed them back when they were done. A guest
 * mid-sentence with the front desk lost the sentence. "Order on chat" is the
 * thing that was asked for and a link out is not it.
 *
 * WHETHER TO OFFER IT AT ALL IS THE SERVER'S ANSWER, and that is the second
 * half of the fix. The old screen decided from the thread's own shape —
 * `scope === "stay" || kind === "department_request"` — so a guest checked in
 * at Amahoro, with their booking's `reservation` thread open, was offered
 * nothing while `GET /me/orderable` would have answered with an outlet. Here
 * the question is asked (`?propertyId=` this conversation's property) and
 * `threadOrdering` reads the answer. No outlet, no composer; an outlet, a
 * composer — whatever kind of thread it is.
 *
 * IT NEVER NAVIGATES. Placing the order leaves the guest exactly where they
 * were; the conversation then gains the `system` line and the order card it
 * already knows how to render, because `POST /me/orders` was given this
 * thread's id. `apps/web/tests/no-order-navigation.check.mjs` is the gate on
 * that, and it asserts the replacement exists as well as the link's absence.
 *
 * The cart, the estimate, the settlement rules and the idempotency key are
 * `useOrderDraft`'s — the same ones `/stay/order` runs on, so the two paths
 * cannot price the same coffee differently.
 */
export function OrderComposer({
  thread,
  onPlaced,
}: {
  thread: GuestThread;
  /** An order landed: re-read the conversation so its card appears at once. */
  onPlaced: () => void;
}) {
  const [answer, setAnswer] = useState<ApiResult<OrderableList> | null>(null);
  const [open, setOpen] = useState(false);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<PlaceOrderResult | null>(null);

  const askable = mayAskOrderable(thread);
  const propertyId = thread.propertyId;

  const load = useCallback(async () => {
    if (!askable || propertyId === null) return;
    setAnswer(await fetchOrderable(propertyId));
  }, [askable, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordering = threadOrdering(thread, answer);
  const outlets = ordering.state === "offered" ? ordering.outlets : [];
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];

  const settled = useCallback(
    (placed: PlaceOrderResult) => {
      setOpen(false);
      setConfirmed(placed);
      onPlaced();
    },
    [onPlaced],
  );

  const draft = useOrderDraft({
    outlet,
    threadId: thread.id,
    onPlaced: settled,
    onMenuStale: () => void load(),
  });

  // A mobile money order waits on the handset. It takes over the strip rather
  // than the page: the conversation above stays readable, which is the whole
  // reason ordering moved in here.
  if (draft.waiting) {
    const placed = draft.waiting;
    return (
      <section className="rounded-card border border-border bg-card">
        <PaymentWait
          placed={placed}
          doneLabel="Back to the conversation"
          onDone={() => {
            draft.closeWait();
            settled(placed);
          }}
          onBack={draft.closeWait}
        />
      </section>
    );
  }

  /*
   * Nothing to offer, so nothing is rendered — not a disabled button and not
   * an explanation. "You cannot order here" under every conversation with a
   * hotel is noise in the 95% of threads that were never about food, and the
   * guest did not ask. The affordance appears exactly when the server says an
   * outlet would take the order.
   */
  if (ordering.state !== "offered" || !outlet) {
    return confirmed ? <Placed placed={confirmed} onDismiss={() => setConfirmed(null)} /> : null;
  }

  /*
   * A DISCLOSURE, and the strip above it never unmounts.
   *
   * The obvious build — press the button, the strip becomes the panel — loses
   * keyboard focus the moment it works: the button the person just activated
   * is removed from the document, so focus falls back to <body> and the next
   * Tab starts again from the top of the page. Keeping the trigger where it is
   * means focus never moves, `aria-expanded` is true of something that is
   * actually on screen, and closing returns the reader to the control they
   * opened it with.
   */
  return (
    <section className="flex flex-col gap-3">
      {confirmed ? <Placed placed={confirmed} onDismiss={() => setConfirmed(null)} /> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-secondary p-inset text-secondary-foreground">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-card">
          <Icon name="coffee" className="size-5" />
        </span>
        <div className="min-w-0 grow">
          <h2 className="text-sm font-semibold">
            {outlets.some((o) => o.chargeToRoom) ? "Order to your room" : "Order food and drink"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {outlets.length === 1
              ? `${outlet.name} is taking orders. It arrives in this conversation.`
              : `${outlets.length} outlets are taking orders. It arrives in this conversation.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide the menu" : "See the menu"}
        </Button>
      </div>

      {/*
        Inline rather than extracted into a `<Panel/>` defined in this
        function: a component declared inside a render is a NEW type on every
        render, so React unmounts and remounts the whole subtree each time —
        which would reset the menu's scroll position on every keystroke in the
        note field.
      */}
      {open ? (
        <div className="flex animate-settle-in flex-col gap-4 rounded-card border border-border bg-card p-inset">
          {outlets.length > 1 ? (
            <nav className="flex flex-wrap gap-2" aria-label="Choose where to order from">
              {outlets.map((o) => {
                // Each outlet keeps its own cart, so comparing two menus never
                // empties the one already filled.
                const count = draft.cartCount(o);
                return (
                  <Button
                    key={o.id}
                    size="sm"
                    variant={o.id === outlet.id ? "primary" : "outline"}
                    aria-pressed={o.id === outlet.id}
                    onClick={() => setOutletId(o.id)}
                  >
                    {o.name}
                    {count > 0 ? ` (${count})` : ""}
                  </Button>
                );
              })}
            </nav>
          ) : null}

          <OutletHeader outlet={outlet} />

          {/*
            The menu scrolls inside the panel rather than pushing the
            conversation off the screen. A dinner menu is forty rows and the
            messages above are the context the guest is ordering from — losing
            them to reach the coffee is the same mistake as navigating away,
            made slower.

            `h3` for the categories: the page's `h1` is the thread title and
            the strip's own title is the `h2`, so a category sits one below it.
          */}
          <div className="max-h-96 overflow-y-auto">
            <MenuList outlet={outlet} draft={draft} categoryAs="h3" />
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            {draft.summary.count > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {itemCountLabel(draft.summary.count)}
                </span>
                <span className="text-right">
                  <span className="money block font-display text-xl font-bold">
                    {formatPrice(draft.summary.subtotalRwf)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    before tax; the order shows the total
                  </span>
                </span>
              </div>
            ) : null}

            <SettlementPicker draft={draft} />
            <OrderNoteField draft={draft} />

            {draft.choiceProblem && draft.summary.count > 0 ? (
              <p className="text-sm text-muted-foreground">{draft.choiceProblem}</p>
            ) : null}

            {draft.refusal ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                <Icon name="triangle-alert" className="mt-0.5 size-4 shrink-0" />
                <span>{draft.refusal}</span>
              </p>
            ) : null}

            <Button fullWidth disabled={!draft.canPlace} onClick={() => void draft.place()}>
              {draft.busy
                ? "Placing…"
                : draft.summary.count === 0
                  ? "Add something first"
                  : `Place order at ${outlet.name}`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The order landed.
 *
 * The real confirmation is the card that appears in the conversation a moment
 * later, which is where the order lives from now on. This line exists for the
 * moment before that — and for a screen reader, which otherwise gets no
 * announcement at all when a panel closes and content arrives further up.
 */
function Placed({ placed, onDismiss }: { placed: PlaceOrderResult; onDismiss: () => void }) {
  return (
    <p
      role="status"
      className="flex animate-settle-in items-start gap-2 rounded-card border border-border bg-secondary p-inset text-sm text-secondary-foreground"
    >
      <Icon name="circle-check" className="mt-0.5 size-4 shrink-0" />
      <span className="grow">
        Order <span className="money">{placed.orderNumber}</span> is with {placed.outletName}. It
        is in this conversation now.
      </span>
      <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="x" className="size-4" />
      </Button>
    </p>
  );
}
