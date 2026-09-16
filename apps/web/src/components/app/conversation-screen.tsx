"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GuestMessage, GuestOrderDetail, GuestThread } from "@injishi/contracts";
import { GUEST_MESSAGE_MAX } from "@injishi/contracts";
import { Badge, Button, Skeleton, Textarea } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { clockLabel, dayKey, dayLabel } from "@/components/inbox/chat-time";
import {
  fetchMyThreads,
  fetchThreadMessages,
  markThreadRead,
  sendThreadMessage,
  threadTitle,
} from "@/data/inbox";
import { ORDER_STATUS_LABEL, cancelMyOrder, fetchMyOrder, orderTone } from "@/data/ordering";
import { apiResultMessage } from "@/lib/api";

/** How often an open conversation asks for new lines. */
const CONVERSATION_POLL_MS = 5_000;

/**
 * One conversation with a property (ADR-032).
 *
 * What stood here told a guest their thread "will open here once the messaging
 * endpoints are live", with the thread id printed for them — after they had
 * pressed "track it in the kitchen chat" on an order they had just placed. This
 * is that screen with the endpoints behind it.
 *
 * THREE THINGS WORTH KNOWING about how it behaves:
 *
 *  - **It marks the thread read on open**, once, and lets that call fail
 *    silently. The badge is a courtesy; a person who has just read a thread must
 *    not be shown an error because the bookkeeping did not land.
 *  - **A sent message appears immediately**, appended from the server's own
 *    answer rather than guessed at, so what is on screen is what was stored.
 *  - **An archived thread has no composer**, and says why. A closed conversation
 *    that still offers a text box is a promise the server will refuse with 409.
 */
