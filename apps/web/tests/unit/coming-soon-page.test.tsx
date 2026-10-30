import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import ComingSoonPage, { metadata } from "@/app/(marketplace)/(bare)/downloads/coming-soon/page";
import type { AppDownloads } from "@/data/app-downloads";

/**
 * `/downloads/coming-soon` (mobile spec 0004, AC-5 to AC-7). The page is an async Server Component;
 * its tree is synchronous, so the awaited result renders here. `redirect` is stood in for by one that
 * throws, as Next's does, and records where it was sent. The three page only typefaces are files
 * `next/font/local` would load at build time, so it hands back a plain variable here.
 *
 * The seven frame loop itself is pure CSS: `coming-soon-frames.test.ts` reads its frames.
 */
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT permanent ${url}`);
  }),
}));
vi.mock("next/navigation", () => navigation);
vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "font-page-only" }) }));

const links = vi.hoisted<AppDownloads>(() => ({ ios: null, android: null, mac: null, windows: null }));
vi.mock("@/data/app-downloads", () => ({ APP_DOWNLOADS: links }));

const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.injishi.app";

beforeEach(() => {
  Object.assign(links, { ios: null, android: null, mac: null, windows: null });
  navigation.redirect.mockClear();
  navigation.permanentRedirect.mockClear();
});

function page(platform?: string | string[]) {
  return ComingSoonPage({ searchParams: Promise.resolve(platform === undefined ? {} : { platform }) });
}

async function open(platform?: string | string[]) {
  render(await page(platform));
}

describe("while a platform is not out (AC-5, AC-7)", () => {
  test("the screen is the words Coming soon, one level one heading", async () => {
    await open("android");

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  test("and nothing else: no logo, no link, no button", async () => {
    await open("android");

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.body.textContent).toBe("Coming soon");
  });

  test("the words sit on the grainy ground", async () => {
    await open("android");

    // The grain is a pseudo element the `grain` utility draws, which jsdom does not paint, so the
    // class on the ground is the one thing here that can show it is there. It was `bg-grain`,
    // which `cn()` dropped as a second background colour, so the screen rendered flat.
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toHaveClass("grain");
  });

  test("a missing or unknown platform just shows the screen, even with every link set", async () => {
    Object.assign(links, { ios: "https://apps.apple.com/app/id6740000000", android: GOOGLE_PLAY });

    for (const platform of [undefined, "", "linux", "IOS", "https://evil.example"]) {
      await open(platform);
      expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
      document.body.innerHTML = "";
    }
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});

describe("once a platform is live (AC-6)", () => {
  test("a saved Android link goes on to Google Play instead of showing the screen", async () => {
    links.android = GOOGLE_PLAY;

    await expect(page("android")).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(GOOGLE_PLAY);
  });

  test("each platform goes live on its own: the iPhone screen still shows", async () => {
    links.android = GOOGLE_PLAY;

    await open("ios");
    expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
  });

  test("a repeated platform reads its first value, the same one /get reads", async () => {
    links.android = GOOGLE_PLAY;

    await expect(page(["android", "ios"])).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(GOOGLE_PLAY);

    await open(["ios", "android"]);
    expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
  });

  test("never a permanent redirect, since a browser would keep it long after launch day", async () => {
    links.android = GOOGLE_PLAY;

    await expect(page("android")).rejects.toThrow();
    expect(navigation.permanentRedirect).not.toHaveBeenCalled();
  });
});

describe("metadata (AC-7)", () => {
  test("is titled Coming soon, which the site's template turns into Coming soon | Injishi", () => {
    expect(metadata.title).toBe("Coming soon");
  });

  test("is kept out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
