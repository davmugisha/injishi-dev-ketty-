"use client";

/**
 * One room-service ticket, as a runner and a kitchen read it.
 *
 * THE ROOM LEADS, and nothing else competes with it. An order that reaches the
 * right room late is a complaint; one that reaches the wrong room is a stranger
 * opening their door to somebody else's dinner. The reference and the guest's
 * name sit under it because they settle a dispute, not because they route the
 * tray.
 *
 * THE LINES ARE THE ORDER'S OWN SNAPSHOT, never today's menu. The Menu lens can
 * reprice a dish while this ticket is on the board and the total here will not
 * move — which is what makes repricing mid-service safe, and what makes a bill
 * defensible afterwards.
 *
 * ONE FORWARD BUTTON, ONE SIDEWAYS ONE. `advanceOrder` walks the flow a step at
 * a time so nobody can jump an order from "placed" to "delivered" and leave the
 * guest's thread with no preparation line in it; cancelling is deliberately not
 * on that path, because it is a decision rather than a step.
 */

import { cn } from "@/lib/utils";

import { fmt } from "../../lib/format";
import { ActionButton, Badge, surfaceClass } from "../ui";
import { kigaliTime } from "./clock";
import {
  ORDER_ADVANCE_LABEL,
  ORDER_STATE_LABEL,
  type RoomOrder,
  isTerminalOrderState,
  nextOrderState,
  orderIntent,
  orderItemCount,
  shortOrderRef,
} from "./order-store";

export interface OrderTicketProps {
  order: RoomOrder;
  /** The guest, where the demo dataset knows one. Never invented from the room. */
  guestName: string | null;
  onAdvance: (order: RoomOrder) => void;
  onCancel: (order: RoomOrder) => void;
  /** The refusal sentence, when this operator may not move orders along. */
  deniedReason?: string;
}

export function OrderTicket({
  order,
  guestName,
  onAdvance,
  onCancel,
  deniedReason,
}: OrderTicketProps) {
  const next = nextOrderState(order.state);
  const closed = isTerminalOrderState(order.state);

  return (
    <article
      className={cn(surfaceClass, "flex flex-col gap-2.5 p-3.5", closed && "opacity-70")}
      aria-label={`${shortOrderRef(order)}, room ${order.room}, ${ORDER_STATE_LABEL[order.state]}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="pms-num text-base font-bold text-foreground">Room {order.room}</span>
        <Badge intent={orderIntent(order.state)}>{ORDER_STATE_LABEL[order.state]}</Badge>
        <span className="flex-1" />
        <span className="pms-num text-2xs text-faint">{kigaliTime(order.placedAt)}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 text-2xs text-muted-foreground">
        <span className="pms-num font-semibold">{shortOrderRef(order)}</span>
        {guestName !== null && <span>· {guestName}</span>}
        <span>· {orderItemCount(order.lines)} items</span>
      </div>

      <ul className="flex flex-col gap-1">
        {/* Keyed on the slug AND its position: a cart can legitimately carry the
            same product on two lines, and a bare slug key would collapse them
            into one row. */}
        {order.lines.map((line, index) => (
          <li key={`${line.productSlug}-${index}`} className="flex items-baseline gap-2 text-xs">
            <span className="pms-num shrink-0 font-semibold text-ink2">{line.qty} ×</span>
            <span className="min-w-0 flex-1 text-foreground">{line.name}</span>
            <span className="pms-num shrink-0 text-muted-foreground">
              {fmt(line.priceRwf * line.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline gap-2 border-t border-line pt-2">
        <span className="text-2xs font-bold tracking-[0.08em] uppercase text-muted-foreground">
          Total
        </span>
        <span className="flex-1" />
        <span className="pms-num text-sm font-bold text-foreground">{fmt(order.totalRwf)}</span>
      </div>

      {closed ? (
        <p className="text-2xs text-faint">
          {order.state === "delivered"
            ? "Delivered. The guest's thread carries the whole run of this order."
            : "Cancelled. Nothing was charged to the room."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {next !== null && (
            <ActionButton
              variant="primary"
              deniedReason={deniedReason}
              onClick={() => onAdvance(order)}
            >
              {ORDER_ADVANCE_LABEL[next]}
            </ActionButton>
          )}
          <ActionButton deniedReason={deniedReason} onClick={() => onCancel(order)}>
            Cancel order
          </ActionButton>
        </div>
      )}
    </article>
  );
}
