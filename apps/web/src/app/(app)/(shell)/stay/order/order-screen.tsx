"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderableList, PlaceOrderResult } from "@injishi/contracts";
import { Button, Skeleton } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { EmptyPanel } from "@/components/app/empty-panel";
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
import { apiResultMessage, type ApiResult } from "@/lib/api";

/**
 * Order food and drink: every outlet the guest may order from right now, its
 * live menu, a cart and one button (ADR-050 D-n, D-o, AC-19, AC-21, AC-22).
 *
 * `GET /api/v1/me/orderable` DECIDES WHAT IS SHOWN. The browser decides nothing
 * about policy, hours or stock: an outlet that is closed, or that this guest
 * may not order from, is simply absent. When the menu goes stale while the
 * screen is open, the server's refusal is shown in its own words and the menu
 * is read again.
 *
 * THIS IS THE MENU-FIRST PATH: the guest came from `/stay` or a property page
 * to browse, and ordering is the whole screen. The other path is a guest
 * already talking to the property, who orders inside the conversation without
 * leaving it (`components/app/order-composer.tsx`). Both run on the same order:
 * `useOrderDraft` holds the cart, the settlement rules, the estimate and the
 * idempotency key, and `order-menu.tsx` holds the pieces that look the same in
 * both. What differs is the arrangement and where a placed order takes you —
 * this screen navigates, the composer stays put.
 */
export function OrderScreen({ threadId }: { threadId?: string } = {}) {
  const router = useRouter();
  const [orderable, setOrderable] = useState<ApiResult<OrderableList> | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setOrderable(await fetchOrderable());
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const outlets = orderable?.status === "ok" ? orderable.data.outlets : [];
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];

  const finish = useCallback(
    (placed: PlaceOrderResult) => {
      // An order placed from a conversation goes back to it, where its card is.
      router.push(
        threadId
          ? `/inbox/${encodeURIComponent(threadId)}`
          : `/stay?placed=${encodeURIComponent(placed.id)}`,
      );
    },
    [router, threadId],
  );

  const draft = useOrderDraft({
    outlet,
    threadId,
    onPlaced: finish,
    onMenuStale: () => void loadMenu(),
  });

  if (draft.waiting) {
    const placed = draft.waiting;
    return (
      <PaymentWait
        placed={placed}
        doneLabel={threadId ? "Back to the conversation" : "Follow it on My stay"}
        onDone={() => finish(placed)}
        onBack={draft.closeWait}
      />
    );
  }

  if (orderable === null) return <MenuLoading />;

  if (orderable.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to order"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Fstay%2Forder" }}
      >
        Orders go on your own bill or your own phone, so ordering needs you signed in.
      </EmptyPanel>
    );
  }

  if (orderable.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t load what&apos;s on
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(orderable)}
        </p>
        <Button className="mt-2" onClick={() => void loadMenu()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!outlet) {
    return (
      <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8 sm:px-6">
        <BackToStay />
        <EmptyPanel icon="coffee" title="Nothing to order from right now" action={{ label: "Back to my stay", href: "/stay" }}>
          No outlet is taking orders from you at the moment. Ordering to your
          room opens once a front desk has checked you in, and an outlet that is
          closed appears here when it opens.
        </EmptyPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-block px-4 py-8 sm:px-6">
      <BackToStay />

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Order food and drink</h1>
        <p className="mt-1 text-sm text-muted-foreground">{outlet.propertyName}</p>
      </header>

      {outlets.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Choose where to order from">
          {outlets.map((o) => {
            // Each outlet keeps its own cart, so switching to compare menus
            // never empties the one already filled.
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

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <MenuList outlet={outlet} draft={draft} />
        </div>

        <aside className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="font-display text-lg font-bold tracking-tight">Your order</h2>

          {draft.summary.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in it yet. Add something from the menu and it appears here
              before anything is sent.
            </p>
          ) : (
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <span className="text-sm text-muted-foreground">{itemCountLabel(draft.summary.count)}</span>
              <span className="text-right">
                <span className="money block font-display text-xl font-bold">
                  {formatPrice(draft.summary.subtotalRwf)}
                </span>
                <span className="text-xs text-muted-foreground">before tax; the order shows the total</span>
              </span>
            </div>
          )}

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
        </aside>
      </div>
    </div>
  );
}

function BackToStay() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href="/stay">
        <Icon name="arrow-left" className="size-4" />
        My stay
      </Link>
    </Button>
  );
}

function MenuLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Getting what&apos;s on
      </span>
      <Skeleton className="h-8 w-56 rounded" />
      <Skeleton className="h-16 rounded-card" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-card lg:col-span-2" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}
