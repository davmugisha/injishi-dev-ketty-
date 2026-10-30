import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET } from "@/app/(marketplace)/get/route";
import type { AppDownloads } from "@/data/app-downloads";
import {
  detectDevice,
  downloadHref,
  isLive,
  liveLinkFor,
  parsePlatform,
  PLATFORMS,
  smartLinkTarget,
} from "@/lib/download-links";
import { WEB_URL } from "@/lib/web-url";

// The links file, stood in for by one object each test fills in. Launch day is
// a change to that file, so these tests run the same rules over all four
// unset, some set, and all set (AC-8).
const links = vi.hoisted<AppDownloads>(() => ({ ios: null, android: null, mac: null, windows: null }));
vi.mock("@/data/app-downloads", () => ({ APP_DOWNLOADS: links }));

const LIVE: AppDownloads = {
  ios: "https://apps.apple.com/app/id6740000000",
  android: "https://play.google.com/store/apps/details?id=com.injishi.app",
  mac: "https://downloads.injishi.com/Injishi.dmg",
  windows: "https://downloads.injishi.com/Injishi-Setup.exe",
};

function setLinks(next: Partial<AppDownloads>) {
  Object.assign(links, { ios: null, android: null, mac: null, windows: null }, next);
}

beforeEach(() => setLinks({}));

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  bot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

/** Calls the real `/get` handler with a built request, as a phone's browser would send it. */
function get(query: string, userAgent?: string): Response {
  const headers = userAgent ? { "user-agent": userAgent } : undefined;
  return GET(new Request(`http://internal-host:3000/get${query}`, { headers }));
}

describe("detectDevice", () => {
  test("names each User Agent family", () => {
    expect(detectDevice(UA.iphone)).toBe("ios");
    expect(detectDevice(UA.ipad)).toBe("ios");
    expect(detectDevice(UA.ipod)).toBe("ios");
    expect(detectDevice(UA.android)).toBe("android");
    expect(detectDevice(UA.mac)).toBe("mac");
    expect(detectDevice(UA.windows)).toBe("windows");
  });

  test("anything else, or nothing at all, is other", () => {
    expect(detectDevice(UA.linux)).toBe("other");
    expect(detectDevice(UA.bot)).toBe("other");
    expect(detectDevice("")).toBe("other");
    expect(detectDevice(null)).toBe("other");
  });

  test("a phone is tested before the desktop systems its User Agent also names", () => {
    // An iPhone says "like Mac OS X" and an Android phone says "Linux".
    expect(detectDevice(UA.iphone)).not.toBe("mac");
    expect(detectDevice(UA.android)).not.toBe("other");
  });
});

describe("parsePlatform", () => {
  test("takes exactly the four platform names", () => {
    for (const platform of PLATFORMS) expect(parsePlatform(platform)).toBe(platform);
  });

  test("anything else is null", () => {
    for (const value of [null, undefined, "", "IOS", " ios", "linux", "https://evil.example", "ios,android"]) {
      expect(parsePlatform(value)).toBeNull();
    }
  });
});

describe("downloadHref and isLive", () => {
  test("all four unset: every button opens that platform's Coming soon", () => {
    for (const platform of PLATFORMS) {
      expect(isLive(platform)).toBe(false);
      expect(downloadHref(platform)).toBe(`/downloads/coming-soon?platform=${platform}`);
    }
  });

  test("some set: each platform goes live on its own", () => {
    setLinks({ android: LIVE.android });
    expect(isLive("android")).toBe(true);
    expect(downloadHref("android")).toBe(LIVE.android);
    expect(isLive("ios")).toBe(false);
    expect(downloadHref("ios")).toBe("/downloads/coming-soon?platform=ios");
    expect(downloadHref("windows")).toBe("/downloads/coming-soon?platform=windows");
  });

  test("all set: every button is its link", () => {
    setLinks(LIVE);
    for (const platform of PLATFORMS) {
      expect(isLive(platform)).toBe(true);
      expect(downloadHref(platform)).toBe(LIVE[platform]);
    }
  });
});

describe("liveLinkFor (Coming soon's own redirect, AC-6)", () => {
  test("shows the screen while the platform is not out", () => {
    expect(liveLinkFor("android")).toBeNull();
  });

  test("sends a saved link on once the platform is live", () => {
    setLinks({ android: LIVE.android });
    expect(liveLinkFor("android")).toBe(LIVE.android);
    expect(liveLinkFor("ios")).toBeNull();
  });

  test("a missing or unknown platform shows the screen", () => {
    setLinks(LIVE);
    expect(liveLinkFor(undefined)).toBeNull();
    expect(liveLinkFor("linux")).toBeNull();
    expect(liveLinkFor("https://evil.example")).toBeNull();
  });
});

