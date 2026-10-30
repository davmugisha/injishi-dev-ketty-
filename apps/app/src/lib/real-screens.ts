import { sampleCollectionsByBoard } from "@/lib/coverage.generated";

/**
 * Screens that read their own records from the API and leave out, for a real person, the one panel that
 * is still sample (the owner's decisions and insights, the desk's guest requests): they show the rest.
 */
const LIVE_DESPITE_SAMPLES: ReadonlySet<string> = new Set(["OwnerHome", "FrontDeskToday"]);

/**
 * Screens with no live source at all, closed to a real person even inside a live (stay) workspace, which
 * otherwise opens every screen and would draw these empty: the restaurant and bar menus and orders, the
 * POS order pad and its payment screen, and the kitchen display. The live POS is the floor, the order
 * (till), the stations and the shift; the old pages send there.
 */
export const SAMPLE_ONLY: ReadonlySet<string> = new Set([
  "OutletsMenus",
  "OutletOrders",
  "POS",
  "POSPayment",
  "KitchenDisplay",
]);

/**
 * Whether a real person (not one of the demo's own people) may open this screen (2026-10-30). A screen
 * that still draws its records from the fixture store has nothing true to show them: it is closed, and
 * left out of their sidebar, rather than drawn empty or, worse, with a stranger's business as theirs.
 */
export function openToRealPeople(board: string | null | undefined): boolean {
  if (!board) return true;
  if (SAMPLE_ONLY.has(board)) return false;
  return (sampleCollectionsByBoard[board] ?? 0) === 0 || LIVE_DESPITE_SAMPLES.has(board);
}
