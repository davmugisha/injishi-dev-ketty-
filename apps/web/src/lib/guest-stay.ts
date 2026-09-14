/**
 * "Am I checked into a room right now?" — the demo answer.
 *
 * FABRICATED STATE. There is no Stays module, no folio, no key card and no
 * front desk behind any of this. Nothing here proves a person is in a hotel; it
 * records that somebody clicked a button in a demo. It is `localStorage` and a
 * presenter, and it must not be described to anyone as a check-in.
 *
 * It exists because three surfaces are gated on it — in-room ordering, the
 * department chat, and the dining tab on a property page — and a presentation
 * cannot wait for a reservation system to be built. When the real Stays module
 * lands, every call below is replaced by a read of the guest's live stay and
 * this file is deleted.
 *
 * SERVER SAFETY. Every read and every write is guarded on `typeof window` and
 * wrapped in `try`. This module is imported by files that also run in a Server
 * Component, and `localStorage` throws outright in a browser with site data
 * blocked, not just in Node. `readGuestStay()` therefore returns `null` on the
 * server and in a locked-down browser, which callers must render as "not
 * checked in" rather than as an error.
 *
 * HYDRATION. Because the server always answers `null`, a component must read
 * this in an effect and not during render. Reading it during a client render
 * produces a first paint that disagrees with the server's, and React throws the
 * subtree away and rebuilds it. `useGuestStay`-shaped consumers should start at
 * `null`, call `readGuestStay()` in `useEffect`, and subscribe via
 * `subscribeGuestStay` so a check-in performed on one screen reaches the others.
 */

export interface GuestStay {
  /** The slug of a real property in `data/properties.ts`. */
  propertySlug: string;
  propertyName: string;
  /** The room number as the guest would read it off their key card. */
  room: string;
  /**
   * Whether the guest is currently in house.
   *
   * Separate from the presence of the record on purpose. A stay that has ended
   * is still worth holding — it is what lets the app say "your stay at the
   * Lanternhouse ended on Friday" instead of forgetting the guest entirely — so
   * checking out flips this false rather than deleting the row.
   */
  checkedIn: boolean;
  /** ISO date, `YYYY-MM-DD`. */
  checkIn: string;
  /** ISO date, `YYYY-MM-DD`. */
  checkOut: string;
}

/** Where the demo stay lives. Namespaced like every other key this app writes. */
export const GUEST_STAY_STORAGE_KEY = "injishi:guest-stay";

/**
 * Fired on every write, because `storage` is not enough.
 *
 * The browser does not deliver `storage` to the tab that performed the write.
 * Without this event, checking in on one screen would leave every other mounted
 * component in the same tab still showing "not checked in" until a reload —
 * which, during a live demo, reads as the feature being broken.
 */
export const GUEST_STAY_CHANGE_EVENT = "injishi:guest-stay-change";

/**
 * The stays a presenter may put themselves into.
 *
 * Every `propertySlug` is a real record in `data/properties.ts` and every one
 * of them sells food and drink in `data/dining.ts`, so choosing any of the
 * three lands on a room-service menu with something on it. The dates are
 * LITERALS, not computed from today, because a value derived at render time
 * differs between the server and the client and tears the tree down.
 */
export const DEMO_STAYS: GuestStay[] = [
  {
    propertySlug: "lanternhouse-hotel-kiyovu",
    propertyName: "Lanternhouse Hotel Kiyovu",
    room: "412",
    checkedIn: true,
    checkIn: "2026-09-06",
    checkOut: "2026-09-11",
  },
  {
    propertySlug: "sunbird-bay-hotel",
    propertyName: "Sunbird Bay Hotel",
    room: "108",
    checkedIn: true,
    checkIn: "2026-09-07",
    checkOut: "2026-09-10",
  },
  {
    propertySlug: "amberhill-convention-hotel",
    propertyName: "Amberhill Convention Hotel",
    room: "1207",
    checkedIn: true,
    checkIn: "2026-09-08",
    checkOut: "2026-09-12",
  },
];

/**
 * The stay a demo opens on when nobody has chosen one.
 *
 * A frozen literal rather than `DEMO_STAYS[0]` handed out by reference: several
 * screens would otherwise share one mutable object, and a single careless
 * `stay.room = "x"` would rewrite the fixture for every one of them.
 */
export const DEMO_GUEST_STAY: GuestStay = Object.freeze({ ...DEMO_STAYS[0] });

