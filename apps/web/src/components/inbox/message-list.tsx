"use client";

import { readOrder, type ChatMessage, type ChatThread } from "@/lib/order-store";
import { clockLabel, dayKey, dayLabel } from "./chat-time";
import { OrderMessage } from "./order-message";
import { LeadAvatar } from "./thread-rail";

/**
 * The conversation itself: one column, oldest at the top, newest at the bottom.
 *
 * THREE SPEAKERS, THREE SHAPES, and the third one is the point. A guest must
 * never read an automatic status line as something the sous chef typed, so a
 * `system` message is not a bubble at all — it is centred, it carries the
 * platform's own marks, and it never sits on the staff side of the column.
 * `order-store.ts` states that requirement at the declaration of
 * `ChatMessage.from`; this is where it is honoured.
 *
 * Day separators name the DATE rather than saying "Today". See `chat-time.ts`:
 * knowing what today is means reading the clock, and a value read from the
 * clock differs between the server render and the browser's first paint.
 */
export function MessageList({ thread }: { thread: ChatThread }) {
  // The last event each order produced. It is what earns the "now" emphasis, so
  // a thread carrying two orders marks the live line of each rather than only
  // the last line in the thread.
  const latestEventOf = new Map<string, string>();
  for (const message of thread.messages) {
    if (message.orderId !== undefined) latestEventOf.set(message.orderId, message.id);
  }

  let previousDay = "";

  return (
    <ol className="flex flex-col gap-3 px-4 py-5 sm:px-6">
      {thread.messages.map((message) => {
        const day = dayKey(message.at);
        const opensDay = day !== previousDay;
        previousDay = day;

        return (
          <li key={message.id} className="contents">
            {opensDay ? (
              <p className="my-2 text-center text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                {dayLabel(message.at)}
              </p>
            ) : null}
            <Row message={message} thread={thread} latestEventOf={latestEventOf} />
          </li>
        );
      })}
    </ol>
  );
}

function Row({
  message,
  thread,
  latestEventOf,
}: {
  message: ChatMessage;
  thread: ChatThread;
  latestEventOf: Map<string, string>;
}) {
  if (message.from === "system") {
    return message.orderId === undefined ? (
      <p className="mx-auto w-full max-w-narrow text-center text-xs leading-relaxed text-muted-foreground">
        {message.body}
      </p>
    ) : (
      <OrderMessage
        message={message}
        order={readOrder(message.orderId)}
        current={latestEventOf.get(message.orderId) === message.id}
      />
    );
  }

  if (message.from === "guest") {
    return (
      <div className="flex justify-end">
        <div className="max-w-narrow rounded-card bg-primary px-4 py-2 text-primary-foreground">
          <p className="text-sm leading-relaxed">{message.body}</p>
          <p className="money mt-1 text-right text-2xs opacity-70">{clockLabel(message.at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <LeadAvatar leadName={thread.leadName} />
      <div className="max-w-narrow rounded-card bg-secondary px-4 py-2 text-secondary-foreground">
        <p className="text-2xs font-semibold text-muted-foreground">
          {thread.leadName} · {thread.leadRole}
        </p>
        <p className="mt-1 text-sm leading-relaxed">{message.body}</p>
        <p className="money mt-1 text-2xs text-muted-foreground">{clockLabel(message.at)}</p>
      </div>
    </div>
  );
}
