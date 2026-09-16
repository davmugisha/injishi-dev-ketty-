/**
 * Which screens read real data, and which are still the demo store
 * (ADR-012, AC-12).
 *
 * A build time constant, never a runtime flag. A flag can be wrong; this cannot
 * be edited without editing the app, and the migration adds a screen's key here
 * in the same change that removes its `data/demo.ts` import.
 *
 * **The list is inverted on purpose, and this is the part worth reading.** The
 * ADR describes it as a list of the MOCK screens. Kept that way, a screen added
 * next month would be absent from the list and therefore presented as live —
 * silently, and in the one direction that matters, because the failure is the
 * app claiming a number is real when it is not. Listing the LIVE ones instead
 * makes every screen mock until someone says otherwise, so the same omission
 * fails safe: a live screen briefly labelled demo, which is only embarrassing.
 * The banner still names each mock screen; it derives them from the nav rather
 * than from a second hand kept list that could disagree with the first.
 *
 * Keys are `NavItem.key` values, so there is one vocabulary for a screen across
 * the nav, the shell and this file.
 */
export const LIVE_SCREENS: ReadonlySet<string> = new Set([
  // The first thread (ADR-012, D-k): reads GET /api/v1/ops/reservations and
  // commands POST :id/approve and :id/decline.
  "reservations",
  // Widening, step 4: reads GET /ops/rooms and commands
  // POST /ops/rooms/:id/housekeeping.
  "rooms",
  // Widening, step 5: reads GET /ops/rent-roll and GET /ops/deposits, and
  // commands POST /ops/leases/:id/rent with an Idempotency-Key (AC-14).
  "rent-roll",

  /*
   * ADR-035 D-f, WAVE 1. Six screens, no new endpoints — the API had served
   * all of these since ADR-016 and only the screens were still on fixtures.
   * Each one joined this list in the same change that removed its
   * `data/demo.ts` import.
   */
  // Reads GET /ops/housekeeping-tasks, commands POST /:id/advance.
  "housekeeping",
  // Reads GET /ops/tickets, commands POST /:id/advance with the note the
  // server requires. Serves the hotel and the residence board alike.
  "maintenance",
  // Reads GET /ops/threads and /:id/messages, commands POST /:id/messages.
  // One key for both surfaces: `Inbox` only picks the wording.
  "inbox",
  // Reads GET /ops/leases, commands POST /:id/advance naming the target state.
  "leases",
  // Reads GET /ops/leases and GET /ops/deposits, and commands
  // POST /ops/deposits/:id/return with an Idempotency-Key (D-h).
  "move-outs",

  /*
   * WAVE 2. Endpoints that existed with no client at all.
   */
  // Reads GET /ops/service-orders and GET /ops/service-catalog, and commands
  // POST /ops/service-orders/:id/advance and
  // PATCH /ops/service-catalog/items/:id. Both lenses are live, and so is the
  // Departments lens beside them.
  "services",
  /*
   * `inventory` joins only now, with its LAST lens.
   *
   * Room types and Amenities went live earlier in wave 2, but the leaf opens
   * three lenses and Rate plans was a `Placeholder` until
   * `GET /inventory/rate-plans` was written. Adding the key then would have
   * declared a fixture live, which is the one direction this list must never
   * fail in — the same rule that keeps `finance` out below.
   */
  "inventory",

  /*
   * WAVE 3. Screens whose endpoints existed and whose CLIENT already did too.
   */
  /*
   * `people` was live in both its data-bearing lenses before it joined.
   *
   * `Team` reads `GET /ops/team` and `Departments` reads `GET /ops/departments`
   * and commands `PATCH /ops/departments/:id`; neither has imported a fixture
   * since wave 2. The third lens, Invites, was a `Placeholder` when this key
   * joined, and a placeholder is not a fixture — it shows no data at all rather
   * than pretending invented data is real. That is the same distinction
   * `MockBanner` already makes when it drops `built: false` items from the list.
   * Invites has been live since 2026-09-13: it reads and commands
   * `/ops/team/invitations`.
   */
  "people",
  /*
   * `today` joins with this change. It reads `GET /ops/reservations` for the
   * whole day, `GET /ops/stays` for the stay id that check out and the bill
   * link need, and `GET /ops/folios` for the departure balance (only when the
   * caller holds `folio.charge`). It commands approve, decline, check in
   * through the shared drawer, and check out.
   *
   * It was the host workspace's LANDING screen, so until now the first thing an
   * operator saw every morning was a fixture.
   */
  "today",

  /*
   * `calendar` joins with the room grid off the demo store.
   *
   * It was the interesting exclusion: the demo grid's whole point was dragging
   * a bar to other DATES, and no route changes a booking's dates. It joins
   * because the grid stopped pretending otherwise, not because that route now
   * exists. It reads `GET /ops/rooms`, `/ops/reservations`, `/ops/stays` and the
   * new windowed `GET /ops/room-assignments`, and commands only what the server
   * can do: hold a room (`POST /ops/reservations/:id/assign`) and let one go
   * (`DELETE :id/assign/:assignmentId`). The date drag and the extend handle are
   * gone, and the legend says why, rather than drawing a gesture the server
   * would refuse.
   *
   * Availability and Rates are `EmptyState` copy with no endpoint behind them.
   * Like `people`'s Invites, that is a placeholder, not a fixture: it shows no
   * data rather than invented data.
   */
  "calendar",

  /*
   * `finance` joins with its Revenue lens off the demo store.
   *
   * Bills went live in wave 2. The key stayed out because Revenue INVENTED a
   * departmental P&L. It now reads `GET /ops/revenue` — revenue per department,
   * net of voids — and shows no costs and no GOP, because nothing records a
   * cost to take them from. Payouts, Tax invoices and Filings (and the landlord
   * side's Rent ledger) are `Placeholder`s: no data, not invented data.
   */
  "finance",

  /*
   * `settings` joins with its Integrations lens: the business's RRA EBM
   * account (ADR-041). It reads `GET /ops/ebm/connection` and, once connected,
   * the taxpayer's own catalog and customers, and commands connect, mapping and
   * disconnect. Property, Policies and Plan are `Placeholder`s — no data, not
   * invented data — the same line `people` and `calendar` joined on. Property is
   * live since 2026-09-13: the property profile and its contact card.
   */
  "settings",

  /*
   * Setup after approval (2026-09-13). `setup` reads GET /inventory/setup and
   * links every step to a live screen. `units` left the demo store in the same
   * change: it reads the property's unit types and rooms from /inventory.
   */
  "setup",
  "units",

  /*
   * `listing` joins off the demo store (2026-09-15). It drew invented units and
   * broker reveals, and its switch changed a reducer. It now renders the same
   * publish control Units & rents does, for every property the business holds:
   * GET /inventory/properties, POST /inventory/properties/:id/publish and
   * /unpublish.
   */
  "listing",

]);

/** Is this screen reading real server data yet? */
export function isLive(screenKey: string): boolean {
  return LIVE_SCREENS.has(screenKey);
}
