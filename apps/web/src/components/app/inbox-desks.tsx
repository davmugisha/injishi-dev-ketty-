"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GUEST_MESSAGE_MAX, type GuestDeskPlace, type StayDepartment } from "@injishi/contracts";
import { Button, Skeleton, Textarea } from "@injishi/web-ui";
import { Icon } from "@/components/app/icon";
import { toast } from "@/components/app/toast";
import { openThread } from "@/data/inbox";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { deskOffer, type DeskPlace } from "@/lib/guest-desks";

/**
 * The desks `/inbox` opens with — for a stay and for a booking alike
 * (ADR-050 D-q).
 *
 * WHAT THIS REPLACED. `/inbox` rendered `<DesksPanel stay={stay}/>` only when
 * `currentStay()` found an OPEN stay. A guest who had booked and not yet
 * arrived therefore saw no desk at all: the demo's own "Guest booking a stay"
 * persona is told by his story to come here and "message the hotel", and what
 * he found was eight `reservation` threads with no department, no messages and
 * nothing to press. The whole department capability was invisible to exactly
 * the person who needed it most — the one with a question BEFORE arriving.
 *
 * `GET /me/departments` is the fix and it is one call: every property the
 * caller is in house at or holds a live booking with, each with the desks that
 * property opened to guests. No stay required, and none of the resolution done
 * here — which stays and which bookings count is the server's, and `inHouse`
 * comes back rather than being inferred.
 *
 * WHAT `lib/guest-desks.ts` DECIDES, so that it can be tested without a
 * browser: the order places come in, the sentence that dates each one, and
 * which of the three shapes this section takes. `deskOffer` is the whole of the
 * logic; everything below it is markup.
 *
 * `/stay` keeps its own panel (`components/stay/my-stay-panel.tsx`) on
 * `POST /me/stays/:id/requests`. That screen is ABOUT one stay and has the id
 * in hand, and the route still works; this one cannot use it, because the guest
 * it exists for has no stay yet.
 *
 * THE CALL IS THE SCREEN'S, not this section's, and `result` arrives as a prop.
 * `/inbox` composes two answers — the conversations and the desks — and its
 * empty state is only honest when it knows both. A section that fetched for
 * itself would leave the screen guessing, which is how "No messages yet"
 * flashes up and is then replaced by a list of hotels.
 */
export function InboxDesks({
  result,
  onReload,
}: {
  /** `null` while the call is in flight. */
  result: ApiResult<GuestDeskPlace[]> | null;
  /** Read the desks again: a conversation was just opened, or a retry. */
  onReload: () => void;
}) {
  if (result === null) return <DesksLoading />;

  /*
   * A signed-out answer is not this section's to report. The conversation list
   * beside it makes the same call against the same cookie and renders the
   * sign-in panel for the whole screen; two of them would be one screen saying
   * "sign in" twice.
   */
  if (result.status === "unauthenticated") return null;

  if (result.status !== "ok") {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-input bg-card p-inset">
        <Icon name="triangle-alert" className="size-5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 grow text-sm text-muted-foreground">
          We couldn&apos;t load the desks you can write to. {apiResultMessage(result)}
        </p>
        <Button variant="outline" size="sm" onClick={onReload}>
          Try again
        </Button>
      </section>
    );
  }

  const offer = deskOffer(result.data);

  // Nowhere to write to, so no heading over an empty box. `/inbox`'s own empty
  // state covers the person with no stay and no booking; a second empty panel
  // under it would be the screen apologising twice for the same thing.
  if (offer.kind === "nowhere") return null;

  if (offer.kind === "no-desks") {
    return (
      <section className="rounded-card border border-dashed border-input bg-card p-inset">
        <h2 className="font-display text-lg font-bold tracking-tight">Message the hotel</h2>
        <p className="mt-2 max-w-read text-sm text-muted-foreground">
          {offer.properties.length === 1
            ? `${offer.properties[0]} has not opened any of its desks to guest messages yet.`
            : `None of ${listOf(offer.properties)} has opened a desk to guest messages yet.`}{" "}
          The front desk can still be reached in person or by phone.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="message-a-desk" className="flex flex-col gap-4">
      <div>
        <h2 id="message-a-desk" className="font-display text-lg font-bold tracking-tight">
          Message a desk
        </h2>
        <p className="mt-1 max-w-read text-sm text-muted-foreground">
          Each desk is its own conversation and stays with the department, not
          with whoever is on shift. You can write before you arrive.
        </p>
      </div>
      {offer.places.map((place) => (
        <PlaceCard key={place.propertyId} place={place} />
      ))}
    </section>
  );
}

