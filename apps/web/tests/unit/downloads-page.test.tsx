import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import DownloadsPage, { metadata } from "@/app/(marketplace)/(site)/downloads/page";
import { QrCode } from "@/components/shared/qr-code";
import type { AppDownloads } from "@/data/app-downloads";
import { WEB_URL } from "@/lib/web-url";

/**
 * `/downloads` (mobile spec 0004). The page is an async Server Component, but everything under it is
 * synchronous, so its awaited tree renders here like any other. The User Agent it reads through
 * `headers()` and the links file are stood in for, one value each test sets.
 *
 * What CSS alone decides (the QR panel hiding below `md`, "Or" swapping out at the same width, the
 * themes) jsdom cannot see; `/check verify` covers those in a real browser.
 */
const request = vi.hoisted(() => ({ userAgent: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.userAgent === null ? {} : { "user-agent": request.userAgent }),
}));

const links = vi.hoisted<AppDownloads>(() => ({ ios: null, android: null, mac: null, windows: null }));
vi.mock("@/data/app-downloads", () => ({ APP_DOWNLOADS: links }));

beforeEach(() => {
  Object.assign(links, { ios: null, android: null, mac: null, windows: null });
});

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

/** Each platform's download button, by the name a screen reader gives it. */
const BUTTON = {
  ios: "Download for iPhone",
  android: "Download for Android",
  mac: "Download for Mac",
  windows: "Download for Windows",
} as const;

const QR_LABEL = "QR code to get the Injishi app on your phone";

async function openAs(userAgent: string | null) {
  request.userAgent = userAgent;
  render(await DownloadsPage());
}

function hero(): HTMLElement {
  const section = screen.getByRole("heading", { level: 1 }).closest("section");
  if (!section) throw new Error("the heading sits outside the hero section");
  return section;
}

function platformList(): HTMLElement {
  return screen.getByRole("region", { name: "Injishi on every platform" });
}

/** The download buttons the hero offers, in the order they appear. */
function heroOffers(): string[] {
  const found = Object.values(BUTTON).flatMap((name) =>
    within(hero())
      .queryAllByRole("link", { name })
      .map((element) => ({ name, element })),
  );
  return found
    .sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((offer) => offer.name);
}

describe("/downloads on a computer (AC-1)", () => {
  test("opens with the eyebrow and the heading", async () => {
    await openAs(UA.mac);

    expect(screen.getByText("Get the app")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Take Injishi\s*with you/ })).toBeInTheDocument();
  });

  test("shows the QR panel with its scan prompt, labelled for screen readers (AC-11)", async () => {
    await openAs(UA.mac);

    expect(screen.getByRole("img", { name: QR_LABEL })).toBeInTheDocument();
    expect(screen.getByText("Scan with your phone camera")).toBeInTheDocument();
    expect(
      screen.getByText("One code for both phones. It opens the App Store on an iPhone and Google Play on Android."),
    ).toBeInTheDocument();
  });

  test("the QR code is exactly the code for <WEB_URL>/get, the one link every phone shares (AC-11)", async () => {
    await openAs(UA.mac);
    const drawn = screen.getByRole("img", { name: QR_LABEL }).querySelector("path")?.getAttribute("d");

    const symbolFor = (value: string) => {
      const { container } = render(<QrCode value={value} size={140} light="white" ink="black" label={value} />);
      return container.querySelector("path")?.getAttribute("d");
    };

    expect(drawn).toBe(symbolFor(`${WEB_URL}/get`));
    // The comparison can tell codes apart: the downloads page's own address draws another symbol.
    expect(drawn).not.toBe(symbolFor(`${WEB_URL}/downloads`));
  });

  test("the QR code keeps fixed light and ink tokens, so it still scans in the dark theme", async () => {
    await openAs(UA.mac);
    const qr = screen.getByRole("img", { name: QR_LABEL });

    expect(qr.querySelector("rect")).toHaveAttribute("fill", "var(--white)");
    expect(qr.querySelector("path")).toHaveAttribute("fill", "var(--ink)");
  });

  test("offers iPhone, Android and the Mac app, then the web (AC-1, AC-3)", async () => {
    await openAs(UA.mac);

    expect(screen.getByText("Or download it straight away")).toBeInTheDocument();
    expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android, BUTTON.mac]);
    expect(within(hero()).getByRole("link", { name: "Use it on the web" })).toHaveAttribute("href", "/sign-in");
  });

  test("shows the two tilted phones: staff Today behind, guest Home in front", async () => {
    await openAs(UA.mac);
    const phones = within(hero()).getAllByRole("img", { name: /^The Injishi app's/ });

    expect(phones.map((phone) => phone.getAttribute("alt"))).toEqual([
      expect.stringContaining("Today screen for hotel staff"),
      expect.stringContaining("Home screen for a guest"),
    ]);
  });

  test("says what the app does in three short cards: guests, hotel staff and residents", async () => {
    await openAs(UA.mac);
    const cards = screen.getByRole("heading", { level: 2, name: "For guests" }).closest("ul");
    if (!cards) throw new Error("the cards sit outside their list");

    expect(within(cards).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "For guests",
      "For hotel staff",
      "For residents",
    ]);
  });

  test("each card is one short line, not a list", async () => {
    await openAs(UA.mac);
    const cards = screen.getByRole("heading", { level: 2, name: "For guests" }).closest("ul");
    if (!cards) throw new Error("the cards sit outside their list");

    // Three cards and nothing nested: the ticked lists were taken out on 2026-10-30.
    expect(within(cards).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(cards).getByText(
        "Clock in, see your next room, finish the checklist and report a problem from the floor.",
      ),
    ).toBeInTheDocument();
  });

  test("ends with one row each for iPhone, Android phones, Mac and Windows, each with its own button", async () => {
    await openAs(UA.mac);
    const rows = within(platformList()).getAllByRole("listitem");

    expect(rows).toHaveLength(4);
    const expected = [
      ["iPhone", BUTTON.ios],
      ["Android phones", BUTTON.android],
      ["Mac", BUTTON.mac],
      ["Windows", BUTTON.windows],
    ];
    for (const [i, [name, button]] of expected.entries()) {
      // `p`: the Mac and Windows buttons repeat the platform's name inside them.
      expect(within(rows[i]).getByText(name, { selector: "p" })).toBeInTheDocument();
      expect(within(rows[i]).getByRole("link", { name: button })).toBeInTheDocument();
    }
    expect(
      within(platformList()).getByText("Google Play. You can send it to your phone from this computer."),
    ).toBeInTheDocument();
  });
});

