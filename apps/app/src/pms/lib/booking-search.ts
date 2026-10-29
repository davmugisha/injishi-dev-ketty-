/**
 * The Reservations search box: does a booking answer what the desk typed?
 *
 * The loaded list is filtered on the client, so this is the whole search, and
 * it is written for how a receptionist actually types on a phone keyboard:
 *
 *  - Case and accents do not matter: "immaculee" finds "Immaculée".
 *  - Every word of a name must appear, in any order: "uwase aline" finds
 *    "Aline Uwase", and "ali" finds her too.
 *  - A reference is compared on its letters and digits alone, so "bk 4460",
 *    "BKG4460" and "4460" all find "BKG-4460".
 */

/** Lowercase with the accents taken off. */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** A reference reduced to its letters and digits. */
export function referenceKey(s: string): string {
  return foldText(s).replace(/[^a-z0-9]/g, "");
}

/** Whether a booking matches the query. An empty query matches everything. */
export function matchesBookingQuery(guest: string, reference: string, query: string): boolean {
  const q = foldText(query).trim();
  if (!q) return true;
  const name = foldText(guest);
  if (q.split(/\s+/).every((word) => name.includes(word))) return true;
  const key = referenceKey(query);
  return key.length > 0 && referenceKey(reference).includes(key);
}
