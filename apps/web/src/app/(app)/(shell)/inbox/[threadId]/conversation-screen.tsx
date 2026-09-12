"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@injishi/ui";

import { isCheckedInAt, stayLabel } from "@/lib/guest-stay";
import {
  DEPARTMENT_BLURB,
  DEPARTMENT_LABEL,
  demoThreadsFor,
  ordersInThread,
  propertySlugFromThreadId,
  readThread,
  readThreads,
  type ChatThread,
} from "@/lib/order-store";
import { Icon } from "@/components/app/icon";
import { Composer } from "@/components/inbox/composer";
import { DemoNotice } from "@/components/inbox/demo-notice";
import { DEPARTMENT_ICON } from "@/components/inbox/department-desk";
import { MessageList } from "@/components/inbox/message-list";
import { markThreadRead, type ReadMarks } from "@/components/inbox/read-state";
import { ThreadRail } from "@/components/inbox/thread-rail";
import {
  useGuestStayValue,
  useInboxMarks,
  useOrderStoreVersion,
} from "@/components/inbox/use-inbox";

/**
 * `/inbox/[threadId]` — one conversation with one department lead.
 *
 * THE FIRST PAINT COMES FROM THE PURE SEED. `demoThreadsFor` touches no storage
 * and no clock, so the server and the browser's first render produce identical
 * markup for the opening exchange; only after `mounted` does the screen switch
 * to `readThread`, which layers on what the guest has said and every order that
 * has reported in. Rendering `readThread` straight away would read
 * `localStorage` during a render, which is the hydration defect
 * `lib/order-store.ts` warns about at the top of the file.
 *
 * ORDER TRACKING IS IN HERE, not beside it. Every state change an order makes
 * was written into this thread by the same call that changed the state, so it
 * arrives as a message and is rendered as one (`components/inbox/order-message.tsx`).
 * `subscribeOrderStore`, through `useOrderStoreVersion`, is what makes an
 * operator moving an order to "on the way" in the other app appear here without
 * a reload.
 *
 * THE STAY IS THE GATE. A thread id carries its property, so a guest can arrive
 * at a conversation belonging to a hotel they are not staying at — by an old
 * link, or after checking out. That is refused rather than rendered: these
 * desks belong to a stay, and showing somebody a live thread with a hotel that
 * has never heard of them is the kind of fiction the demo notice cannot excuse.
 */
