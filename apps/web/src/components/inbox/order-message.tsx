"use client";

import {
  ORDER_FLOW,
  ORDER_STATE_LABEL,
  ORDER_STATE_MESSAGE,
  orderSummary,
  shortOrderRef,
  type ChatMessage,
  type OrderState,
  type RoomOrder,
} from "@/lib/order-store";
import { formatRwf } from "@/lib/money";
import { Icon } from "@/components/app/icon";
import { clockLabel } from "./chat-time";

/**
 * ORDER TRACKING, AS CONVERSATION.
 *
 * The requirement this file exists for is a negative one: an order's progress
 * must NOT be a tracker widget bolted beside the chat. A guest who ordered
 * brochettes scrolls one column and reads placed → accepted → being prepared →
 * on the way → delivered in the same place, and in the same reading order, as
 * the sentence where the sous chef asked about allergies. Two surfaces would
 * also be two things to keep in step, which is the drift `order-store.ts` was
 * written as one store to prevent.
 *
 * So there is no card sitting outside the thread. Each state change IS a
 * message — the store wrote it there in the same call that changed the state —
 * and this component decides how much of it to draw:
 *
 *   - The FIRST event, `placed`, opens into the ticket: the reference, the room,
 *     every line with its quantity and its money, and the total. That is the
 *     message a guest scrolls back to find, and a one-line version of it would
 *     send them looking for a receipt somewhere else.
 *   - Every later event is a slim row: the mark, the state, the sentence, and
 *     enough of the order to know which one moved.
 *
 * WHERE THE STATE COMES FROM. `ChatMessage` carries an `orderId` but no state,
 * because the state lives on the order and duplicating it on the message is the
 * two-copies problem again. The state of an EVENT is recovered from its own
 * text against `ORDER_STATE_MESSAGE` — the same table the store composed it
 * from — so the label above a line always agrees with the line. The live state
 * is read separately, from the order, which is what lets a delivered order's
 * older events still read "on the way" without lying about where it is now.
 */

/** The mark for each state. Movement for the ones that move; a tick at the end. */
const STATE_ICON: Record<OrderState, string> = {
  placed: "clipboard-list",
  accepted: "check",
  preparing: "coffee",
  on_the_way: "arrow-up-right",
  delivered: "circle-check",
  cancelled: "x",
};

/**
 * Recover the state an event announced, from the sentence it announced it with.
 *
 * `endsWith` rather than `includes`, because the store composes every body as
 * `<reference> [· <summary>] — <sentence>` and the sentence is always the tail.
 * A body that matches nothing — one written by an older deploy of the store —
 * returns null and is rendered as the plain system line it is, rather than
 * being forced into a state it never claimed.
 */
export function stateFromBody(body: string): OrderState | null {
  const entries = Object.entries(ORDER_STATE_MESSAGE) as [OrderState, string][];
  return entries.find(([, sentence]) => body.endsWith(sentence))?.[0] ?? null;
}

export function OrderMessage({
  message,
  order,
  current,
}: {
  message: ChatMessage;
  /** Null when the order was cleared by a demo reset but its thread survived. */
  order: RoomOrder | null;
  /** True for the latest event this order has produced — where it is now. */
  current: boolean;
}) {
  const state = stateFromBody(message.body);

  // Nothing recoverable: show what the store wrote, unstyled by state. Honest,
  // and it cannot be wrong, which a guessed state could be.
  if (state === null || order === null) {
    return <SystemLine body={message.body} at={message.at} />;
  }

  return state === "placed" ? (
    <OrderTicket order={order} at={message.at} current={current} />
  ) : (
    <OrderEvent order={order} state={state} at={message.at} current={current} />
  );
}

