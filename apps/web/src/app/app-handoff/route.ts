/**
 * The answer to an RSC fetch for `/sign-in` while it hands off to the operator
 * app on another origin (`src/lib/app-handoff.ts`, which rewrites such fetches
 * here).
 *
 * Empty on purpose. Next's router takes a response that is not a flight
 * response as "load this url in the browser", and that page load meets the
 * redirect to the app, so the hand-off happens with nothing logged.
 */
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
