"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import { formatRwf } from "@/lib/money";
import {
  orderItemCount,
  orderSummary,
  shortOrderRef,
  type RoomOrder,
} from "@/lib/order-store";
import { formatOrderTime, itemCountLabel } from "./stay-format";

/**
 * What the guest sees the moment an order exists.
 *
 * IT ANSWERS THE THREE QUESTIONS A PERSON ACTUALLY HAS: what did I order, where
 * is it going, and how do I find out what is happening to it. The reference and
 * the room are the two things a guest reads out on the telephone, so they are
 * the two largest things on the panel.
 *
 * THE CHAT LINK IS THE PRIMARY ACTION, not a footnote. Order tracking in this
 * product happens inside the department conversation — the store wrote the
 * first system line into that thread in the same call that created the order —
 * so sending the guest anywhere else would leave them watching a screen that
 * never changes.
 *
 * IT DOES NOT CLAIM ANYTHING HAPPENED IN A KITCHEN. "Sent to the kitchen desk"
 * is what the software did; "we are preparing your food" is what a hotel would
 * do, and this demo has no hotel. The screen this sits on carries the demo
 * notice as well, which is what makes the difference readable.
 */
export function OrderPlaced({
  order,
  propertyName,
  onOrderMore,
}: {
  order: RoomOrder;
  propertyName: string;
  onOrderMore: () => void;
}) {
  return (
    <section className="rounded-card border border-accent-brand bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-accent text-accent-foreground">
          <Icon name="circle-check" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {shortOrderRef(order)} is with the kitchen desk
          </h2>
          <p className="money mt-1 text-sm text-muted-foreground">
            Room {order.room} · {propertyName} · sent {formatOrderTime(order.placedAt)}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Ordered
          </dt>
          <dd className="mt-1 text-sm">{orderSummary(order)}</dd>
        </div>
        <div>
          <dt className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Items
          </dt>
          <dd className="money mt-1 text-sm">
            {itemCountLabel(orderItemCount(order.lines))}
          </dd>
        </div>
        <div>
          <dt className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Total
          </dt>
          <dd className="money mt-1 font-display text-lg font-bold">
            {formatRwf(order.totalRwf)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="primary">
          <a href={`/inbox/${order.threadId}`}>
            <Icon name="message-square" className="h-4 w-4" />
            Track it in the kitchen chat
          </a>
        </Button>
        <Button variant="outline" onClick={onOrderMore}>
          Order something else
        </Button>
        <Button asChild variant="ghost">
          <a href="/stay">Back to my stay</a>
        </Button>
      </div>
    </section>
  );
}