describe("/downloads on a phone (AC-2)", () => {
  test("an iPhone gets no QR panel and no desktop button, with the App Store first", async () => {
    await openAs(UA.iphone);

    expect(screen.queryByRole("img", { name: QR_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByText("Scan with your phone camera")).not.toBeInTheDocument();
    expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android]);
  });

  test("an iPad and an iPod are iPhones here", async () => {
    for (const userAgent of [UA.ipad, UA.ipod]) {
      await openAs(userAgent);
      expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android]);
      expect(screen.queryByRole("img", { name: QR_LABEL })).not.toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });

  test("an Android phone gets Google Play first, then the App Store", async () => {
    await openAs(UA.android);

    expect(screen.queryByRole("img", { name: QR_LABEL })).not.toBeInTheDocument();
    expect(heroOffers()).toEqual([BUTTON.android, BUTTON.ios]);
  });

  test("with no QR panel beside it, the label drops its Or", async () => {
    await openAs(UA.android);

    expect(screen.getByText("Download it straight away")).toBeInTheDocument();
    expect(screen.queryByText("Or download it straight away")).not.toBeInTheDocument();
  });

  test("the platform list keeps all four rows, since a phone may be looking for the desktop app", async () => {
    await openAs(UA.iphone);
    const list = platformList();

    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    for (const name of Object.values(BUTTON)) expect(within(list).getByRole("link", { name })).toBeInTheDocument();
    // "Send it to your phone from this computer" makes no sense on the phone itself.
    expect(within(list).queryByText(/from this computer/)).not.toBeInTheDocument();
  });
});

describe("the hero's desktop button follows the system (AC-3)", () => {
  test("Windows gets Download for Windows only", async () => {
    await openAs(UA.windows);
    expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android, BUTTON.windows]);
  });

  test("Linux gets both desktop buttons, Mac first", async () => {
    await openAs(UA.linux);
    expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android, BUTTON.mac, BUTTON.windows]);
  });

  test("a request with no User Agent at all gets both, and the QR panel", async () => {
    await openAs(null);

    expect(heroOffers()).toEqual([BUTTON.ios, BUTTON.android, BUTTON.mac, BUTTON.windows]);
    expect(screen.getByRole("img", { name: QR_LABEL })).toBeInTheDocument();
  });

  test("every download button reads as one name, with the space, and its mark stays silent", async () => {
    await openAs(UA.linux);

    for (const name of Object.values(BUTTON)) {
      const button = within(hero()).getByRole("link", { name });
      // No image inside it, so the platform mark adds nothing to what a screen reader says.
      expect(within(button).queryByRole("img")).not.toBeInTheDocument();
    }
  });
});

describe("every button goes through the links file (AC-5, AC-8)", () => {
  test("with all four links unset, every button opens its own platform's Coming soon", async () => {
    await openAs(UA.linux);

    for (const [platform, name] of Object.entries(BUTTON)) {
      const buttons = screen.getAllByRole("link", { name });
      expect(buttons).toHaveLength(2); // the hero and the platform list
      for (const button of buttons) {
        expect(button).toHaveAttribute("href", `/downloads/coming-soon?platform=${platform}`);
      }
    }
  });

  test("setting one link makes only that platform's buttons go live", async () => {
    links.windows = "https://downloads.injishi.com/Injishi-Setup.exe";
    await openAs(UA.windows);

    for (const button of screen.getAllByRole("link", { name: BUTTON.windows })) {
      expect(button).toHaveAttribute("href", "https://downloads.injishi.com/Injishi-Setup.exe");
    }
    for (const platform of ["ios", "android", "mac"] as const) {
      for (const button of screen.getAllByRole("link", { name: BUTTON[platform] })) {
        expect(button).toHaveAttribute("href", `/downloads/coming-soon?platform=${platform}`);
      }
    }
  });
});

describe("metadata (AC-9)", () => {
  test("has its own title, without the site suffix said twice", () => {
    expect(metadata.title).toEqual({ absolute: "Download the Injishi app" });
    expect(metadata.description).toMatch(/iPhone, Android, Mac and Windows/);
  });

  test("is canonical at /downloads with a share card for the same address", () => {
    expect(metadata.alternates?.canonical).toBe("/downloads");
    expect(metadata.openGraph).toMatchObject({ title: "Download the Injishi app", url: `${WEB_URL}/downloads` });
    expect(metadata.twitter).toBeDefined();
  });
});
