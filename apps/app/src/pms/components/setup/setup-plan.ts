/**
 * The guided set-up's own arithmetic, kept free of React and of the network so
 * it can be read, and tested, on its own (Onboarding board, 2026-10-07).
 *
 * WHAT A STEP IS, AND WHETHER IT IS DONE, IS NOT DECIDED HERE. The steps come
 * from `setupStepsFor` and "done" from `isSetupStepDone`, both in
 * `@injishi/contracts`, against the counts the API read from the database. This
 * file only arranges what those two answered: which step to open on, what the
 * rail says beside each, and which unfinished steps stop the listing going live,
 * in words.
 *
 * Imports are types only, on purpose: `setup-plan.test.mjs` strips them and runs
 * the real functions.
 */

import type { SetupStepKey, SetupVocabulary } from "@injishi/contracts";

/** One step, as the contract defines it, with the database's answer beside it. */
export interface PlanStep {
  key: SetupStepKey;
  title: string;
  description: string;
  required: boolean;
  done: boolean;
}

/** The three views the board walks through once a business is approved. */
export type SetupView = "setup" | "publish" | "open";

export function parseView(value: string | null): SetupView {
  return value === "publish" || value === "open" ? value : "setup";
}

/** What a step asks for, in the header above it: "Step 3 of 10 · Required". */
export function stepNeed(step: PlanStep, isLast: boolean): "Required" | "Recommended" | "Last step" {
  if (isLast) return "Last step";
  return step.required ? "Required" : "Recommended";
}

/** What the rail says beside a step: its need until it is done, then "Done". */
export function railNeed(step: PlanStep, isLast: boolean): string {
  if (step.done) return "Done";
  return isLast ? "" : step.required ? "Required" : "Recommended";
}

/** Only a recommended step can be skipped; the last step is the publish itself. */
export function canSkip(step: PlanStep, isLast: boolean): boolean {
  return !step.required && !isLast;
}

/**
 * The step to open on: the first required step not yet done, then the first of
 * any kind, then the last (publishing), when everything else is finished.
 *
 * Required first because those are what stand between the owner and a live
 * listing; a guest house whose departments are only recommended should land on
 * its room types, not on a step it may skip.
 */
export function firstOpenStep(steps: readonly PlanStep[]): number {
  const required = steps.findIndex((s) => s.required && !s.done);
  if (required >= 0) return required;
  const any = steps.findIndex((s) => !s.done);
  if (any >= 0) return any;
  return Math.max(0, steps.length - 1);
}

/** How many of the required steps are finished, and how many there are. */
export function requiredProgress(steps: readonly PlanStep[]): { done: number; total: number; pct: number } {
  const required = steps.filter((s) => s.required);
  const done = required.filter((s) => s.done).length;
  const total = required.length;
  return { done, total, pct: total === 0 ? 100 : Math.round((done / total) * 100) };
}

/** One reason the listing cannot go live yet, and the step that fixes it. */
export interface Blocker {
  key: string;
  text: string;
  /** The step whose screen fixes it, or null when no step in this flow does. */
  step: SetupStepKey | null;
}

/**
 * What an unfinished required step means to a guest, in plain words.
 *
 * Said from the guest's side where that is clearer ("no room can be sold yet"),
 * because that is the consequence the owner is weighing.
 */
export function blockerText(key: SetupStepKey, words: SetupVocabulary, title: string): string {
  const typeSingular = words.typePlural.toLowerCase().replace(/s$/, "");
  switch (key) {
    case "property":
      return "There is no property yet. Add it first: everything else hangs on it.";
    case "contact":
      return "Guests and officers have no way to reach you. Add the front desk phone and email.";
    case "departments":
      return "Name who heads at least one department.";
    case "room_types":
      return `Add a ${typeSingular} with a price ${words.pricePeriod}.`;
    case "rooms":
      return `No ${words.unitSingular} can be sold yet: add your ${words.unitPlural}.`;
    case "photos":
      return "Add at least one photo. Guests do not book a place they cannot see.";
    default:
      return `Finish ${title.toLowerCase()}.`;
  }
}

/**
 * Everything that stops the listing going live, in the order the steps run.
 *
 * Two sources, never invented: every REQUIRED step the database says is not done
 * (the contract's rule that required steps gate publishing), and the one publish
 * condition the steps do not cover, a property with no sector on its address,
 * which the API refuses with `missing_sector`. Its words are the contract's own
 * (`PUBLISH_BLOCKER_LABEL`), passed in.
 */
export function blockersFor(input: {
  steps: readonly PlanStep[];
  words: SetupVocabulary;
  /** The property exists but its address names no sector. */
  sectorMissing: boolean;
  /** `PUBLISH_BLOCKER_LABEL.missing_sector`. */
  sectorText: string;
}): Blocker[] {
  const out: Blocker[] = [];
  for (const step of input.steps) {
    if (!step.required || step.done) continue;
    out.push({ key: step.key, text: blockerText(step.key, input.words, step.title), step: step.key });
  }
  if (input.sectorMissing) out.push({ key: "missing_sector", text: input.sectorText, step: "property" });
  return out;
}

/** "1 thing stops it going live", "3 things stop it going live", or ready. */
export function publishTitle(blockerCount: number): string {
  if (blockerCount === 0) return "Ready to publish";
  return `${blockerCount} ${blockerCount === 1 ? "thing stops" : "things stop"} it going live`;
}

/**
 * The lowest price a guest can book at: the cheapest ACTIVE room type that has a
 * price. Null when none has one, which the preview shows as a dash rather than
 * as "From RWF 0".
 */
export function lowestPrice(
  roomTypes: readonly { status: string; basePriceRwf: number | null }[],
): number | null {
  let low: number | null = null;
  for (const rt of roomTypes) {
    if (rt.status !== "active" || rt.basePriceRwf === null) continue;
    if (low === null || rt.basePriceRwf < low) low = rt.basePriceRwf;
  }
  return low;
}

/** "per night" → "a night", for "From RWF 45,000 a night". */
export function perPeriod(pricePeriod: string): string {
  return pricePeriod.replace(/^per /, "a ");
}
