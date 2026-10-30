import { APP_DOWNLOADS, type AppDownloads } from "@/data/app-downloads";
import { WEB_URL } from "@/lib/web-url";

/**
 * The rules every download link on the site goes through (mobile spec 0004).
 *
 * Pure functions over the User Agent, a query value and `APP_DOWNLOADS`, so
 * `/get`, `/downloads` and the Coming soon screen agree by construction.
 *
 * NOTHING TAKEN FROM A REQUEST EVER BECOMES A REDIRECT TARGET. A target is a
 * value from `APP_DOWNLOADS` or one of three fixed internal paths, and the
 * `platform` query only ever chooses between them, so there is no open
 * redirect however the query is written.
 *
 * The User Agent is read to choose buttons and redirects and for nothing else.
 * Nothing here logs it or stores it.
 */

export type Platform = keyof AppDownloads;

/** The four platforms, in the order the page lists them. */
export const PLATFORMS: readonly Platform[] = ["ios", "android", "mac", "windows"];

/** What `detectDevice` saw. `other` is Linux, a bot, or no User Agent at all. */
export type Device = Platform | "other";

/** The path that shows a platform's Coming soon screen. */
export const COMING_SOON_PATH = "/downloads/coming-soon";

/**
 * Which platform a User Agent belongs to.
 *
 * The order is load bearing. An iPhone's User Agent says "like Mac OS X" and an
 * Android one says "Linux", so the phones are tested first. An iPad in desktop
 * mode reports itself as a Mac and lands on `mac` (spec 0004, Consequences).
 */
export function detectDevice(userAgent: string | null): Device {
  if (!userAgent) return "other";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Macintosh/.test(userAgent)) return "mac";
  if (/Windows/.test(userAgent)) return "windows";
  return "other";
}

/** Whether a device is a phone, which hides the QR panel and the desktop buttons. */
export function isPhone(device: Device): device is "ios" | "android" {
  return device === "ios" || device === "android";
}

/** A `platform` query value, or `null` for anything that is not exactly one of the four. */
export function parsePlatform(value: string | null | undefined): Platform | null {
  return PLATFORMS.find((platform) => platform === value) ?? null;
}

/** Whether a platform's link is set, which is what "live" means. */
export function isLive(platform: Platform): boolean {
  return APP_DOWNLOADS[platform] !== null;
}

/** That platform's Coming soon screen. */
export function comingSoonHref(platform: Platform): string {
  return `${COMING_SOON_PATH}?platform=${platform}`;
}

/** Where a platform's download button points: its link, or its Coming soon screen. */
export function downloadHref(platform: Platform): string {
  return APP_DOWNLOADS[platform] ?? comingSoonHref(platform);
}

/**
 * The live link a Coming soon screen should send its visitor on to, or `null`
 * to show the screen (AC-6). A link saved or shared before launch therefore
 * never shows Coming soon once its platform is out. A missing or unknown
 * `platform` is `null`: the screen shows, nothing breaks.
 */
export function liveLinkFor(platformQuery: string | null | undefined): string | null {
  const platform = parsePlatform(platformQuery);
  return platform ? APP_DOWNLOADS[platform] : null;
}

/**
 * Where `/get` sends a request (AC-4, AC-5).
 *
 * A valid `platform` query wins, whatever the device. Otherwise only a phone has
 * a target of its own: a Mac or a PC that scans nothing and lands on `/get`
 * gets the downloads page, where its own button is.
 *
 * Returns either a value from `APP_DOWNLOADS` (an absolute `https://` URL) or
 * an internal path; `absoluteUrl` turns the second into a `Location`.
 */
export function smartLinkTarget(platformQuery: string | null, userAgent: string | null): string {
  const device = detectDevice(userAgent);
  const platform = parsePlatform(platformQuery) ?? (isPhone(device) ? device : null);
  return platform ? downloadHref(platform) : "/downloads";
}

/**
 * An absolute URL on this site's public origin.
 *
 * Built on `WEB_URL`, never on the request's own URL: behind the proxy that is
 * the container's internal host, which a phone cannot reach. An absolute
 * `https://` value passes through unchanged.
 */
export function absoluteUrl(target: string): string {
  return new URL(target, `${WEB_URL}/`).toString();
}
