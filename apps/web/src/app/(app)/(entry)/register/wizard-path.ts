/**
 * Which screens the registration wizard walks, decided in one place.
 *
 * A KIND THAT ARRIVES ANSWERED IS NOT ASKED AGAIN. The `/host` chooser asks
 * what kind of place you have and sends the answer in `?kind=`. The wizard's
 * first step, Place, asks exactly that and nothing else (`step-place.tsx`
 * holds one question: the tile). It used to open anyway, as a confirmation
 * ("You are registering a guest house", Change, Continue), after `/host/start`
 * had already said the same sentence back. Two screens repeating an answer the
 * person gave one click earlier, each with a single Continue, is the funnel
 * losing people for nothing. So an answered kind opens on About you, the first
 * question the wizard does not yet know, and the rail drops Place.
 *
 * The answer stays CHANGEABLE: About you and Business both show it with a
 * Change control, and the review screen keeps its Change row. Pressing any of
 * them opens Place as the ten tiles, and from then on Place is a step this
 * person has walked, so the rail shows it again. That is what `kindCarried`
 * tracks: true only while the kind is still the one that arrived.
 *
 * Pure functions with no React and no imports, so `tests/register-*.test.mjs`
 * runs them as they are.
 */

/** The wizard's phases that this module reasons about. */
export type OpeningPhase = "place" | "about";

/**
 * Where a person with nothing in flight and no draft to resume begins: About
 * you when the kind is already answered, the kind question otherwise.
 */
export function openingPhase(arrivalKind: string | null): OpeningPhase {
  return arrivalKind ? "about" : "place";
}

/**
 * Where a restored draft resumes, given whether the kind arrived answered.
 * A draft is never saved at Place, but a draft from another client could be,
 * and resuming on a question the URL has just answered is the screen this
 * module exists to remove.
 */
export function resumePhase<P extends string>(
  saved: P,
  kindCarried: boolean,
): P | "about" {
  return saved === "place" && kindCarried ? "about" : saved;
}

/**
 * The steps the rail shows: every step of the path, less Place while the kind
 * is the one that arrived. Order is kept, and a path left with a single step
 * (a broker arriving answered) shows no rail at all (`showsRail`), because one
 * node is not progress.
 */
export function stepsToShow<T extends { id: string }>(
  steps: ReadonlyArray<T>,
  kindCarried: boolean,
): T[] {
  return kindCarried ? steps.filter((s) => s.id !== "place") : [...steps];
}

/** Whether a rail of this many steps says anything. */
export function showsRail(stepCount: number): boolean {
  return stepCount > 1;
}

/**
 * Whether entering `next` from `previous` saves the draft (ADR-060, R02: the
 * answers are kept on the server between steps).
 *
 * A step is saved when it is LEFT, so the wizard opening on a phase saves
 * nothing: the person has answered nothing on this visit yet. That matters
 * more now that an arrival opens straight on About you. Saving on that first
 * render would overwrite a draft the person saved for a different kind before
 * they had done anything here, where the old flow only overwrote it once they
 * pressed Continue on the confirmation.
 */
export function savesOnEntry(previous: string, next: string): boolean {
  if (previous === "resume") return false;
  return next !== "place" && previous !== next;
}
