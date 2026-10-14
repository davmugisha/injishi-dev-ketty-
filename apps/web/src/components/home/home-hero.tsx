"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@injishi/utils";
import { StaySearchBar } from "@/components/search/stay-search-bar";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import type { Mood } from "@/data/journeys";

export interface MoodCard {
  mood: Mood;
  /** Stays Explore will list for this mood's districts. */
  count: number;
  href: string;
}

/**
 * The home hero: "Where do you want to wake up?"
 *
 * The search pill is the first action. Under it, four postcards answer the
 * question for the guest who has no destination yet — each is an ordinary
 * Explore search over a set of districts, with the live count on it. Hovering
 * or focusing one fades its photograph in over the video, so the page shows
 * the place before the guest commits to the click.
 *
 * The postcard photographs mount only once the pointer or focus reaches the
 * row: four full-width images loaded with the page would compete with the
 * still frame for the first paint, and most visitors search instead.
 *
 * A still frame paints immediately (AVIF with a WebP fallback, both
 * responsive) and the looping video layers over it once it can play.
 */
export function HomeHero({ moods }: { moods: MoodCard[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const activeMood = moods.find(({ mood }) => mood.id === active)?.mood;

  return (
    <section className="relative z-[11] h-dvh min-h-[680px] w-full overflow-hidden">
      {/* One even wash, no gradient: the video's brightest frames are sky,
          exactly where the header and the white type sit. 38% holds the
          header's contrast without the old top scrim. Inline because
          `color-mix()`'s commas do not survive Tailwind's arbitrary values. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[2]"
        style={{ backgroundColor: "color-mix(in srgb, var(--ink) 38%, transparent)" }}
      />

      <ArtDirectedImage
        stem="rwanda-lake-kivu"
        alt="Sunset over water with silhouetted mountains"
        sizes="100vw"
        width={1920}
        height={746}
        priority
        pictureClassName="absolute inset-0 block h-full w-full"
        className="z-0 h-full w-full object-center max-lg:object-[70%_0]"
      />

      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/oo-gorillas-nest-hero-960.avif"
        title="Stay anywhere in Rwanda"
        aria-hidden
        className="absolute left-0 top-0 z-[1] h-full w-full object-cover max-lg:object-[70%_0] [&::-webkit-media-controls]:!hidden [&::-webkit-media-controls-play-button]:!hidden [&::-webkit-media-controls-start-playback-button]:!hidden"
      >
        <source src="/media/oo-gorillas-nest-hero.webm" type="video/webm" />
        <source src="/media/oo-gorillas-nest-hero.mp4" type="video/mp4" />
        <track kind="captions" />
      </video>

      {/* The postcards' photographs, over the video and under both scrims. */}
      {armed
        ? moods.map(({ mood }) => (
            <div
              key={mood.id}
              aria-hidden
              className={cn(
                "absolute inset-0 z-[1] transition-opacity duration-travel ease-settle",
                active === mood.id ? "opacity-100" : "opacity-0",
              )}
            >
              <ArtDirectedImage
                stem={mood.image.stem}
                alt=""
                sizes="100vw"
                width={1920}
                height={1080}
                pictureClassName="block h-full w-full"
                className={cn("h-full w-full", active === mood.id && "animate-drift")}
              />
            </div>
          ))
        : null}

      <div className="absolute inset-0 z-10 flex flex-col items-center px-5 pb-20 pt-28 lg:pb-28">
        <div className="mt-auto flex w-full flex-col items-center">
          <h1 className="mb-1.5 text-center text-display-sm font-medium text-white max-lg:max-w-tile lg:text-display-md">
            Stay anywhere<span className="font-bold"> in Rwanda</span>
          </h1>
          <p className="animate-fade-up text-center text-xl leading-[1.2] text-white opacity-0 [animation-fill-mode:forwards] max-lg:mb-4 max-lg:max-w-tile lg:mb-2 lg:text-3xl">
            Guesthouses, lodges and serviced apartments, across Rwanda.
          </p>
          {/* /80, not /50: sampled against the real video, white at 50% fell
              under 4.5:1 on the brighter frames. */}
          <p className="animate-fade-up mb-8 max-w-wide text-center text-base text-white/80 opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards] max-lg:max-w-tile">
            Book verified guesthouses, lodges and serviced apartments across Rwanda.
            Escrow-backed payment, self check-in, and no phone calls from search to
            arrival.
          </p>

          <div className="animate-fade-up w-full opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards] max-lg:max-w-form lg:w-auto">
            <StaySearchBar />
          </div>
        </div>

        <div
          className="animate-fade-up mt-auto w-full max-w-page opacity-0 [animation-delay:0.35s] [animation-fill-mode:forwards]"
          onPointerEnter={() => setArmed(true)}
          onFocusCapture={() => setArmed(true)}
        >
          {/* The question, and each mood's answer, share one grid cell, so
              swapping them on hover never shifts the cards. */}
          <div className="mb-3 grid text-center text-sm font-semibold text-white">
            <p
              className={cn(
                "col-start-1 row-start-1 transition-all duration-travel ease-settle",
                activeMood ? "-translate-y-1 opacity-0" : "opacity-100",
              )}
            >
              Not sure yet? Where do you want to wake up?
            </p>
            {moods.map(({ mood }) => (
              <p
                key={mood.id}
                aria-hidden
                className={cn(
                  "col-start-1 row-start-1 transition-all duration-travel ease-settle",
                  activeMood?.id === mood.id ? "opacity-100" : "translate-y-1 opacity-0",
                )}
              >
                {mood.line}
              </p>
            ))}
          </div>
          <ul
            className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
            onPointerLeave={() => setActive(null)}
          >
            {moods.map(({ mood, count, href }) => (
              <li key={mood.id} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
                <Link
                  href={href}
                  data-mood={mood.id}
                  onPointerEnter={() => setActive(mood.id)}
                  onFocus={() => setActive(mood.id)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    "group flex items-center gap-3 rounded-card p-2 pr-4 text-white ring-1 backdrop-blur-md transition-colors duration-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                    active === mood.id
                      ? "bg-white/25 ring-white/50"
                      : "bg-white/10 ring-white/20 hover:bg-white/20",
                  )}
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-[0.875rem]">
                    <ArtDirectedImage
                      stem={mood.image.stem}
                      alt=""
                      sizes="56px"
                      width={112}
                      height={112}
                      pictureClassName="block h-full w-full"
                      className="h-full w-full transition-transform duration-travel ease-settle group-hover:scale-110"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-bold">{mood.label}</span>
                    <span className="truncate text-xs text-white/75">{mood.places}</span>
                    <span className="mt-0.5 text-xs font-semibold text-white">
                      {count} {count === 1 ? "stay" : "stays"}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 opacity-60 transition-transform duration-quick group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The Injishi outline mark, watermarked over the footage at 10% — the
          hero's signature since the first capture. Same placement as the
          original `before:`: anchored to the bottom on phones, lifted above
          the top edge at desktop and held to the wide measure. Above the
          wash and the mood photographs, under the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 z-[4] h-[900px] w-full -translate-x-1/2 bg-[url(/assets/injishi-short-white-outline.svg)] bg-contain bg-center bg-no-repeat opacity-10 max-lg:bottom-0 lg:top-[-10%] lg:max-w-wide"
      />
    </section>
  );
}