export function ConversationScreen({ threadId }: { threadId: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "failed"; message: string }
    | { phase: "gone" }
    | { phase: "signed-out" }
    | { phase: "ready"; thread: GuestThread; messages: GuestMessage[]; older: string | null }
  >({ phase: "loading" });

  const load = useCallback(() => {
    setState({ phase: "loading" });
    let cancelled = false;
    void (async () => {
      // The thread's own facts come from the list: one endpoint owns what a
      // thread IS, so a conversation header cannot drift from its row.
      const [list, page] = await Promise.all([
        fetchMyThreads(),
        fetchThreadMessages(threadId),
      ]);
      if (cancelled) return;

      if (list.status === "unauthenticated" || page.status === "unauthenticated") {
        setState({ phase: "signed-out" });
        return;
      }
      if (page.status === "refused" && page.httpStatus === 404) {
        setState({ phase: "gone" });
        return;
      }
      if (list.status !== "ok" || page.status !== "ok") {
        setState({
          phase: "failed",
          message: apiResultMessage(list.status !== "ok" ? list : page),
        });
        return;
      }

      const thread = list.data.find((t) => t.id === threadId);
      if (!thread) {
        setState({ phase: "gone" });
        return;
      }

      setState({
        phase: "ready",
        thread,
        // The API serves newest first; a conversation reads oldest first.
        messages: [...page.data.messages].reverse(),
        older: page.data.nextCursor,
      });
      void markThreadRead(threadId);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(load, [load]);

  if (state.phase === "loading") return <ConversationLoading />;

  if (state.phase === "signed-out") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to read this conversation"
        action={{ label: "Sign in", href: `/sign-in?redirect=${encodeURIComponent("/inbox")}` }}
      >
        A conversation is between you and the property, so it only ever opens for
        you.
      </EmptyPanel>
    );
  }

  /*
   * 404 is what the API answers for a thread that is not this person's, and
   * deliberately not 403 — a 403 would confirm the id names a real conversation.
   * So this screen must not say "you are not allowed": from here, the honest
   * reading is that there is no such conversation on this account.
   */
  if (state.phase === "gone") {
    return (
      <EmptyPanel icon="inbox" title="No such conversation" action={{ label: "Back to messages", href: "/inbox" }}>
        This conversation isn&apos;t on your account. If you reached it from a
        link, it may belong to a different one.
      </EmptyPanel>
    );
  }

  if (state.phase === "failed") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t open this conversation
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {state.message} Nothing you or the property has written is lost.
        </p>
        <Button className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Conversation
      thread={state.thread}
      initial={state.messages}
      initialOlder={state.older}
    />
  );
}

function Conversation({
  thread,
  initial,
  initialOlder,
}: {
  thread: GuestThread;
  initial: GuestMessage[];
  initialOlder: string | null;
}) {
  const [messages, setMessages] = useState(initial);
  const [older, setOlder] = useState(initialOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const foot = useRef<HTMLDivElement>(null);

  // Open at the newest message, which is where a conversation is read from.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, []);

  // The property's replies arrive on their own. There is no push channel, so
  // the newest page is asked for every few seconds while the tab is visible
  // and merged BY ID: a line already on screen, including one this person just
  // sent, is never shown twice, and earlier pages already loaded are kept.
  const onScreen = useRef(messages);
  useEffect(() => {
    onScreen.current = messages;
  }, [messages]);

  useEffect(() => {
    if (thread.status === "archived") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        const page = await fetchThreadMessages(thread.id);
        if (page.status !== "ok") return;
        const shown = new Set(onScreen.current.map((m) => m.id));
        if (page.data.messages.every((m) => shown.has(m.id))) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = page.data.messages.filter((m) => !seen.has(m.id));
          if (fresh.length === 0) return prev;
          return [...prev, ...fresh].sort((a, b) =>
            a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
          );
        });
        void markThreadRead(thread.id);
        requestAnimationFrame(() => foot.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
      })();
    }, CONVERSATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [thread.id, thread.status]);

  async function loadOlder() {
    if (!older) return;
    setLoadingOlder(true);
    const page = await fetchThreadMessages(thread.id, older);
    setLoadingOlder(false);
    if (page.status !== "ok") return;
    setMessages((prev) => [...[...page.data.messages].reverse(), ...prev]);
    setOlder(page.data.nextCursor);
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    const sent = await sendThreadMessage(thread.id, body);
    setSending(false);

    if (sent.status !== "ok") {
      // The draft is KEPT. Somebody who typed three sentences and lost their
      // connection should not lose the sentences as well.
      setSendError(apiResultMessage(sent));
      return;
    }
    // A poll may have fetched this line in the moment between the send and its
    // answer, so it is appended only if it is not already there.
    setMessages((prev) => (prev.some((m) => m.id === sent.data.id) ? prev : [...prev, sent.data]));
    setDraft("");
    requestAnimationFrame(() => foot.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
  }

  let lastDay = "";
  // Each order's card sits under the FIRST line about it; later lines are its
  // history, and their count is what tells the card to read its status again.
  const firstLineOf = new Map<string, string>();
  const linesOf = new Map<string, number>();
  for (const message of messages) {
    if (!message.serviceOrderId) continue;
    if (!firstLineOf.has(message.serviceOrderId)) firstLineOf.set(message.serviceOrderId, message.id);
    linesOf.set(message.serviceOrderId, (linesOf.get(message.serviceOrderId) ?? 0) + 1);
  }
  // Ordering to the room belongs to a stay conversation or a desk request.
  const mayOrder = thread.status === "active" && (thread.scope === "stay" || thread.kind === "department_request");

  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-block px-4 py-6">
      <header className="animate-arrive">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <Icon name="arrow-left" className="size-4" />
          Messages
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold tracking-tight">
          {threadTitle(thread)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {thread.status === "archived"
            ? "This conversation is closed."
            : thread.departmentName
              ? `Whoever is on shift in ${thread.departmentName} replies here. Please don't share card details in a message.`
              : "The property replies here. Please don't share card details in a message."}
        </p>
      </header>

      {older ? (
        <div className="text-center">
          <Button variant="outline" size="sm" pending={loadingOlder} onClick={() => void loadOlder()}>
            {loadingOlder ? "Getting earlier messages…" : "Show earlier messages"}
          </Button>
        </div>
      ) : null}

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {messages.map((message) => {
          const day = dayKey(message.createdAt);
          const newDay = day !== lastDay;
          lastDay = day;
          return (
            <li key={message.id}>
              {newDay ? (
                <p className="my-3 text-center text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                  {dayLabel(message.createdAt)}
                </p>
              ) : null}
              {message.bodyType === "system" ? <SystemLine message={message} /> : <Bubble message={message} />}
              {message.serviceOrderId && firstLineOf.get(message.serviceOrderId) === message.id ? (
                <OrderCard orderId={message.serviceOrderId} version={linesOf.get(message.serviceOrderId) ?? 0} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div ref={foot} />

      {thread.status === "archived" ? (
        <p className="rounded-card border border-border bg-secondary p-inset text-sm text-muted-foreground">
          The stay this conversation belongs to has ended, so nothing more can be
          sent. Everything above stays readable.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sendError ? (
            <p role="alert" className="animate-settle-in flex items-start gap-2 text-sm text-destructive">
              <Icon name="triangle-alert" className="mt-0.5 size-4 shrink-0" />
              {sendError} Your message is still here — press send again.
            </p>
          ) : null}
          <Textarea
            value={draft}
            maxLength={GUEST_MESSAGE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message"
            aria-label="Write a message"
            rows={3}
          />
          <div className="flex flex-wrap justify-between gap-2">
            {mayOrder ? (
              // The full order screen, placing into THIS conversation: its card and
              // status lines appear here, and the screen comes back here after.
              <Button asChild variant="outline">
                <Link href={`/stay/order?thread=${encodeURIComponent(thread.id)}`}>
                  <Icon name="coffee" className="size-4" />
                  Order to my room
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <Button pending={sending} disabled={draft.trim().length === 0} onClick={() => void send()}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One message.
 *
 * `fromUs` comes from the server, worked out from the sender against the
 * reader — the thread cannot say who spoke, because both sides write into it.
 */
function Bubble({ message }: { message: GuestMessage }) {
  const mine = message.fromUs;
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          mine
            ? "max-w-[85%] rounded-card bg-accent px-4 py-2 text-sm text-accent-foreground"
            : "max-w-[85%] rounded-card border border-border bg-card px-4 py-2 text-sm text-card-foreground"
        }
      >
        {!mine && message.senderName ? (
          <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {message.senderName}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap">{message.body ?? `[${message.bodyType}]`}</p>
        <p className={mine ? "mt-1 text-2xs text-accent-foreground/70" : "mt-1 text-2xs text-muted-foreground"}>
          {clockLabel(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

/** A line the platform wrote, such as an order's status. Nobody's bubble. */
function SystemLine({ message }: { message: GuestMessage }) {
  return (
    <p data-system-line className="my-1 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
      <Icon name="clipboard-list" className="size-3.5 shrink-0" />
      <span>{message.body}</span>
      <span aria-hidden="true">·</span>
      <span>{clockLabel(message.createdAt)}</span>
    </p>
  );
}

/**
 * The order a line is about, as a card (ADR-050 D-s): read from
 * `GET /me/orders/:id`, the order's one home, and read again whenever `version`
 * moves, which is the count of lines about it.
 */
function OrderCard({ orderId, version }: { orderId: string; version: number }) {
  const [order, setOrder] = useState<GuestOrderDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchMyOrder(orderId);
      if (!cancelled && next.status === "ok") setOrder(next.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, version]);

  if (!order) return <Skeleton className="mx-auto my-2 h-20 w-full max-w-narrow rounded-card" />;

  async function cancel() {
    setCancelling(true);
    setError(null);
    const next = await cancelMyOrder(orderId);
    setCancelling(false);
    if (next.status !== "ok") {
      setError(apiResultMessage(next));
      return;
    }
    setOrder(next.data);
  }

  const tone = orderTone(order.status);
  return (
    <div
      data-order-card={order.orderNumber}
      className="mx-auto my-2 w-full max-w-narrow rounded-card border border-border bg-card p-3 text-sm text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">
          Order <span className="money">{order.orderNumber}</span>
          <span className="font-normal text-muted-foreground"> · {order.outletName}</span>
        </p>
        <Badge variant={tone === "open" ? "accent" : tone === "done" ? "success" : "outline"}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </div>
      <ul className="m-0 mt-2 list-none p-0 text-xs text-muted-foreground">
        {order.lines.map((line, i) => (
          <li key={`${line.name}-${i}`} className="flex justify-between gap-2">
            <span>
              {line.quantity} × {line.name}
            </span>
            <span className="money">{formatPrice(line.lineTotalRwf)}</span>
          </li>
        ))}
      </ul>
      <p className="money mt-2 flex justify-between border-t border-border pt-2 text-xs">
        <span>{order.context === "in_house_folio" ? "On your room bill, with tax" : "Total, with tax"}</span>
        <b>{formatPrice(order.totalRwf)}</b>
      </p>
      {order.cancellable ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="ghost" pending={cancelling} onClick={() => void cancel()}>
            {cancelling ? "Cancelling…" : "Cancel this order"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConversationLoading() {
  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-3 px-4 py-6">
      <span className="sr-only" role="status">
        Opening this conversation
      </span>
      <Skeleton className="h-6 w-1/2 rounded" />
      <Skeleton className="h-16 w-3/4 rounded-card" />
      <Skeleton className="ml-auto h-12 w-2/3 rounded-card" />
      <Skeleton className="h-16 w-3/5 rounded-card" />
    </div>
  );
}
