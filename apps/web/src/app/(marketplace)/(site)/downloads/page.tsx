import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, Camera, House, KeyRound, Monitor, SprayCan } from "lucide-react";
import { cn } from "@injishi/utils";
import { DownloadButton } from "@/components/downloads/download-buttons";
import { AndroidMark, AppleMark, WindowsMark } from "@/components/downloads/platform-marks";
import { QrCode } from "@/components/shared/qr-code";
import { detectDevice, isPhone, type Device, type Platform } from "@/lib/download-links";
import { shareMetadata } from "@/lib/share-metadata";
import { WEB_URL } from "@/lib/web-url";

/**
 * `/downloads`: where people get Injishi on iPhone, Android, Mac and Windows
 * (mobile spec 0004, design C).
 *
 * On a computer you scan one QR code to put the app on your phone, or download
 * the desktop app. On a phone you tap your phone's button. Every button and the
 * QR code go through the rules in `lib/download-links.ts`, so this page never
 * points at a store page that does not exist yet: until a platform's link is
 * set in `data/app-downloads.ts`, its buttons open its Coming soon screen.
 *
 * DEVICE AWARE, ON THE SERVER. The User Agent picks what the hero offers (AC-2,
 * AC-3), so the right buttons are in the first paint rather than swapped in
 * after hydration. That makes the page render per request, never static, which
 * is fine for a page this light. Below `md` the QR panel also hides on any
 * device, since a computer that narrow is rare and a phone cannot scan itself.
 */
const TITLE = "Download the Injishi app";
const DESCRIPTION =
  "Get Injishi on iPhone, Android, Mac and Windows. Book a stay, run your shift or pay your rent, wherever you are.";

export const metadata: Metadata = {
  // `absolute`: the title already names Injishi, so the site's "| Injishi" suffix would say it twice.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/downloads" },
  ...shareMetadata({ title: TITLE, description: DESCRIPTION, path: "/downloads" }),
};

/** The phone stores in hero order: the visitor's own store first (AC-2). */
function storesFor(device: Device): Platform[] {
  return device === "android" ? ["android", "ios"] : ["ios", "android"];
}

/** The desktop buttons the hero offers: none on a phone, the visitor's system on a computer, both when unsure (AC-3). */
function desktopsFor(device: Device): Platform[] {
  if (isPhone(device)) return [];
  if (device === "mac" || device === "windows") return [device];
  return ["mac", "windows"];
}

/** What the app does, one short line for each group of people it serves. */
const AUDIENCES = [
  {
    title: "For guests",
    body: "Book stays and things to do, pay with MoMo, then check in, order and settle the bill from your phone.",
    Icon: KeyRound,
  },
  {
    title: "For hotel teams",
    body: "Every shift in one app: rooms, repairs, the front desk, schedules, leave and pay.",
    Icon: SprayCan,
  },
  {
    title: "For residents",
    body: "Pay rent, report repairs, read building notices and manage your lease, all in one place.",
    Icon: House,
  },
] as const;

