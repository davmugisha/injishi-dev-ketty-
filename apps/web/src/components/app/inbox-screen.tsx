"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GuestDeskPlace, GuestThread } from "@injishi/contracts";
import { Button, Skeleton } from "@injishi/ui";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { InboxDesks } from "@/components/app/inbox-desks";
import { fetchMyDepartments, fetchMyThreads, threadTitle } from "@/data/inbox";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { deskOffer, desksLeadTheInbox } from "@/lib/guest-desks";

/** How often the conversation list asks for new lines. */
const INBOX_POLL_MS = 15_000;

/**
 * The guest's conversations, from `GET /api/v1/me/threads` (ADR-032).
 *
 * This screen was a hardcoded empty state, and the one before it — the thread
 * page — explained itself to guests in terms of endpoints and fixtures. Both
 * were reachable from "track it in the kitchen chat" on an order somebody had
 * just placed, which is the worst moment to meet a dead end.
 *
 * It renders the same four honest states the trips screen does, for the same
 * reasons: a shimmer while loading, an empty state that now means empty BECAUSE
 * the endpoint answered, a failure that owns itself and offers the retry, and a
 * sign-in prompt for a cookie that outlived its session.
 *
 * It lives in `components/app/` rather than beside the older `components/inbox/`
 * pieces on purpose: only `(app)`, `components/app`, `components/auth`,
 * `components/shared` and `components/icons` are in the signed-in stylesheet's
 * `@source` list, so a class used only under `components/inbox/` is never
 * generated. Those files are the room-service demo's, on a local store.
 */
