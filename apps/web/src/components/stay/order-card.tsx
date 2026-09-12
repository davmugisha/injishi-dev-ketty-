"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import { formatRwf } from "@/lib/money";
import {
  cancelOrder,
  orderItemCount,
  shortOrderRef,
  type RoomOrder,
} from "@/lib/order-store";
import { formatOrderTime, itemCountLabel } from "./stay-format";
import { isOrderOpen, OrderProgress, OrderStateBadge } from "./order-progress";

/**
 * One room order, as the guest who placed it reads it.
 *
 * THE ROOM IS ON THE CARD even though every card on the hub carries the same
 * room. It is the one fact a guest checks when a tray is late, and a card that
 * omits it forces them back to the header to confirm the order did not go
 * somewhere else. It is read off `order.room` — the value frozen onto the order
 * when it was placed — rather than off the current stay, so an order placed
 * from room 412 still says 412 after a room move.
 *
 * TRACKING LIVES IN THE CHAT, and this card does not duplicate it. The link
 * goes to the thread the store already wrote the system line into, which is why
 * `threadId` is on the order at all. A second tracker here would be a second
 * place for the state to be wrong.
 *
 * CANCEL IS OFFERED ONLY WHILE THE ORDER IS OPEN. `cancelOrder` posts the
 * cancellation into the same thread in the same call, so there is no path that
 * cancels an order quietly.
 */
export function OrderCard({ order }: { order: RoomOrder }) {
  const count = orderItemCount(order.lines);

  return (
    <li className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="money font-display text-base font-bold tracking-tight">
              {shortOrderRef(order)}
            </h3>
            <OrderStateBadge state={order.state} />
          </div>
          <p className="money mt-1 text-xs text-muted-foreground">
            Room {order.room} · placed {formatOrderTime(order.placedAt)} ·{" "}
            {itemCountLabel(count)}
          </p>
        </div>
        <p className="money font-display text-lg font-bold">{formatRwf(order.totalRwf)}</p>
      </div>

      <ul className="mt-4 space-y-1.5">
        {order.lines.map((line) => (
          <li
            key={line.productSlug}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="min-w-0">
              <span className="money text-muted-foreground">{line.qty} ×</span>{" "}
              {line.name}
            </span>
            <span className="money shrink-0 text-muted-foreground">
              {formatRwf(line.priceRwf * line.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <OrderProgress state={order.state} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/inbox/${order.threadId}`}>
            <Icon name="message-square" className="h-4 w-4" />
            Follow it in the kitchen chat
          </a>
        </Button>
        {isOrderOpen(order.state) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cancelOrder(order.id)}
          >
            Cancel this order
          </Button>
        ) : null}
      </div>
    </li>
  );
}
