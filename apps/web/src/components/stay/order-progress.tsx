"use client";

import { Badge } from "@injishi/ui";
import {
  isTerminalOrderState,
  ORDER_FLOW,
  ORDER_STATE_LABEL,
  type OrderState,
} from "@/lib/order-store";

/**
 * How far along an order is, read at a glance.
 *
 * FIVE SEGMENTS, NOT A PERCENTAGE BAR. `ORDER_FLOW` is the store's own list and
 * is walked rather than copied, so a sixth state added there appears here
 * without anybody remembering to widen a hardcoded five. A percentage would
 * also have to invent a duration, and nothing in this demo knows how long a
 * kitchen takes.
 *
 * CANCELLED IS NOT A POSITION ON THE TRAIL. It is off the flow entirely — the
 * store's `advanceOrder` cannot produce it — so the trail is replaced by a
 * single line rather than drawn with every segment dim, which would read as an
 * order that is merely waiting.
 */
export function OrderProgress({ state }: { state: OrderState }) {
  if (state === "cancelled") {
    return (
      <p className="text-xs text-muted-foreground">
        Cancelled before it reached the kitchen. Nothing has been charged to the room.
      </p>
    );
  }

  const reached = ORDER_FLOW.indexOf(state);

  return (
    <ol className="flex items-center gap-1.5" aria-label="Order progress">
      {ORDER_FLOW.map((step, index) => {
        const done = index <= reached;
        return (
          <li key={step} className="flex min-w-0 grow flex-col gap-1.5">
            <span
              aria-hidden
              className={`h-1 rounded-full ${done ? "bg-accent" : "bg-secondary"}`}
            />
            <span
              className={`truncate text-2xs ${
                index === reached
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {ORDER_STATE_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The state as a word, coloured by what it means to the guest.
 *
 * Three intents rather than six colours: still coming (accent), arrived
 * (success), and not happening (danger). Six distinct colours would give a
 * guest a legend to learn for a thing they read once.
 */
export function OrderStateBadge({ state }: { state: OrderState }) {
  const variant =
    state === "cancelled" ? "danger" : state === "delivered" ? "success" : "accent";
  return (
    <Badge variant={variant} size="sm">
      {ORDER_STATE_LABEL[state]}
    </Badge>
  );
}

/** True when the order is still moving — what decides whether Cancel is offered. */
export function isOrderOpen(state: OrderState): boolean {
  return !isTerminalOrderState(state);
}
