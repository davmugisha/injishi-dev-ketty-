/**
 * The Host surface, as one import.
 *
 * Route files stay one line each, which is what lets `app/` read as a route
 * table rather than as a second place screens live — the shape
 * `src/screens/work/index.ts` set.
 *
 * Nothing here is in `src/components`' barrel. Per MOBILE-PROTOTYPE-PROMPTS.md
 * Part 3 a session builds shared pieces inside its own folder and names them in
 * its report, and Session 11 lifts the ones a second surface turns out to want.
 * The candidates from this session are `UndoBar`, `CountChips`, `HostSection`,
 * `FactRow` and `WebDeskNote`; all five are listed in the report with what they
 * duplicate.
 */

/* Screens */
export { HostToday } from './today';
export { HostBookingsScreen } from './bookings';
export { HostBookingDetail } from './booking-detail';
export { HostCheckInCapture } from './check-in-capture';

/* Sheets, each bound to one screen rather than to a route (see the note in
   `screens/work/inline-sheet.tsx` for when that is the right call). */
export { DeclineSheet } from './decline-sheet';
export { CheckOutSheet } from './check-out-sheet';
export { PayoutsSheet } from './payouts-sheet';

/* Chrome this surface built for itself. Lift candidates, see above. */
export { AdapterNote, CountChips, FactRow, HostSection, Rule, WebDeskNote } from './host-chrome';
export { HostBookingRow, type HostBookingRowProps } from './host-booking-row';

/* The state and its vocabulary, for a test or for Session 11's audit. */
export * from './host-fixtures';
export * from './host-format';
export * from './host-store';
