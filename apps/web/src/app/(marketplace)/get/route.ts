import { absoluteUrl, smartLinkTarget } from "@/lib/download-links";

/**
 * `GET /get`: the one link every printed QR code points at (mobile spec 0004,
 * AC-4 and AC-5).
 *
 * An iPhone goes to the App Store, an Android phone to Google Play, and while a
 * store has no app yet, to that platform's Coming soon screen. Anything else
 * lands on `/downloads`. `?platform=ios|android|mac|windows` picks a platform
 * whatever the device; any other value is ignored. The rules are in
 * `lib/download-links.ts`, and the links in `data/app-downloads.ts`.
 *
 * ALWAYS A 307, NEVER A PERMANENT REDIRECT. The answer to "where does this go"
 * changes on launch day, and a browser keeps a permanent redirect long after
 * that. `no-store` keeps any cache from holding the answer, and `Vary:
 * User-Agent` says the answer depends on the device.
 *
 * No rate limit of its own: it is stateless, reads nothing, writes nothing and
 * does a constant amount of work, so it costs no more than any page.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const target = smartLinkTarget(
    new URL(request.url).searchParams.get("platform"),
    request.headers.get("user-agent"),
  );
  return new Response(null, {
    status: 307,
    headers: {
      Location: absoluteUrl(target),
      "Cache-Control": "no-store",
      Vary: "User-Agent",
    },
  });
}
