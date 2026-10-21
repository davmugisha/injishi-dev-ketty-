/**
 * Visit counting for the public site: Plausible, or anything that speaks its
 * script API, and nothing else.
 *
 * The site had no analytics of any kind until 2026-10-21, so nobody could say
 * how many people visited, where they came from, or how many owners opened
 * `/host` and then started registering. The owner chose a cookie-free counter:
 * it sets no cookie and stores nothing on the device, so it needs no consent
 * banner, and a self-hosted instance keeps the counts in the country.
 *
 * OFF UNTIL CONFIGURED. Both values are baked in at build (`NEXT_PUBLIC_*`), so
 * each stack decides for itself; production's compose passes them and staging
 * and the demo do not, because counting a rehearsal pollutes the real numbers.
 *
 * - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: the site as Plausible knows it,
 *   `www.injishi.com`. Unset or empty means no script and no events, anywhere.
 * - `NEXT_PUBLIC_PLAUSIBLE_SRC`: the script URL. Defaults to Plausible's
 *   hosted script with outbound link tracking, which is what makes a press on
 *   WhatsApp, a phone number or a social link countable. A self-hosted
 *   instance serves the same file from its own origin.
 *
 * Campaign tags (`utm_source` and friends) need no code here: the counter
 * reads them off the landing URL. Pageviews already cover the funnel steps
 * that are pages (`/host`, `/register`, `/book`); `track` is for the moments
 * that are not.
 */
export const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
export const ANALYTICS_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.outbound-links.js";

/**
 * The custom events, named once so a dashboard goal and the code that fires it
 * cannot drift. Add a name here before firing it.
 */
export type AnalyticsEvent =
  /** A stay search submitted from the search bar. */
  | "Search"
  /** A booking request the API accepted (paid, awaiting payment, or awaiting the host). */
  | "Booking Requested"
  /** A message the support intake accepted, with its topic and the page's intent. */
  | "Support Sent";

type Props = Record<string, string | number | boolean>;

type Plausible = ((event: string, options?: { props?: Props }) => void) & { q?: unknown[] };

/**
 * Count one event. A no-op when analytics is off, before the script has
 * loaded (the queue stub in `AnalyticsScript` holds it until then), and on
 * the server.
 */
export function track(event: AnalyticsEvent, props?: Props): void {
  if (!ANALYTICS_DOMAIN || typeof window === "undefined") return;
  const plausible = (window as Window & { plausible?: Plausible }).plausible;
  plausible?.(event, props ? { props } : undefined);
}
