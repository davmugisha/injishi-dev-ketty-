// The one way the phone reaches the API (mobile spec 0003, the data layer child, D-s): the shared
// transport from @injishi/api-client, with the session cookie as a header and `credentials: "omit"`.
// The native fetch keeps a cookie jar of its own, and a jar cookie sent without an Origin is refused by
// Better Auth's CSRF check, so the cookie is passed by hand on every call and never logged.

import { createApiClient } from "@injishi/api-client";
import { API_URL } from "./env";

/** Read per call; `auth.ts` points it at Better Auth's stored cookie. The web preview has none. */
let sessionCookie: () => string | null = () => null;

export function setSessionCookieSource(read: () => string | null): void {
  sessionCookie = read;
}

export const api = createApiClient({
  baseUrl: API_URL,
  credentials: "omit",
  timeoutMs: 12_000,
  headers: (): Record<string, string> => {
    const cookie = sessionCookie();
    return cookie ? { cookie } : {};
  },
});

/** An upload's ceiling (milestone 4's photos): a 250 KB photo on a weak link takes longer than a read. */
export const UPLOAD_TIMEOUT_MS = 60_000;