/** "A, B and C" — an English list, not a comma-joined array. */
function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * One property and its desks.
 *
 * The standing line is what makes a booked place make sense. "Amahoro Boutique
 * Hotel" alone reads as somewhere the guest IS; "Arriving 14 Oct" under it is
 * the fact that turns the card into a trip they recognise, and it is the one
 * thing a person with three bookings needs to tell the rows apart.
 */
function PlaceCard({ place }: { place: DeskPlace }) {
  return (
    <div className="rounded-card border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-inset">
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{place.propertyName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {/*
              `accent-text`, not `accent`. `--accent` is a FILL, tuned to carry
              `accent-foreground` on top of it; as text on a card it measures
              1.41:1 against a 4.5:1 floor, which is the exact pairing ADR-019
              was written about. `--accent-text` is the role for accent-coloured
              text and is tuned per theme for that.
            */}
            <span className={place.inHouse ? "font-semibold text-accent-text" : undefined}>
              {place.standing}
            </span>
            {place.bookingReference ? (
              <>
                {" · "}
                <span className="money">{place.bookingReference}</span>
              </>
            ) : null}
          </p>
        </div>
        {place.unread > 0 ? (
          <span
            aria-label={`${place.unread} unread at this property`}
            className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-accent-foreground"
          >
            {place.unread}
          </span>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {place.departments.map((desk) => (
          <li key={desk.id}>
            <DeskRow desk={desk} inHouse={place.inHouse} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One desk, and the box that writes to it.
 *
 * Sending goes through `POST /me/threads`, which OPENS OR RESUMES: a second
 * message to the same desk lands in the same conversation with `created: false`
 * rather than starting a second one, so this screen never has to check first
 * and a desk never accumulates four threads from one guest. Either way the
 * guest is taken into the conversation, because that is where the answer will
 * arrive and leaving them on a list is how a person misses a reply.
 */
function DeskRow({ desk, inHouse }: { desk: StayDepartment; inHouse: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const result = await openThread({ departmentId: desk.id, body: text });
    setBusy(false);

    if (result.status !== "ok") {
      // The draft is KEPT: somebody who typed three sentences and lost their
      // connection should not lose the sentences as well.
      setError(apiResultMessage(result));
      return;
    }
    toast(
      result.data.created
        ? `Sent to ${result.data.departmentName ?? desk.name}.`
        : `Added to your conversation with ${result.data.departmentName ?? desk.name}.`,
    );
    // Straight into the conversation: that is where the answer arrives, and
    // leaving somebody on a list after they asked a question is how a reply
    // gets missed. This screen is unmounted by the navigation, so there is
    // nothing here to refresh — coming back re-reads the desks.
    router.push(`/inbox/${encodeURIComponent(result.data.threadId)}`);
  }

  return (
    <div className="p-inset">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-card-foreground">{desk.name}</p>
          <p className="text-xs text-muted-foreground">
            {desk.threadId
              ? desk.unreadCount > 0
                ? `${desk.unreadCount} unread`
                : "Conversation open"
              : "No conversation yet"}
            {desk.phone ? ` · ${desk.phone}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {desk.threadId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/inbox/${encodeURIComponent(desk.threadId)}`}>Open</Link>
            </Button>
          ) : null}
          <Button
            variant={desk.threadId ? "outline" : "primary"}
            size="sm"
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
              setError(null);
            }}
          >
            <Icon name="message-square" className="size-4" />
            Say something
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 flex animate-settle-in flex-col gap-2">
          <Textarea
            // The caret lands in the box the disclosure just opened. A
            // disclosure that needs a second press before you can type is one
            // people abandon, and this steals focus from nobody: it exists
            // only because the guest asked for it a moment ago.
            autoFocus
            aria-label={`Message ${desk.name}`}
            // The same ceiling `OpenThreadRequest` enforces. Capping here means
            // a long message stops at the limit instead of being typed in full
            // and then refused with a 422 by a server the guest cannot see.
            maxLength={GUEST_MESSAGE_MAX}
            rows={3}
            value={body}
            placeholder={inHouse ? "What do you need?" : "Ask them anything before you arrive"}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {error} Your message is still here — press send again.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              pending={busy}
              disabled={body.trim().length === 0}
              onClick={() => void send()}
            >
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesksLoading() {
  return (
    <section className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Getting the desks you can write to
      </span>
      <Skeleton className="h-5 w-40 rounded" />
      <div className="rounded-card border border-border bg-card p-inset">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="mt-3 h-4 w-1/4 rounded" />
        <Skeleton className="mt-3 h-4 w-1/4 rounded" />
      </div>
    </section>
  );
}
