import { sampleCollectionsByBoard } from "@/lib/coverage.generated";

/**
 * Screens that read their own records from the API and leave out, for a real person, the one panel that
 * is still sample (the owner's decisions and insights, the desk's guest requests): they show the rest.
 */
const LIVE_DESPITE_SAMPLES: ReadonlySet<string> = new Set(["OwnerHome", "FrontDeskToday"]);

/**
 * Whether a real person (not one of the demo's own people) may open this screen (2026-10-30). A screen
 * that still draws its records from the fixture store has nothing true to show them: it is closed, and
 * left out of their sidebar, rather than drawn empty or, worse, with a stranger's business as theirs.
 */
export function openToRealPeople(board: string | null | undefined): boolean {
  if (!board) return true;
  return (sampleCollectionsByBoard[board] ?? 0) === 0 || LIVE_DESPITE_SAMPLES.has(board);
}