/** The opening event, drawn as the ticket the kitchen is working from. */
function OrderTicket({
  order,
  at,
  current,
}: {
  order: RoomOrder;
  at: string;
  current: boolean;
}) {
  return (
    <article
      aria-label={`${shortOrderRef(order)} — ${orderSummary(order)}`}
      className={`mx-auto w-full max-w-narrow rounded-card border bg-card p-4 text-card-foreground ${
        current ? "border-accent-brand" : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon name={STATE_ICON.placed} className="h-4 w-4" />
        </span>
        <h3 className="money text-sm font-bold tracking-tight">{shortOrderRef(order)}</h3>
        <span className="text-xs text-muted-foreground">Room {order.room}</span>
        <span className="grow" />
        <span className="money text-2xs text-muted-foreground">{clockLabel(at)}</span>
      </header>

      <ul className="mt-3 space-y-2">
        {order.lines.map((line) => (
          <li key={line.productSlug} className="flex items-baseline gap-3 text-sm">
            <span className="money shrink-0 text-muted-foreground">{line.qty} ×</span>
            <span className="min-w-0 grow">{line.name}</span>
            <span className="money shrink-0 tabular-nums">
              {formatRwf(line.priceRwf * line.qty)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-baseline gap-3 border-t border-border pt-3 text-sm font-semibold">
        <span className="grow">Total</span>
        <span className="money">{formatRwf(order.totalRwf)}</span>
      </p>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {ORDER_STATE_MESSAGE.placed}
      </p>

      <OrderProgress state={order.state} />
    </article>
  );
}

/** Every state after the first: one line, in the flow of the conversation. */
function OrderEvent({
  order,
  state,
  at,
  current,
}: {
  order: RoomOrder;
  state: OrderState;
  at: string;
  current: boolean;
}) {
  const done = state === "delivered";
  const stopped = state === "cancelled";
  return (
    <div
      className={`mx-auto flex w-full max-w-narrow items-start gap-3 rounded-card border px-4 py-3 ${
        current ? "border-accent-brand bg-card text-card-foreground" : "border-border"
      }`}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      >
        <Icon name={STATE_ICON[state]} className="h-4 w-4" />
      </span>
      <div className="min-w-0 grow">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={`text-sm font-semibold ${
              stopped ? "text-destructive" : done ? "text-accent-text" : ""
            }`}
          >
            {ORDER_STATE_LABEL[state]}
          </span>
          <span className="money text-xs text-muted-foreground">{shortOrderRef(order)}</span>
          <span className="grow" />
          <span className="money text-2xs text-muted-foreground">{clockLabel(at)}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {ORDER_STATE_MESSAGE[state]}
        </p>
        <p className="mt-1 truncate text-2xs text-muted-foreground">{orderSummary(order)}</p>
      </div>
    </div>
  );
}

/**
 * Where the order stands now, under the ticket.
 *
 * Five dots and a word, not a second tracker: the events below it are the
 * tracking. This exists because the ticket is the message a guest scrolls back
 * to, and having scrolled back they should not have to scroll forward again to
 * learn whether the food arrived. A cancelled order shows no rail at all —
 * cancelling is a jump off the flow, and drawing it as a step implies it is one.
 */
function OrderProgress({ state }: { state: OrderState }) {
  if (state === "cancelled") {
    return (
      <p className="mt-3 border-t border-border pt-3 text-xs font-semibold text-destructive">
        {ORDER_STATE_LABEL.cancelled} · {ORDER_STATE_MESSAGE.cancelled}
      </p>
    );
  }

  const reached = ORDER_FLOW.indexOf(state);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-2" aria-hidden>
        {ORDER_FLOW.map((step, index) => (
          <span
            key={step}
            className={`h-1 grow rounded-full ${
              index <= reached ? "bg-accent-brand" : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs">
        <span className="text-muted-foreground">Now: </span>
        <span className="font-semibold">{ORDER_STATE_LABEL[state]}</span>
      </p>
    </div>
  );
}

/** A system line the state table does not recognise. Shown as written. */
function SystemLine({ body, at }: { body: string; at: string }) {
  return (
    <p className="mx-auto w-full max-w-narrow text-center text-xs leading-relaxed text-muted-foreground">
      {body} <span className="money">· {clockLabel(at)}</span>
    </p>
  );
}
