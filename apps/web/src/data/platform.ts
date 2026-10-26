import { DemoPersona, PlatformInfo } from "@injishi/contracts";

import { API_URL } from "@/lib/api";

/**
 * Which platform the API behind this web app is: `GET /api/v1/platform`
 * (ADR-043, AC-16).
 *
 * Every screen decision about the demo reads this: whether the verify screens
 * state the code, whether sign in lists the personas, when the data was last
 * reset. The build argument `NEXT_PUBLIC_INJISHI_ENVIRONMENT` is NOT one of
 * them; it exists for the middleware's cookie strip alone.
 *
 * FAILS CLOSED. Null when the API cannot be reached, answers late, or answers
 * something the contract rejects, and every caller reads null as "not the
 * demo". So the fixed code is only ever shown on a positive answer from the
 * API, never on a guess.
 *
 * Callable from a Server Component and from the browser. On the server the
 * answer is cached for the same minute the API's `Cache-Control` allows, so a
 * verify screen does not ask on every render.
 */

/** Ceiling on the round trip. A sign in screen must not wait on this. */
const PLATFORM_TIMEOUT_MS = 3_000;

export async function fetchPlatform(): Promise<PlatformInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLATFORM_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/v1/platform`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const parsed = PlatformInfo.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True only on a positive answer that this is the demo. */
export function isDemo(platform: PlatformInfo | null): boolean {
  return platform?.environment === "demo";
}

/**
 * True only on a positive answer that the API has Google credentials, so its
 * Google provider is mounted. Anywhere else "Continue with Google" can only end
 * in "Google sign-in couldn't start", so the button is not drawn: production
 * without credentials offered it to every visitor on `/register`.
 */
export function offersGoogle(platform: PlatformInfo | null): boolean {
  return platform?.googleSignIn === true;
}

/**
 * True only on a positive answer that the API serves a SAMPLE database: the
 * demo, staging, a laptop. The pages built on invented fixtures (`/services`)
 * answer only then, because fictional hotels at made-up prices are a demo
 * prop, and production served them as real offers until 2026-10-21.
 */
export function servesSampleData(platform: PlatformInfo | null): boolean {
  return platform?.sampleData === true;
}

/**
 * The demo roster for the sign in picker: `GET /api/v1/demo/personas`
 * (ADR-043, AC-18). Ask only once `fetchPlatform` said demo.
 *
 * Null on a 404 (the route's designed answer off the demo), on any failure and
 * on an answer the contract rejects, and the picker is then simply absent: a
 * sign in screen with no picker is exactly production's, which is the safe
 * thing to show when we could not ask.
 */
export async function fetchDemoPersonas(): Promise<DemoPersona[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLATFORM_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/v1/demo/personas`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const parsed = DemoPersona.array().safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
