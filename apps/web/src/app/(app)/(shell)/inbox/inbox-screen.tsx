"use client";

import { isCheckedIn, stayLabel } from "@/lib/guest-stay";
import { readThreads } from "@/lib/order-store";
import { Icon } from "@/components/app/icon";
import { CheckInInvite } from "@/components/inbox/check-in-invite";
import { DemoNotice } from "@/components/inbox/demo-notice";
import { ThreadRail } from "@/components/inbox/thread-rail";
import {
  useGuestStayValue,
  useInboxMarks,
  useOrderStoreVersion,
} from "@/components/inbox/use-inbox";

/**
 * `/inbox` — the guest picks who to talk to.
 *
 * The screen is colocated with its route rather than sitting in
 * `components/inbox/` because it is the composition of this ADDRESS: which
 * panes, in which order, and what happens when there is no stay. The pieces it
 * arranges — the rail, the notice, the invite — are shared with
 * `/inbox/[threadId]` and live in the component folder. `register/` next door
 * splits the same way.
 *
 * WHY EVERYTHING IS READ IN AN EFFECT. `readGuestStay` and `readThreads` answer
 * from `localStorage`, which does not exist on the server, so reading either
 * while rendering gives a first paint that disagrees with the server's and
 * React throws the tree away. `useGuestStayValue` and `useOrderStoreVersion`
 * both start in a state that MATCHES the server and fill in after mount; the
 * store reads below happen only once `mounted` says the browser has answered.
 *
 * THE VERSION COUNTER IS THE LIVE WIRE. `useOrderStoreVersion` re-renders this
 * screen on every write to the order/chat store, from this tab or another one.
 * That is why a room-service order placed on the stay screen puts a fresh
 * message and an unread badge on the Kitchen row without a reload.
 */
export function InboxScreen() {
  const { mounted: stayKnown, stay } = useGuestStayValue();
  const { mounted: storeReady } = useOrderStoreVersion();
  const marks = useInboxMarks();

  const inHouse = isCheckedIn(stay);
  const threads = storeReady && inHouse && stay !== null ? readThreads(stay.propertySlug) : null;

  return (
    <div className="flex min-w-0 grow flex-col">
      <DemoNotice>
        <strong className="font-semibold">Demo data.</strong> These conversations,
        the department staff who appear in them and the room-service menu behind
        any order are invented for this demonstration. No message here reaches
        anyone, and no hotel named on this screen wrote a word of it.
      </DemoNotice>

      {stayKnown && !inHouse ? (
        <div className="min-h-0 grow scrollbar overflow-y-auto">
          <CheckInInvite />
        </div>
      ) : (
        <>
          {stay === null ? null : (
            <p className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground sm:px-6">
              <Icon name="bed" className="h-4 w-4 shrink-0" />
              <span className="money font-semibold text-foreground">{stayLabel(stay)}</span>
              <span>
                · checked in {stay.checkIn}, leaving {stay.checkOut}
              </span>
            </p>
          )}

          <div className="flex min-h-0 grow">
            <ThreadRail
              threads={threads}
              marks={marks}
              className="w-full border-r lg:w-96"
            />
            <PickADeskPane />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The right-hand pane on a wide screen, and nothing at all on a narrow one.
 *
 * On a phone the list IS the screen and a second pane telling you to tap the
 * list would push it off the fold. On a laptop the layout is two columns —
 * `lib/app-nav.ts` gives `/inbox` a flex `<main>` for exactly this — and an
 * empty right half with no explanation reads as a page that failed to load.
 */
function PickADeskPane() {
  return (
    <div className="hidden min-h-0 grow scrollbar overflow-y-auto lg:block">
      <div className="mx-auto w-full max-w-narrow px-6 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-secondary text-secondary-foreground">
          <Icon name="message-square" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
          Choose a department
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each desk keeps its own thread with its own lead, so a request does not
          have to be relayed and nothing is lost between shifts. Anything you
          order from room service is reported in the Kitchen &amp; room service
          thread as it moves, message by message.
        </p>
      </div>
    </div>
  );
}