/** Narrow an unknown parsed blob to a `GuestStay`, or reject it. */
function parseStay(value: unknown): GuestStay | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.propertySlug !== "string" ||
    typeof raw.propertyName !== "string" ||
    typeof raw.room !== "string" ||
    typeof raw.checkedIn !== "boolean" ||
    typeof raw.checkIn !== "string" ||
    typeof raw.checkOut !== "string"
  ) {
    return null;
  }
  return {
    propertySlug: raw.propertySlug,
    propertyName: raw.propertyName,
    room: raw.room,
    checkedIn: raw.checkedIn,
    checkIn: raw.checkIn,
    checkOut: raw.checkOut,
  };
}

/**
 * The stay held in this browser, or null.
 *
 * Null covers four different situations on purpose — the server render, a
 * browser that refuses site data, an empty key, and a corrupted one — because
 * every caller renders all four the same way: as a guest who is not checked in.
 * A thrown exception here would take a page down over a demo convenience.
 */
export function readGuestStay(): GuestStay | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_STAY_STORAGE_KEY);
    if (!raw) return null;
    return parseStay(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Write the stay and tell every mounted listener. A no-op on the server. */
export function setGuestStay(stay: GuestStay): GuestStay {
  if (typeof window === "undefined") return stay;
  try {
    window.localStorage.setItem(GUEST_STAY_STORAGE_KEY, JSON.stringify(stay));
    window.dispatchEvent(new Event(GUEST_STAY_CHANGE_EVENT));
  } catch {
    /* A browser refusing site data still gets the returned value for this render. */
  }
  return stay;
}

/**
 * Put the presenter in a room, in one call.
 *
 * This is the helper the demo actually runs. It defaults to
 * `DEMO_GUEST_STAY` and takes overrides, so a "check me into this property"
 * button on a property page can pass a slug and a name and get everything else
 * for free.
 */
export function checkInDemoGuest(overrides: Partial<GuestStay> = {}): GuestStay {
  return setGuestStay({ ...DEMO_GUEST_STAY, ...overrides, checkedIn: true });
}

/** Check into one of the named demo stays; falls back to the default. */
export function checkInAtProperty(propertySlug: string): GuestStay {
  const match = DEMO_STAYS.find((stay) => stay.propertySlug === propertySlug);
  return setGuestStay({ ...(match ?? DEMO_GUEST_STAY), checkedIn: true });
}

/**
 * End the stay without forgetting it.
 *
 * The record survives so the app can still name where the guest was; only
 * `clearGuestStay` removes it. Doing both with one function is how "check out"
 * came to also wipe the order history in an earlier draft of this store.
 */
export function checkOutGuest(): GuestStay | null {
  const current = readGuestStay();
  if (current === null) return null;
  return setGuestStay({ ...current, checkedIn: false });
}

/** Forget the stay entirely — the reset a presenter runs between demos. */
export function clearGuestStay(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_STAY_STORAGE_KEY);
    window.dispatchEvent(new Event(GUEST_STAY_CHANGE_EVENT));
  } catch {
    /* Nothing to clear in a browser that never let anything be written. */
  }
}

/** True only for a stay that exists AND is still in house. */
export function isCheckedIn(stay: GuestStay | null): boolean {
  return stay !== null && stay.checkedIn;
}

/**
 * True when the guest is checked into this specific property.
 *
 * The gate every dining and chat surface asks. Kept here rather than written
 * inline at each call site, because "checked in" and "checked in HERE" are
 * different questions and inlining them is how a guest at the Lanternhouse came to
 * see the Amberhill's room-service menu.
 */
export function isCheckedInAt(stay: GuestStay | null, propertySlug: string): boolean {
  return isCheckedIn(stay) && stay?.propertySlug === propertySlug;
}

/** "Room 412 · Lanternhouse Hotel Kiyovu" — the one way this pair is worded. */
export function stayLabel(stay: GuestStay): string {
  return `Room ${stay.room} · ${stay.propertyName}`;
}

/**
 * Listen for check-in and check-out, from this tab and from any other.
 *
 * Returns its own unsubscribe, so a `useEffect` can hand the return value
 * straight back. A no-op teardown on the server keeps that call site free of a
 * second `typeof window` check.
 */
export function subscribeGuestStay(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(GUEST_STAY_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(GUEST_STAY_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
