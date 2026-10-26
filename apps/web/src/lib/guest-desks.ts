import type { GuestDeskPlace, GuestThread, StayDepartment } from "@injishi/contracts";

/**
 * What `/inbox` offers a guest who wants to write to a hotel, decided here
 * rather than inside the JSX (ADR-050 D-q).
 *
 * THE BUG THIS REPLACES. The desks panel on `/inbox` rendered only when
 * `currentStay()` found an OPEN stay, so a guest who had booked and not yet
 * arrived was offered no desk at all — while the demo's own persona story sent
 * exactly that person to `/inbox` to "message the hotel". They arrived at a
 * list of eight conversations, every one of them a `reservation` thread with no
 * department and no messages, and nothing to press.
 *
 * `GET /me/departments` answers the whole question in one call: every property
 * the caller is in house at OR holds a live booking with, each with the desks
 * that property opened to guests. This module turns that payload into what the
 * screen shows, and it is a module rather than a `useMemo` because the decision
 * is worth testing on its own — `apps/web/tests/guest-desks.test.mjs` exercises
 * it against a stay place, a booking place, a place that opened no desk, and
 * the empty answer.
 *
 * Nothing here decides ELIGIBILITY. The server already did: a property in this
 * payload is one this person may write to. All that is left is ordering, the
 * wording of each place's standing, and refusing to render a heading over
 * nothing.
 */

/** One property, ready to render: its desks and the sentence that dates it. */
export interface DeskPlace {
  propertyId: string;
  propertyName: string;
  /** Checked in here right now, as opposed to booked and not yet arrived. */
  inHouse: boolean;
  /** "You're checked in" · "Arriving Tue 14 Oct" — see `standingLabel`. */
  standing: string;
  bookingReference: string | null;
  departments: StayDepartment[];
  /** Unread messages across this property's desks — the reason to look here. */
  unread: number;
}

/**
 * What the inbox's desk section should be, in one value.
 *
 * Three outcomes rather than one list, because they are three different
 * screens and collapsing them produces the two classic wrongs: a heading with
 * an empty list under it, and an empty state that claims the guest has no
 * booking when they have one at a property that simply opened no desk.
 */
type DeskOffer =
  /** No stay and no live booking anywhere. Render no desk section at all. */
  | { kind: "nowhere" }
  /** Places, but not one of them opened a desk to guests. Say so once. */
  | { kind: "no-desks"; properties: string[] }
  /** At least one place has a desk. Places with none are left out. */
  | { kind: "places"; places: DeskPlace[] };

/**
 * Do the desks go ABOVE the conversation list, or below it?
 *
 * An inbox with conversations in it is for reading them, and a compose picker
 * pushing the replies below the fold gets the priority backwards. An inbox with
 * nothing to read is for starting something, and there the desks are the screen.
 *
 * The test is whether any conversation has a MESSAGE in it, not whether any
 * conversation exists — and that distinction is the whole reason this function
 * is not `threads.length === 0`. Every booking opens a `reservation` thread at
 * sale, so the guest this feature exists for arrives holding eight
 * conversations with `messageCount: 0`: nothing has ever been said in any of
 * them. Counting rows would rank a list of empty placeholders above the desks
 * that would let him finally write something, which is the original bug wearing
 * a different hat.
 */
export function desksLeadTheInbox(threads: Pick<GuestThread, "messageCount">[]): boolean {
  return threads.every((thread) => thread.messageCount === 0);
}

/**
 * A `YYYY-MM-DD` check-in date, read as that calendar day and not as UTC
 * midnight.
 *
 * `new Date("2026-10-14")` is midnight UTC, which formats as the 13th for any
 * reader west of Greenwich. A booking's check-in is a DAY the property chose,
 * not an instant, so it is built in the reader's own zone. A stay's `checkIn`
 * is a real instant and falls through to `new Date` unchanged.
 */
function asMoment(iso: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!day) return new Date(iso);
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
}

/** Whole days from `from`'s calendar day to `to`'s, ignoring the clock. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * The sentence under a property's name.
 *
 * The arrival date is what makes a booked place make sense: "Amahoro Boutique
 * Hotel" on its own reads as somewhere the guest is, and a person with three
 * trips booked cannot tell the rows apart without it. An in-house place says so
 * plainly instead and never borrows the booking wording, because "Arriving 14
 * Oct" over a desk list is wrong for somebody already in room 204.
 *
 * A check-in already past on a booking that is still live — they are due and
 * have not been checked in — says "Booked from", not "Arriving": telling
 * somebody standing in the lobby that they arrive next Tuesday is the kind of
 * small lie that makes a screen untrustworthy.
 */
export function standingLabel(place: GuestDeskPlace, now: Date = new Date()): string {
  if (place.inHouse) return "You're checked in";
  if (!place.checkIn) return "Booked";

  const at = asMoment(place.checkIn);
  if (Number.isNaN(at.getTime())) return "Booked";

  const days = daysBetween(now, at);
  if (days === 0) return "Arriving today";
  if (days === 1) return "Arriving tomorrow";

  const sameYear = at.getFullYear() === now.getFullYear();
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(at);

  return days < 0 ? `Booked from ${date}` : `Arriving ${date}`;
}

/**
 * Where this place sorts. Smaller is higher.
 *
 * In house first, because it is the only group that can order to a room and
 * the only one where a question is usually urgent. Bookings then run soonest
 * arrival first, which is the order a person holds their own trips in. Two
 * open stays sort newest arrival first, matching `currentStay()` in
 * `data/my-stay.ts` — the same "the one you are in" rule, so `/stay` and
 * `/inbox` never disagree about which hotel is the current one.
 */
function rank(place: GuestDeskPlace): [number, number] {
  const at = place.checkIn ? asMoment(place.checkIn).getTime() : Number.NaN;
  const when = Number.isNaN(at) ? 0 : at;
  return place.inHouse ? [0, -when] : [1, when];
}

/** Unread messages across every desk at one place. */
function unreadAt(place: GuestDeskPlace): number {
  return place.departments.reduce((total, desk) => total + desk.unreadCount, 0);
}

/**
 * Turn `GET /me/departments` into the section `/inbox` renders.
 *
 * A place with no guest-requestable desk is dropped from the list rather than
 * rendered as a property with an empty box under it: the property's own choice
 * not to take guest messages is not something to present as a broken row. When
 * that leaves nothing, the whole section becomes one honest line naming the
 * properties, so a guest who expected to be able to write to their hotel learns
 * why they cannot rather than seeing the feature vanish.
 */
export function deskOffer(places: GuestDeskPlace[], now: Date = new Date()): DeskOffer {
  if (places.length === 0) return { kind: "nowhere" };

  const withDesks = places.filter((place) => place.departments.length > 0);
  if (withDesks.length === 0) {
    return { kind: "no-desks", properties: places.map((place) => place.propertyName) };
  }

  const ordered = [...withDesks].sort((a, b) => {
    const [groupA, whenA] = rank(a);
    const [groupB, whenB] = rank(b);
    return groupA - groupB || whenA - whenB || a.propertyName.localeCompare(b.propertyName);
  });

  return {
    kind: "places",
    places: ordered.map((place) => ({
      propertyId: place.propertyId,
      propertyName: place.propertyName,
      inHouse: place.inHouse,
      standing: standingLabel(place, now),
      bookingReference: place.bookingReference,
      departments: place.departments,
      unread: unreadAt(place),
    })),
  };
}
