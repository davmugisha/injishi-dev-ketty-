/**
 * The Work · Housekeeping surface (frames W1 to W8), as one import.
 *
 * Route files stay one line each, which is what lets `app/` read as a route
 * table rather than as a second place screens live. Nothing here is in
 * `src/components`' barrel: per MOBILE-PROTOTYPE-PROMPTS.md Part 3, a session
 * builds shared pieces inside its own folder and names them in its report, and
 * Session 11 lifts the ones a second surface turns out to want.
 *
 * `WorkShiftSummary` (frame W7) and `WorkConnection` (frame W2) are exported
 * for Session 11 specifically: they belong on the Account screen, which
 * Session 11 owns, and they are built here because the state behind them is
 * this surface's.
 */

/* Screens */
export { WorkQueue } from './queue';
export { TaskDetail } from './task-detail';
export { RoomsBoard } from './rooms-board';
export { RoomStatusSheet } from './room-status-sheet';
export { TicketsBoard } from './tickets-board';
export { Inspection } from './inspection';
export { ReportFault } from './report-fault';

/* Mounted by Session 11 on the Work Account section */
export { WorkShiftSummary } from './work-shift-summary';
export { WorkConnection } from './work-connection';

/* Chrome two Work screens share. Candidates for the barrel if a second surface
   ever needs one — see the report. */
export {
  WorkBackRow,
  WorkEyebrow,
  WorkFilterTabs,
  WorkOfflineBar,
  WorkPageHead,
  WorkSection,
  WorkStickyAction,
  WorkSyncLine,
  STICKY_ACTION_CLEARANCE,
} from './work-chrome';

/* The state and its vocabulary, for a test or for Session 11's audit. */
export * from './work-fixtures';
export * from './work-format';
export * from './work-store';
