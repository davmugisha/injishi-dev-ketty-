/**
 * Where a person goes after they sign in (F-S01).
 *
 * The rule used to live twice — `safeRedirect` in SignInController and an
 * inline three-clause check in OtpController — and the two already disagreed
 * about nothing only because both were the same two lines. They are one
 * function now, because the rule is about to get harder: sign-in is shared.
 *
 * WHY IT IS SHARED. There is one Better Auth instance, and a person moves
 * between two first-party origins: web, and the operator app (`apps/app`, its
 * own host; :3002 on a laptop), which has its own sign-in and the admin console
 * at `/admin`. A `?redirect=` may point back at an ABSOLUTE url on the app's
 * origin, and this function has to be able to say yes to that.
 *
 * WHY AN ALLOWLIST AND NOT A PATTERN. `?redirect=` is attacker-controlled: it
 * arrives in a link anyone can send. Accepting any absolute url turns the
 * sign-in screen into an open redirect — a phishing page reached through a real
 * injishi.rw link, with a real session freshly minted. Matching a suffix
 * (`endsWith("injishi.rw")`) is the classic hole, because `injishi.rw.evil.com`
 * passes it. So the check is exact-origin membership of a fixed set, and
 * nothing else is ever allowed.
 *
 * The set is built from environment variables so a deployment can name its own
 * hosts, and it is deliberately small: the two first-party apps.
 *
 * WHERE A REFUSED OR ABSENT DESTINATION GOES. Not `/`. This function only ever
 * runs on the two sign-in screens, so every value it returns is where somebody
 * lands the moment they ARE signed in — and the marketplace front page is the
 * one place that tells a signed-in person nothing they came for. Arriving at
 * /sign-in with no `?redirect=` is the ordinary case, not an edge one: it is
 * what the header's own Sign In button does. So the fallback is `HOME` from
 * `lib/app-nav.ts`, which already exists to answer exactly this question and
 * is the same answer the shell's own nav gives.
 */
import { HOME } from "@/lib/app-nav";

/**
 * The operator app's public origin (`NEXT_PUBLIC_PMS_URL`). `||`, not `??`: a
 * build arg passed empty is set to nothing, not unset.
 */
const APP_URL = process.env.NEXT_PUBLIC_PMS_URL || "http://localhost:3002";

/** The apps allowed to receive a signed-in visitor back from this screen. */
const APP_ORIGINS = [process.env.NEXT_PUBLIC_WEB_URL, APP_URL];

/**
 * The one door into the operator app for a signed-in person: its
 * `/auth/continue`, which asks the API who they are and opens their persona's
 * home (owner, landlord, officer, admin console, ...). The app decides the
 * home; web only knows the person holds something there.
 */
export function appHome(): string {
  try {
    return new URL("/auth/continue", APP_URL).toString();
  } catch {
    return "http://localhost:3002/auth/continue";
  }
}

/**
 * The allowlist, as exact origins.
 *
 * `window.location.origin` is added at call time rather than here so this
 * module stays importable on the server, where there is no window. A malformed
 * env value is dropped rather than throwing: a typo in a deploy variable must
 * cost that one destination, not the whole sign-in screen.
 */
function allowedOrigins(): Set<string> {
  const out = new Set<string>();
  if (typeof window !== "undefined") out.add(window.location.origin);
  for (const raw of APP_ORIGINS) {
    if (!raw) continue;
    try {
      out.add(new URL(raw).origin);
    } catch {
      // Not a url. Skip it.
    }
  }
  return out;
}

/**
 * Resolve a post-sign-in destination from a raw `?redirect=` value.
 *
 * Returns `HOME` for anything it cannot vouch for, so a caller never has to
 * handle a null and can never accidentally navigate to an unchecked string.
 *
 * Accepts exactly two shapes:
 *   - a same-origin absolute PATH — `"/book?id=1"`. `"//evil.com"` is a
 *     protocol-relative url wearing a path's clothes, and is refused.
 *   - a full url whose origin is in the allowlist — `"http://localhost:3002/host/today"`.
 */
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return HOME;

  if (raw.startsWith("/")) return samePath(raw);

  try {
    const url = new URL(raw);
    // Only ever http(s). A `javascript:` or `data:` url has no origin worth
    // trusting, and `new URL` will happily parse both.
    if (url.protocol !== "http:" && url.protocol !== "https:") return HOME;
    return allowedOrigins().has(url.origin) ? url.toString() : HOME;
  } catch {
    return HOME;
  }
}

/**
 * A fixed origin nothing can ever be served from, used only to resolve a path.
 *
 * `.invalid` is reserved by RFC 2606, so no real host can ever share it.
 */
const PATH_BASE = "http://path-check.invalid";

/**
 * Accept a same-origin PATH, or refuse it — decided by PARSING, not by prefix.
 *
 * THIS WAS AN OPEN REDIRECT. The rule was "starts with `/` and not `//`", and a
 * browser does not read a url the way a prefix check does. The WHATWG parser —
 * the one every browser uses — strips a TAB and a NEWLINE out of a url before
 * reading it, and treats `\` as `/`. So all of these passed the prefix check:
 *
 *   "/\t/evil.com"   ->  browser reads "//evil.com"  ->  http://evil.com/
 *   "/\n/evil.com"   ->  browser reads "//evil.com"  ->  http://evil.com/
 *   "/\\evil.com"    ->  browser reads "//evil.com"  ->  http://evil.com/
 *
 * Measured, not supposed: each was run through `new URL(raw, base)` and each
 * left the origin. A link to `/two-factor/verify?redirect=%2F%09%2Fevil.com`
 * emailed a real code and then sent the person off-site the moment they typed
 * it — the "freshly minted session handed to a phishing page" that the header
 * of this file names as the one thing this function must never do. `/sign-in`
 * shares this function, so it was exposed the same way.
 *
 * So the value is resolved the way a browser will resolve it, against a
 * sentinel origin, and accepted only if it is still ON that origin. Whatever
 * trick a future string uses to escape, it has to survive the real parser to
 * work, and surviving the parser is exactly what this checks.
 *
 * The NORMALISED path is returned, not the raw string, so no control character
 * that the parser would have eaten can ride through to the navigation.
 */
function samePath(raw: string): string {
  try {
    const url = new URL(raw, PATH_BASE);
    if (url.origin !== PATH_BASE) return HOME;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return HOME;
  }
}

/**
 * The same destination as an absolute url, for the OAuth `callbackURL` that
 * Google must be handed.
 *
 * `safeRedirect` may return a path, and a path is not a callback url. Callers
 * used to write `${window.location.origin}${redirectTo}`, which silently
 * produced `http://localhost:3000http://localhost:3002/host/today` the moment
 * the destination became a cross-app url.
 */
export function absoluteRedirect(destination: string): string {
  if (typeof window === "undefined") return destination;
  try {
    return new URL(destination, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}