export function InboxScreen() {
  const [result, setResult] = useState<ApiResult<GuestThread[]> | null>(null);

  const load = useCallback(() => {
    setResult(null);
    let cancelled = false;
    void (async () => {
      const next = await fetchMyThreads();
      if (!cancelled) setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  /*
   * The desks this person may write to, at every property they are in house at
   * OR HOLD A LIVE BOOKING WITH (ADR-050 D-q).
   *
   * This used to be `fetchMyStays()` and `currentStay()`, so the panel rendered
   * only for a guest with an OPEN stay — and every guest who had booked and not
   * yet arrived was offered no desk at all, on the screen their own persona
   * story sends them to in order to message the hotel. `GET /me/departments`
   * answers for both, and the screen owns the call rather than the section
   * because the empty state below has to know whether there is anything else
   * on the page before it says "nothing here".
   *
   * Loaded beside the conversation list and never blocking it.
   */
  const [desks, setDesks] = useState<ApiResult<GuestDeskPlace[]> | null>(null);
  const loadDesks = useCallback(() => {
    // Back to the shimmer, so pressing "Try again" visibly does something. On
    // first mount it is already null and this changes nothing.
    setDesks(null);
    let cancelled = false;
    void (async () => {
      const next = await fetchMyDepartments();
      if (!cancelled) setDesks(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(loadDesks, [loadDesks]);

  // New lines and unread counts arrive without a reload. Quietly: a refresh
  // that fails keeps the list already on screen rather than replacing it with
  // an error, and nothing flashes back to the loading shimmer.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        const next = await fetchMyThreads();
        if (next.status === "ok") setResult(next);
      })();
    }, INBOX_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (result === null) return <InboxLoading />;

  if (result.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to read your messages"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Finbox" }}
      >
        A conversation is between you and the property, so it only ever opens for
        you. Signing in again brings you straight back here.
      </EmptyPanel>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t load your messages
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(result)} Nothing has been lost — this is the list that
          didn&apos;t arrive.
        </p>
        <Button className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  /*
   * The offer, once — the screen composes two answers and both decide what it
   * says. `null` means the desks call has not come back or did not succeed, in
   * which case the section below owns saying so and this screen must not
   * conclude the account is empty.
   */
  const offer = desks?.status === "ok" ? deskOffer(desks.data) : null;
  const nowhereToWrite = offer !== null && offer.kind === "nowhere";

  // Nothing to read AND nowhere to write: the only state that is honestly
  // empty. It waits for the desks answer rather than racing it, because
  // "No messages yet" that flips into a list of desks a moment later is a
  // screen telling a guest they have no hotel and then correcting itself.
  if (result.data.length === 0 && nowhereToWrite) {
    return (
      <EmptyPanel icon="inbox" title="No messages yet" action={{ label: "Explore stays", href: "/explore" }}>
        Every stay you book opens a conversation with the property, so you can ask
        about it here — before you arrive, while you are there, and after you
        leave. Nothing to read yet.
      </EmptyPanel>
    );
  }

  const deskSection = <InboxDesks result={desks} onReload={loadDesks} />;

  // Where the desks sit is a decision, and `desksLeadTheInbox` owns it: above
  // the list while nothing has ever been said, below it once something has.
  const deskFirst = desksLeadTheInbox(result.data);

  return (
    <div className="mx-auto flex w-full max-w-wide animate-arrive flex-col gap-section px-4 py-8">
      {deskFirst ? deskSection : null}

      {result.data.length > 0 ? (
        <section aria-labelledby="your-conversations" className="flex flex-col gap-3">
          <h2 id="your-conversations" className="font-display text-lg font-bold tracking-tight">
            Your conversations
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {result.data.map((thread) => (
              <li key={thread.id}>
                <ThreadRow thread={thread} />
              </li>
            ))}
          </ul>
        </section>
      ) : offer !== null && offer.kind === "places" ? (
        // Desks to write to, but nothing written yet. Said as a line rather than
        // as the big empty panel above: the panel is for an account with nothing
        // in it, and this one has a hotel waiting to be asked something.
        //
        // Only for `places`. On `no-desks` there is no desk above to write to,
        // and pointing at one would be the screen inventing an affordance the
        // property has not opened.
        <p className="text-sm text-muted-foreground">
          No conversations yet. Write to a desk above and the reply arrives here.
        </p>
      ) : null}

      {deskFirst ? null : deskSection}
    </div>
  );
}

/**
 * One row.
 *
 * The unread count is the loudest thing on it when there is one, because it is
 * the only reason to open this screen rather than any other. An archived thread
 * says so instead of looking like a live one a reply could be sent into.
 */
function ThreadRow({ thread }: { thread: GuestThread }) {
  const unread = thread.unreadCount > 0;

  return (
    <Link
      href={`/inbox/${encodeURIComponent(thread.id)}`}
      className="flex items-start gap-3 rounded-card border border-border bg-card p-inset hover:bg-secondary"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon name={thread.departmentName ? "message-square" : "building"} className="size-5" />
      </span>

      <span className="min-w-0 grow">
        <span className="flex items-baseline gap-2">
          <b
            className={
              unread
                ? "truncate text-sm font-semibold text-card-foreground"
                : "truncate text-sm font-medium text-card-foreground"
            }
          >
            {threadTitle(thread)}
          </b>
          {thread.status === "archived" ? (
            <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              Closed
            </span>
          ) : null}
        </span>
        <span
          className={
            unread
              ? "mt-1 line-clamp-1 text-sm text-card-foreground"
              : "mt-1 line-clamp-1 text-sm text-muted-foreground"
          }
        >
          {thread.lastMessagePreview ?? "No messages yet"}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        {thread.lastMessageAt ? (
          <span className="text-xs text-muted-foreground">{shortWhen(thread.lastMessageAt)}</span>
        ) : null}
        {unread ? (
          <span
            aria-label={`${thread.unreadCount} unread`}
            className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-accent-foreground"
          >
            {thread.unreadCount}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * `09:42` today, `Tue` this week, `12 Sep` beyond it.
 *
 * A row needs the shortest thing that still answers "when", and that answer
 * changes with distance: the clock is useless on a message from March and the
 * date is noise on one from an hour ago.
 */
function shortWhen(iso: string): string {
  const at = new Date(iso);
  const now = new Date();
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(at);
  }
  const days = (now.getTime() - at.getTime()) / 86_400_000;
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(at);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(at);
}

function InboxLoading() {
  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-2 px-4 py-8">
      <span className="sr-only" role="status">
        Getting your messages
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-card border border-border bg-card p-inset">
          <Skeleton className="size-10 rounded-full" />
          <div className="grow">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="mt-2 h-4 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
