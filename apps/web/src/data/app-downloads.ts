/**
 * Where each platform's Injishi app is downloaded from (mobile spec 0004).
 *
 * THIS IS THE ONE FILE TO EDIT ON LAUNCH DAY. Every download button on
 * `/downloads`, the `/get` smart link that every printed QR code points at, and
 * the Coming soon screen all read these four values, so a platform goes live
 * by replacing its `null` with its link here and changing nothing else (AC-8).
 *
 * `null` means "not out yet": that platform's buttons and `/get` send people to
 * `/downloads/coming-soon?platform=<platform>` instead of a dead store page.
 *
 * The shapes to expect once live:
 *
 *   ios      https://apps.apple.com/app/id<number>   (Apple gives the number
 *            out only once the listing exists)
 *   android  https://play.google.com/store/apps/details?id=com.injishi.app
 *   mac      whatever the desktop apps spec decides: a store listing or an
 *   windows  `https://` file URL
 *
 * `tests/unit/app-downloads.test.ts` checks each value against those shapes, so
 * a typo fails CI rather than sending every scan to a dead page.
 *
 * Kept in code rather than environment variables on purpose (spec 0004, option
 * 4): a reviewer sees the exact URL, and a redeploy happens either way.
 */
export interface AppDownloads {
  ios: string | null;
  android: string | null;
  mac: string | null;
  windows: string | null;
}

export const APP_DOWNLOADS: AppDownloads = {
  ios: null,
  android: null,
  mac: null,
  windows: null,
};