export function ConversationScreen({ threadId }: { threadId: string }) {
  const propertySlug = propertySlugFromThreadId(threadId);
  const { mounted: stayKnown, stay } = useGuestStayValue();
  const { mounted: storeReady } = useOrderStoreVersion();
  const marks = useInboxMarks();

  // Pure before mount, persisted after. See the note above.
  const seeded =
    propertySlug === null
      ? null
      : (demoThreadsFor(propertySlug).find((candidate) => candidate.id === threadId) ?? null);
  const thread: ChatThread | null = storeReady ? readThread(threadId) : seeded;

  const inHouse = propertySlug !== null && isCheckedInAt(stay, propertySlug);
  const rail = storeReady && inHouse && stay !== null ? readThreads(stay.propertySlug) : null;

  const lastMessageId = thread?.messages[thread.messages.length - 1]?.id;

  // Reading a thread is what marks it read, so the badge on the rail beside it
  // clears while the guest is looking at the messages that produced it. Keyed
  // on the last message id rather than run once on mount: an order advancing
  // while this screen is open appends a message the guest is watching arrive,
  // and it must not come back as unread the moment they navigate away.
  useEffect(() => {
    if (!inHouse || lastMessageId === undefined) return;
    markThreadRead(threadId, lastMessageId);
  }, [threadId, lastMessageId, inHouse]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    if (box === null) return;
    box.scrollTop = box.scrollHeight;
  }, [threadId, lastMessageId]);

  if (thread === null) {
    return (
      <Frame rail={rail} marks={marks} activeThreadId={threadId}>
        <Refusal
          icon="triangle-alert"
          title="That conversation does not exist"
          body={`Nothing on Injishi answers to ${threadId}. Department threads are addressed by property and desk, and this is neither.`}
        />
      </Frame>
    );
  }

  if (stayKnown && !inHouse) {
    return (
      <Frame rail={rail} marks={marks} activeThreadId={threadId}>
        <Refusal
          icon="key"
          title={`${DEPARTMENT_LABEL[thread.department]} belongs to a stay`}
          body={`${thread.leadName} is on this desk for guests who are in house. You are not checked in at this property, so the thread is closed to you — open your inbox to see the desks for the stay you do have.`}
        />
      </Frame>
    );
  }

  const guestHasWritten = thread.messages.some((message) => message.from === "guest");
  const openOrders = storeReady ? ordersInThread(threadId).length : 0;

  return (
    <Frame rail={rail} marks={marks} activeThreadId={threadId}>
      <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Back to the department list"
        >
          <a href="/inbox">
            <Icon name="arrow-left" className="h-5 w-5" />
          </a>
        </Button>
        <span
          aria-hidden
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-card bg-secondary text-secondary-foreground sm:flex"
        >
          <Icon name={DEPARTMENT_ICON[thread.department]} className="h-5 w-5" />
        </span>
        <div className="min-w-0 grow">
          <h2 className="truncate font-display text-base font-bold tracking-tight">
            {DEPARTMENT_LABEL[thread.department]}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {thread.leadName} · {thread.leadRole}
          </p>
          <p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">
            {DEPARTMENT_BLURB[thread.department]}
          </p>
        </div>
        {stay === null ? null : (
          <p className="money hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
            {stayLabel(stay)}
            {openOrders > 0 ? (
              <span className="mt-1 block">
                {openOrders} {openOrders === 1 ? "order" : "orders"} in this thread
              </span>
            ) : null}
          </p>
        )}
      </header>

      <div ref={scroller} className="min-h-0 grow scrollbar overflow-y-auto">
        <MessageList thread={thread} />
      </div>

      <Composer
        threadId={thread.id}
        department={thread.department}
        leadName={thread.leadName}
        showOpeners={!guestHasWritten}
      />
    </Frame>
  );
}

/**
 * Two columns on a laptop, one on a phone.
 *
 * The rail is `hidden lg:flex` here and full width on `/inbox`, which is the
 * whole of the responsive behaviour: a narrow screen treats the list and the
 * conversation as two pages with a back arrow between them, a wide one shows
 * both and each scrolls on its own. `lib/app-nav.ts` gives this route a `<main>`
 * that is a non-scrolling flex row so that can be true.
 */
function Frame({
  rail,
  marks,
  activeThreadId,
  children,
}: {
  rail: ChatThread[] | null;
  marks: ReadMarks;
  activeThreadId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 grow flex-col">
      <DemoNotice>
        <strong className="font-semibold">Demo data.</strong> This conversation,
        the member of staff answering it and every order reported in it are
        fabricated for a demonstration. Nothing said here reaches a hotel and
        nothing has been ordered, charged or delivered.
      </DemoNotice>

      <div className="flex min-h-0 grow">
        <ThreadRail
          threads={rail}
          marks={marks}
          activeThreadId={activeThreadId}
          className="hidden w-96 shrink-0 border-r lg:flex"
        />
        <div className="flex min-h-0 min-w-0 grow flex-col">{children}</div>
      </div>
    </div>
  );
}

/** A thread the guest may not read, said plainly and with a way out. */
function Refusal({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="min-h-0 grow scrollbar overflow-y-auto">
      <div className="mx-auto flex w-full max-w-narrow flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Button asChild variant="primary" className="mt-2">
          <a href="/inbox">Open your inbox</a>
        </Button>
      </div>
    </div>
  );
}
