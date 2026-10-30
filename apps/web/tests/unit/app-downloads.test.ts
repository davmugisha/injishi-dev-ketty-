import { describe, expect, test } from "vitest";

import { APP_DOWNLOADS } from "@/data/app-downloads";

// The real links file, unmocked. Launch day sets one of these by hand, and a
// typo there would send every printed QR code to a dead page, so each value is
// checked against the shape its platform expects (mobile spec 0004, AC-8).
describe("APP_DOWNLOADS", () => {
  test("names the four platforms and nothing else", () => {
    expect(Object.keys(APP_DOWNLOADS).sort()).toEqual(["android", "ios", "mac", "windows"]);
  });

  test("the iPhone link, once set, is an App Store listing", () => {
    if (APP_DOWNLOADS.ios === null) return;
    expect(APP_DOWNLOADS.ios).toMatch(/^https:\/\/apps\.apple\.com\/([a-z]{2}\/)?app\/([a-z0-9-]+\/)?id\d+$/);
  });

  test("the Android link, once set, is the Google Play listing for com.injishi.app", () => {
    if (APP_DOWNLOADS.android === null) return;
    expect(APP_DOWNLOADS.android).toBe("https://play.google.com/store/apps/details?id=com.injishi.app");
  });

  test("the desktop links, once set, are https URLs", () => {
    for (const link of [APP_DOWNLOADS.mac, APP_DOWNLOADS.windows]) {
      if (link === null) continue;
      expect(new URL(link).protocol).toBe("https:");
    }
  });
});
