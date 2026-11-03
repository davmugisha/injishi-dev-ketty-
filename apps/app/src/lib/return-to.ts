import {
  type BoardId,
  canAccess,
  homeHref,
  type PersonaId,
  personaByEmail,
  screenByPath,
  screens,
} from "@injishi/data";
import { isSetupPath } from "./setup-path";

/**
 * Where a person goes once they are signed in.
 *
 * Two apps send people here. The app's own gate asks with `?next=` and a path on this app. Web asks with
 * `?redirect=` and a path on WEB (the checkout quote, `/claim-org?token=…`, `/trips`), because web hands
 * `/sign-in` to this app whenever the two are separate origins (`apps/web/src/lib/app-handoff.ts`). Both
 * are carried as one value: a path on this app, or an absolute url on web or on this app.
 *
 * `?next=` and `?redirect=` arrive in links anyone can send, so nothing leaves the two first-party
 * origins, and a path is accepted only if a browser would resolve it on this origin too.
 */

function originOf(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * The two public origins. `||`, not `??`: a build arg passed empty is set to nothing, not unset. Reduced
 * to the origin, because a stack may name a page rather than a site (staging's web url is its app's
 * `/sign-in`), and paths are joined onto these.
 */
export const WEB_URL = originOf(process.env.NEXT_PUBLIC_WEB_URL || "") ?? "http://localhost:3000";
export const APP_URL = originOf(process.env.NEXT_PUBLIC_PMS_URL || "") ?? "http://localhost:3002";

const ALLOWED_ORIGINS = new Set([originOf(WEB_URL), originOf(APP_URL)].filter((o): o is string => o !== null));

/** A fixed origin nothing is served from (RFC 2606), used only to resolve a path. */
const PATH_BASE = "http://path-check.invalid";

/**
 * A same-origin path, or null. Decided by PARSING, not by prefix: a browser strips a tab or newline from a
 * url and reads `\` as `/`, so `/\evil.com` and `/<tab>/evil.com` both pass a "starts with / and not //"
 * check and both leave the site. Web found this the hard way (`apps/web/src/lib/redirect.ts`).
 */
export function safePath(raw: string | null | undefined): string | null {
  if (!raw?.startsWith("/")) return null;
  try {
    const url = new URL(raw, PATH_BASE);
    if (url.origin !== PATH_BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** A return target this app may send someone to: a path here, or an absolute url on web or here. */
export function safeReturn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) return safePath(raw);
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!ALLOWED_ORIGINS.has(url.origin)) return null;
    // A url on this app is just a path here.
    if (url.origin === originOf(APP_URL)) return safePath(`${url.pathname}${url.search}${url.hash}`);
    return url.toString();
  } catch {
    return null;
  }
}

/** Web's `?redirect=`: a path on WEB, or an absolute url. */
export function fromWebRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) {
    const path = safePath(raw);
    return path ? `${WEB_URL}${path}` : null;
  }
  return safeReturn(raw);
}

/** The one return target a sign-in screen carries, from either app's way of asking. */
export function returnTargetFrom(params: { next?: string | null; redirect?: string | null }): string | null {
  return safeReturn(params.next) ?? fromWebRedirect(params.redirect);
}

/**
 * Web's landing for a signed-in person with nowhere else in mind (`HOME` in apps/web/src/lib/app-nav.ts):
 * their own trips, stays, lease, inbox and account, read from the API, with web's sign-out.
 */
export const WEB_HOME = `${WEB_URL}/trips`;

/**
 * A person's own home. Someone holding no business, staff or oversight grant resolves to the guest shell,
 * and in this app that shell is the demo guest's sample trip, with no way to sign out: a real person who
 * signed in here landed on a stranger's booking and stayed there. Their side of the product is web's, so
 * they go to it. The demo's own guest, matched by her email, keeps the story written for her.
 */
export function homeAfterSignIn(personaId: PersonaId, email: string | null | undefined, home?: BoardId): string {
  if (personaId === "guest" && !personaByEmail(email ?? "")) return WEB_HOME;
  // A shell borrowed by a role with a landing of its own (a real cashier lands on the live floor).
  return home ? screens[home].href : homeHref(personaId);
}

/**
 * Where to land after sign-in. A web page goes back to web. A screen here is honoured when this person
 * may open it, and so is a property setup page, which checks for itself that the workspace is this
 * person's (`setup-path.ts`). Anything else falls back to their own home (`homeAfterSignIn`).
 */
export function destinationAfterSignIn(
  personaId: PersonaId,
  raw: string | null | undefined,
  email: string | null | undefined,
  home?: BoardId,
): string {
  const target = safeReturn(raw);
  if (target && !target.startsWith("/")) return target;
  if (target) {
    const path = target.split(/[?#]/)[0];
    if (isSetupPath(path)) return target;
    const screen = screenByPath(path);
    if (screen && canAccess(personaId, screen.board)) return target;
    // `/messages` is one route for three people (2026-11-02): it resolves to the front desk's board, so a
    // landlord or broker following a message digest is let back to it under their own board.
    if (path === "/messages" && (canAccess(personaId, "LandlordMessages") || canAccess(personaId, "BrokerMessages"))) return target;
  }
  return homeAfterSignIn(personaId, email, home);
}
