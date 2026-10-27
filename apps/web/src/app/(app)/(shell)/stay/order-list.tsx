"use client";

import { useState } from "react";
import type { GuestOrder } from "@injishi/contracts";
import { Badge, Button } from "@injishi/web-ui";
import { formatPrice } from "@injishi/utils";
import { Icon } from "@/components/app/icon";
import {
  cancelMyOrder,
  itemCountLabel,
  ORDER_STATUS_LABEL,
  orderTone,
} from "@/data/ordering";
import { apiResultMessage } from "@/lib/api";

const TONE_BADGE = {
  open: "accent",
  done: "success",
  stopped: "danger",
} as const;

const KIGALI_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Kigali",
});

/** "14 Sep, 19:42", read in Kigali: every outlet on the platform is there. */
function placedAt(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : KIGALI_TIME.format(at);
}

/**
 * The guest's orders as `GET /api/v1/me/orders` returned them.
 *
 * Every figure is the order's LOCKED snapshot (AC-23): editing the menu never
 * changes an order already placed, so nothing here re-prices a line. The status
 * is the server's; `onChanged` asks the caller to read the list again after a
 * cancel, rather than editing the row locally.
 *
 * Cancel is offered only where the server says `cancellable`. A paid order never
 * is: cancelling it is a refund, which only the outlet can make (D-n).
 */
export function OrderList({
  orders,
  onChanged,
  highlightId,
}: {
  orders: GuestOrder[];
  onChanged: () => void;
  highlightId?: string | null;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderRow order={order} onChanged={onChanged} highlighted={order.id === highlightId} />
        </li>
      ))}
    </ul>
  );
}

function OrderRow({
  order,
  onChanged,
  highlighted,
}: {
  order: GuestOrder;
  onChanged: () => void;
  highlighted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const count = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await cancelMyOrder(order.id);
    setBusy(false);
    if (result.status === "ok") onChanged();
    else setProblem(apiResultMessage(result));
  };

  return (
    <article
      className={`rounded-card border bg-card p-inset ${
        highlighted ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-card-foreground">
            {order.outletName}
          </h3>
          <p className="money mt-1 text-sm text-muted-foreground">
            {order.propertyName} · Order {order.orderNumber} · {placedAt(order.createdAt)}
          </p>
        </div>
        <Badge variant={TONE_BADGE[orderTone(order.status)]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-sm">
        {order.lines.map((line, index) => (
          <li key={`${line.name}-${index}`} className="flex justify-between gap-3">
            <span className="min-w-0">
              {line.quantity} × {line.name}
              {line.selectedOptions.length > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  ({line.selectedOptions.flatMap((o) => o.choices.map((c) => c.label)).join(", ")})
                </span>
              ) : null}
            </span>
            <span className="money shrink-0">{formatPrice(line.lineTotalRwf)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <span className="money text-sm">
          {itemCountLabel(count)} · <b>{formatPrice(order.totalRwf)}</b>{" "}
          <span className="text-muted-foreground">incl. {formatPrice(order.taxRwf)} tax</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {order.context === "in_house_folio"
            ? "On your room bill"
            : order.paidAt
              ? "Paid"
              : "Pay at the counter or on your phone"}
        </span>
        <span className="grow" />
        {order.cancellable ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void cancel()}>
            {busy ? "Cancelling…" : "Cancel order"}
          </Button>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-destructive">
          <Icon name="triangle-alert" className="mt-0.5 size-4 shrink-0" />
          <span>{problem}</span>
        </p>
      ) : null}
    </article>
  );
}