export default async function DownloadsPage() {
  const device = detectDevice((await headers()).get("user-agent"));
  const phone = isPhone(device);
  const heroButtons = [...storesFor(device), ...desktopsFor(device)];

  const platforms: { platform: Platform; name: string; detail: string; mark: React.ReactNode }[] = [
    {
      platform: "ios",
      name: "iPhone",
      detail: "App Store",
      mark: <AppleMark className="size-6 text-foreground" />,
    },
    {
      platform: "android",
      name: "Android phones",
      // Google Play's website can install an app on a phone signed in to the
      // same account, which helps someone reading this on a computer only.
      detail: phone ? "Google Play" : "Google Play. You can send it to your phone from this computer.",
      mark: <AndroidMark className="size-6 text-success-text" />,
    },
    {
      platform: "mac",
      name: "Mac",
      detail: "The desktop app for Mac computers.",
      mark: <Monitor className="size-6 text-foreground" strokeWidth={1.8} aria-hidden />,
    },
    {
      platform: "windows",
      name: "Windows",
      detail: "The desktop app for Windows PCs.",
      mark: <WindowsMark className="size-5 text-foreground" />,
    },
  ];

  return (
    <div className="page-y">
      <section className="container grid items-center gap-12 lg:grid-cols-[minmax(0,35rem)_minmax(0,1fr)] lg:gap-14">
        <div>
          <p className="text-sm font-bold tracking-[0.08em] text-accent-text uppercase">Get the app</p>
          {/* Sized to the screen like the footer wordmark rather than a step on
              the type scale: design C sets this at 80px, above `display-lg`. */}
          <h1 className="mt-4 text-[clamp(2.75rem,6vw,5rem)] leading-[0.98] tracking-[-0.025em] text-foreground">
            Take Injishi
            <br />
            with you
          </h1>

          {phone ? null : (
            <div className="mt-10 hidden items-center gap-5 rounded-card border border-border bg-surface p-4 md:flex">
              {/* A fixed white tile, so the code keeps its light quiet zone and
                  scans in the dark theme too (spec 0004, key invariants). */}
              <div className="shrink-0 rounded-card bg-white p-1 shadow-sm">
                <QrCode
                  value={`${WEB_URL}/get`}
                  size={140}
                  light="var(--white)"
                  ink="var(--ink)"
                  label="QR code to get the Injishi app on your phone"
                />
              </div>
              <div>
                <p className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Camera className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
                  Scan with your phone camera
                </p>
                <p className="mt-2 max-w-[34ch] text-base leading-normal text-muted-foreground">
                  One code for both phones. It opens the App Store on an iPhone and Google Play on Android.
                </p>
              </div>
            </div>
          )}

          <p className={cn("text-sm font-semibold text-muted-foreground", phone ? "mt-8" : "mt-8 md:mt-7")}>
            {phone ? (
              "Download it straight away"
            ) : (
              <>
                {/* "Or" only beside the QR panel, which is hidden below `md`. */}
                <span className="max-md:hidden">Or download it straight away</span>
                <span className="md:hidden">Download it straight away</span>
              </>
            )}
          </p>
          {/* Four buttons (a computer we cannot place) sit two by two rather than three and one. */}
          <div
            className={cn(
              "mt-3 gap-3",
              heroButtons.length === 4 ? "grid w-fit grid-cols-2" : "flex flex-wrap items-center",
            )}
          >
            {heroButtons.map((platform) => (
              <DownloadButton key={platform} platform={platform} />
            ))}
          </div>
          <p className="mt-5 text-base">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 rounded font-bold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Use it on the web
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </p>
        </div>

        <PhoneTile />
      </section>

      <section className="section-y container">
        <ul className="grid gap-5 md:grid-cols-3">
          {AUDIENCES.map(({ title, body, Icon }) => (
            <li key={title} className="rounded-card border border-border bg-surface p-8">
              <div className="grid size-14 place-items-center rounded-card bg-accent-soft text-accent-text">
                <Icon className="size-6.5" strokeWidth={1.8} aria-hidden />
              </div>
              <h2 className="mt-5 text-2xl text-foreground">{title}</h2>
              <p className="mt-2 text-base leading-normal text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="every-platform" className="container">
        <h2 id="every-platform" className="sr-only">
          Injishi on every platform
        </h2>
        {/* All four rows on every device (AC-2): someone on a phone may be looking for the desktop app. */}
        <ul className="overflow-hidden rounded-card border border-border">
          {platforms.map(({ platform, name, detail, mark }) => (
            <li
              key={platform}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border px-5 py-5 first:border-t-0 sm:px-7"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-card bg-surface-secondary">{mark}</div>
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-lg font-bold text-foreground">{name}</p>
                <p className="mt-0.5 text-base text-muted-foreground">{detail}</p>
              </div>
              <DownloadButton platform={platform} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * The tinted tile with two tilted phones: staff Today behind, guest Home in
 * front. The shots are cropped from the design prototype, so the names on them
 * ("Jeanne N.", "Sarah", "Isangano Lakeside") are marketing art, not data;
 * replace them with real store screenshots once the closed beta makes them.
 */
function PhoneTile() {
  return (
    <div className="relative aspect-[8/9] overflow-hidden rounded-card bg-[radial-gradient(120%_90%_at_70%_20%,var(--accent-soft)_0%,var(--surface)_55%,var(--surface-tertiary)_100%)]">
      <picture className="absolute top-[15.7%] left-[11.2%] w-[46.5%] -rotate-6">
        <source type="image/avif" srcSet="/assets/app/staff-today.avif" />
        <img
          src="/assets/app/staff-today.webp"
          width={390}
          height={830}
          alt="The Injishi app's Today screen for hotel staff: the shift, the next room to clean and the rooms after it."
          className="h-auto w-full drop-shadow-2xl"
        />
      </picture>
      <picture className="absolute top-[10%] left-[46.5%] w-[51.3%] rotate-[4deg]">
        <source type="image/avif" srcSet="/assets/app/guest-home.avif" />
        <img
          src="/assets/app/guest-home.webp"
          width={390}
          height={830}
          alt="The Injishi app's Home screen for a guest during a stay: the room, WiFi, room service and the bill."
          className="h-auto w-full drop-shadow-2xl"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
