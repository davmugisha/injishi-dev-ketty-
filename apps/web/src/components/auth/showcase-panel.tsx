"use client";

import { useEffect, useState } from "react";
import { Button } from "@injishi/web-ui";

/**
 * The left half of /sign-in: a photo, a caption and five workspace tabs whose
 * progress bars fill as the carousel advances (ADR-017, AC-8 and AC-9).
 *
 * This replaces the only third of `public/shared/js/magnific-state.js` that
 * `/sign-in` ever used. The other two thirds drove a collapsible sidebar and a
 * header theme swap for a screen with a sidebar; this one has neither, and
 * 14.7 KB of script was being fetched for a carousel. The slides, the six
 * second dwell, the fifty millisecond tick and the four hundred millisecond
 * crossfade are carried over from that file so the screen keeps its rhythm.
 *
 * THE TABS ARE A BRAND STORY, NOT A CONTROL. Clicking one does not choose a
 * workspace and does not change what signing in does. Which workspaces a
 * person actually holds is decided by the API after a session exists.
 */

/** Full dwell per slide, and the tick the progress bar advances on. */
const SLIDE_MS = 6000;
const TICK_MS = 50;
const FADE_MS = 400;

type Slide = {
  tab: string;
  src: string;
  /** Only where a twin actually exists on disk; a <source> with no file is a 404. */
  avif?: string;
  video?: boolean;
  title: string;
  desc: string;
};

const WORKSPACES: readonly Slide[] = [
  {
    tab: "Personal",
    src: "/media/rwanda-apartment-interior.webp",
    title: "One account, every workspace",
    desc: "Book, host, rent and broker from a single Injishi identity — switch workspace anytime.",
  },
  {
    tab: "Host",
    src: "/media/injishi-self-check-in.webp",
    avif: "/media/injishi-self-check-in.avif",
    title: "Run a fast front desk",
    desc: "Arrivals, check-ins, walk-ins and departures — your whole day on one Today screen.",
  },
  {
    tab: "Landlord",
    src: "/media/rwanda-kigali-hero.webm",
    video: true,
    title: "Leases without the paper",
    desc: "E-sign contracts, watch the rent roll, and settle the Caution — no paper anywhere.",
  },
  {
    tab: "Broker",
    src: "/media/injishi-escrow-backed-booking.webp",
    title: "Place tenants, earn placement fees",
    desc: "The private directory of residence units: reveal contact, place a tenant, get paid.",
  },
  {
    tab: "Compliance",
    src: "/media/injishi-rra-compliance.webp",
    title: "RRA handled in the background",
    desc: "EBM e-invoices per sale and lease contracts auto-filed — compliance without the paperwork.",
  },
];

/** The capture froze mid-cycle on the Host slide, so that is where this opens. */
const FIRST = 1;

export default function ShowcasePanel() {
  const [current, setCurrent] = useState(FIRST);
  const [progress, setProgress] = useState(0);
  /**
   * Read in an effect rather than at render: `matchMedia` is browser-only, and
   * branching on it during render would make the server and client HTML differ.
   */
  const [reduced, setReduced] = useState(false);
  /**
   * Only slides that have been shown are mounted, so the first paint fetches
   * one image rather than four photos and a video. Mounting them all would be
   * a simpler crossfade and a much worse load, which is the thing this whole
   * change is about.
   */
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([FIRST]));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    // WCAG 2.2.2: nothing moves on its own under reduced motion. The bar rests
    // full so the active tab still reads, and clicking a tab still works.
    if (reduced) {
      setProgress(100);
      return;
    }
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK_MS / SLIDE_MS) * 100;
        if (next < 100) return next;
        setCurrent((i) => {
          const to = (i + 1) % WORKSPACES.length;
          setSeen((s) => (s.has(to) ? s : new Set(s).add(to)));
          return to;
        });
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  function goTo(i: number) {
    setCurrent(i);
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
    setProgress(reduced ? 100 : 0);
  }

  const slide = WORKSPACES[current];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        {WORKSPACES.map((s, i) =>
          seen.has(i) ? (
            <div
              key={s.tab}
              aria-hidden={i !== current}
              className="absolute inset-0"
              style={{
                opacity: i === current ? 1 : 0,
                transition: `opacity ${reduced ? 0 : FADE_MS}ms ease`,
              }}
            >
              {s.video ? (
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  src={s.src}
                  className="h-full w-full object-cover"
                />
              ) : (
                <picture>
                  {s.avif ? <source type="image/avif" srcSet={s.avif} /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={s.title}
                    className="h-full w-full object-cover"
                  />
                </picture>
              )}
            </div>
          ) : null,
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-6 bg-gradient-to-b from-transparent via-black/50 to-black/95 px-8 pb-8 pt-20 text-left">
        <div className="flex w-full flex-col gap-2">
          <h2 className="m-0 font-display text-2xl leading-[1.2] tracking-[-1px] text-white">
            {slide.title}
          </h2>
          <p className="m-0 text-xs font-medium text-white/75">{slide.desc}</p>
        </div>

        <div className="-mb-1 -ml-2 flex w-full gap-2">
          {WORKSPACES.map((s, i) => (
            <Button
              key={s.tab}
              variant="ghost"
              size="sm"
              shape="rounded"
              aria-label={s.tab}
              aria-current={i === current}
              onClick={() => goTo(i)}
              // This tab sits on the showcase PHOTOGRAPH, so it reads against
              // `white` rather than against a surface role, and `ghost`'s
              // theme-following ink would vanish on a light slide. `white` is a
              // project fixed token (ADR-010), not a raw colour.
              className="h-auto flex w-20 flex-col items-stretch gap-2 px-2 py-1 text-left bg-white/10 hover:bg-white/20"
            >
              <span className="truncate text-2xs font-medium uppercase text-white">
                {s.tab}
              </span>
              <span className="block h-1 w-full overflow-hidden rounded-full bg-white/20">
                <span
                  className="block h-full w-full origin-left bg-white"
                  style={{
                    transform: `scaleX(${i === current ? progress / 100 : 0})`,
                    // Fill by transform rather than width: the compositor can do
                    // it, and the bar ticks twenty times a second.
                    transition: i === current ? `transform ${TICK_MS}ms linear` : "none",
                  }}
                />
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
