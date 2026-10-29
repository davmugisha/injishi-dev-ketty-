/**
 * The demo guide's decisions, with no React in them.
 *
 * Kept apart from the component so each rule can be read (and checked) on its
 * own: whether the guide exists at all, which seat names the person, which step
 * is the one on screen, and how a step's link is opened. None of it grants or
 * refuses anything. The guide is presentation, the same standing as the mock
 * banner: it says who you are and what to show, and the API still decides what
 * you may do.
 */

import type { DemoPersona, DemoSeat, DemoStory, DemoStoryStep, PlatformInfo } from "@injishi/contracts";

/**
 * Only ever on the demo.
 *
 * `environment === "demo"` and nothing weaker. `sampleData` is also true on
 * staging and a laptop running production mode, and a guide telling a real
 * operator "you are signed in as a persona" would be false. Null (the API has
 * not answered, or could not be reached) hides it: this fails closed, like
 * every other reader of `GET /api/v1/platform` in this app.
 */
export function guideAllowed(platform: PlatformInfo | null | undefined): boolean {
  return platform?.environment === "demo";
}

/**
 * The persona the signed-in person is, matched by email, case-insensitively.
 * Null for an account that is not on the roster (someone who signed up on the
 * demo themselves): there is no story written for them.
 */
export function findPersona(roster: readonly DemoPersona[], email: string | null): DemoPersona | null {
  if (!email) return null;
  const wanted = email.trim().toLowerCase();
  return roster.find((p) => p.email.trim().toLowerCase() === wanted) ?? null;
}

/** Where the guide is mounted, which decides the seat it names. */
export type GuideSurface =
  | { kind: "operator"; workspaceLabel: string | null; roleKey: string | null }
  | { kind: "oversight" };

const OPERATOR_SURFACES = new Set(["host", "landlord", "work", "broker", "personal"]);

/**
 * The seat to name in "signed in as … · <role> at <label>".
 *
 * A persona can hold several seats (an owner of two hotels who is also a
 * guest), so the one named is the one in view: in the operator app the seat
 * whose label is the workspace on screen, falling back to the same role; in the
 * console the oversight seat. The first seat is the last resort, because a
 * wrong-but-plausible seat is still better than none only when nothing matches.
 */
export function seatInView(persona: DemoPersona, surface: GuideSurface): DemoSeat | null {
  const seats = persona.seats;
  if (seats.length === 0) return null;
  if (surface.kind === "oversight") {
    return seats.find((s) => s.surface === "oversight") ?? seats[0] ?? null;
  }
  const operator = seats.filter((s) => OPERATOR_SURFACES.has(s.surface));
  const byLabel = surface.workspaceLabel
    ? operator.find((s) => s.label === surface.workspaceLabel)
    : undefined;
  const byRole = surface.roleKey ? operator.find((s) => s.roleKey === surface.roleKey) : undefined;
  return byLabel ?? byRole ?? operator[0] ?? seats[0] ?? null;
}

/** "Front office · Receptionist at Amahoro Boutique Hotel". */
export function seatLine(seat: DemoSeat | null): string | null {
  if (!seat) return null;
  return `${seat.role} at ${seat.label}`;
}

/** How a step's link opens. */
export type StepLink =
  /** A route this app serves: a client navigation. */
  | { kind: "app"; href: string }
  /** A path on the web origin this app is a zone of: a document navigation. */
  | { kind: "site"; href: string }
  /** Another host (the admin console): a new tab, so the demo stays open. */
  | { kind: "external"; href: string }
  | { kind: "none" };

/** The operator app is served under web's origin at these two prefixes. */
function isAppPath(path: string): boolean {
  return /^\/(w|oversight)(\/|$|\?|#)/.test(path);
}

export function stepLink(step: DemoStoryStep): StepLink {
  const href = step.href?.trim();
  if (!href) return { kind: "none" };
  if (/^https?:\/\//i.test(href)) return { kind: "external", href };
  // Only a rooted path is a path. Anything else ("javascript:", "mailto:",
  // a bare word) is not something a story should hold, so it is not a link.
  if (!href.startsWith("/") || href.startsWith("//")) return { kind: "none" };
  return isAppPath(href) ? { kind: "app", href } : { kind: "site", href };
}

/** A path without its query or fragment, and without a trailing slash. */
function bare(path: string): string {
  const cut = path.split(/[?#]/)[0] ?? "";
  return cut.length > 1 ? cut.replace(/\/+$/, "") : cut;
}

/**
 * The step the presenter is on: the one whose href is the current path, or the
 * deepest one the current path sits under. Deepest, so `/oversight` does not
 * light up on every console screen once a step names `/oversight/.../queue`.
 * -1 when none matches, which is the honest answer on a screen no step names.
 */
export function currentStepIndex(story: DemoStory, pathname: string | null): number {
  if (!pathname) return -1;
  const here = bare(pathname);
  let best = -1;
  let bestLength = -1;
  story.tryThis.forEach((step, i) => {
    const link = stepLink(step);
    if (link.kind !== "app" && link.kind !== "site") return;
    const target = bare(link.href);
    const hit = here === target || here.startsWith(`${target}/`);
    if (hit && target.length > bestLength) {
      best = i;
      bestLength = target.length;
    }
  });
  return best;
}

/**
 * "last reset 3 hours ago", from `seededAt`. Null when the recipe has never
 * finished (or the instant does not parse), in which case the line is left out
 * rather than guessed: the demo has no fixed reset schedule to promise.
 */
export function lastResetPhrase(seededAt: string | null | undefined, now: number = Date.now()): string | null {
  if (!seededAt) return null;
  const at = Date.parse(seededAt);
  if (Number.isNaN(at)) return null;
  const seconds = Math.round((at - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86_400), "day");
}