describe("smartLinkTarget", () => {
  test("before launch, a phone goes to its Coming soon and a computer to the downloads page", () => {
    expect(smartLinkTarget(null, UA.iphone)).toBe("/downloads/coming-soon?platform=ios");
    expect(smartLinkTarget(null, UA.android)).toBe("/downloads/coming-soon?platform=android");
    expect(smartLinkTarget(null, UA.mac)).toBe("/downloads");
    expect(smartLinkTarget(null, UA.windows)).toBe("/downloads");
    expect(smartLinkTarget(null, UA.linux)).toBe("/downloads");
    expect(smartLinkTarget(null, null)).toBe("/downloads");
  });

  test("the platform query wins over the device", () => {
    setLinks(LIVE);
    expect(smartLinkTarget("android", UA.iphone)).toBe(LIVE.android);
    expect(smartLinkTarget("mac", UA.windows)).toBe(LIVE.mac);
    expect(smartLinkTarget("windows", null)).toBe(LIVE.windows);
  });
});

describe("GET /get", () => {
  function expectRedirect(response: Response, location: string) {
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(location);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("User-Agent");
  }

  test("all set: an iPhone gets the App Store, an Android phone Google Play (AC-4)", () => {
    setLinks(LIVE);
    expectRedirect(get("", UA.iphone), LIVE.ios!);
    expectRedirect(get("", UA.ipad), LIVE.ios!);
    expectRedirect(get("", UA.android), LIVE.android!);
  });

  test("all set: a Mac gets the downloads page, and ?platform=mac the Mac link (AC-4)", () => {
    setLinks(LIVE);
    expectRedirect(get("", UA.mac), `${WEB_URL}/downloads`);
    expectRedirect(get("?platform=mac", UA.mac), LIVE.mac!);
    expectRedirect(get("?platform=windows", UA.linux), LIVE.windows!);
  });

  test("before launch: a phone lands on its Coming soon, on the public origin (AC-5)", () => {
    expectRedirect(get("", UA.android), `${WEB_URL}/downloads/coming-soon?platform=android`);
    expectRedirect(get("", UA.iphone), `${WEB_URL}/downloads/coming-soon?platform=ios`);
    expectRedirect(get("?platform=windows", UA.mac), `${WEB_URL}/downloads/coming-soon?platform=windows`);
  });

  test("some set: only the live platform leaves the site", () => {
    setLinks({ android: LIVE.android });
    expectRedirect(get("", UA.android), LIVE.android!);
    expectRedirect(get("", UA.iphone), `${WEB_URL}/downloads/coming-soon?platform=ios`);
  });

  test("never built on the request's own host, which is internal behind the proxy", () => {
    const location = get("", UA.android).headers.get("location") ?? "";
    expect(location).not.toContain("internal-host");
  });

  test("a hostile platform behaves like no platform, so there is no open redirect", () => {
    setLinks(LIVE);
    const allowed = new Set([...Object.values(LIVE), `${WEB_URL}/downloads`]);
    for (const query of [
      "?platform=https://evil.example",
      "?platform=//evil.example",
      "?platform=%2F%2Fevil.example",
      "?platform=ios&platform=https://evil.example",
      "?next=https://evil.example",
    ]) {
      for (const userAgent of [UA.iphone, UA.android, UA.mac, undefined]) {
        const location = get(query, userAgent).headers.get("location");
        expect(location).not.toContain("evil.example");
        expect(allowed.has(location ?? "")).toBe(true);
      }
    }
    // The first value of a repeated query is the one read, and it is a valid platform here.
    expectRedirect(get("?platform=ios&platform=https://evil.example", UA.android), LIVE.ios!);
    expectRedirect(get("?platform=https://evil.example", UA.mac), `${WEB_URL}/downloads`);
  });

  test("never a permanent redirect, whatever the input", () => {
    for (const query of ["", "?platform=ios", "?platform=mac", "?platform=nonsense"]) {
      for (const userAgent of Object.values(UA)) {
        expect(get(query, userAgent).status).toBe(307);
      }
    }
  });
});
