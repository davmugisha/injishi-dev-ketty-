"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GuestMessage, GuestThread } from "@injishi/contracts";
import { GUEST_MESSAGE_MAX } from "@injishi/contracts";
import { Button, Skeleton, Textarea } from "@injishi/ui";
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
import { apiResultMessage } from "@/lib/api";

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
    setMessages((prev) => [...prev, sent.data]);
    setDraft("");
    requestAnimationFrame(() => foot.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
  }

  let lastDay = "";

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
              <Bubble message={message} />
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
          <div className="flex justify-end">
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
