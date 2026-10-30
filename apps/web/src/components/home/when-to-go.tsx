"use client";

import { ArrowRight, CloudRain, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@injishi/utils";
import { SectionHeading } from "@/components/shared/section-heading";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { MONTHS, SEASON_IMAGE, SEASON_LABEL, type Season } from "@/data/journeys";
import { formatWeekendDay, longWeekendIn } from "@/lib/long-weekend";
import { EMPTY_INTENT, exploreHref, todayInKigali } from "@/lib/search-params";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BAR: Readonly<Record<Season, string>> = {
  dry: "bg-accent",
  "short-rains": "bg-accent/45",
  "long-rains": "bg-muted-foreground/35",
};

/** Bar height for each rain level, as a share of the chart. */
const HEIGHT = ["18%", "40%", "68%", "100%"] as const;

/**
 * "When to go": the year as a rainfall chart, coloured by Rwanda's seasons,
 * beside a photograph of the season picked.
 *
 * Pick a month and the band suggests a long weekend in it and carries those
 * dates into Explore, so "July sounds good" becomes a dated search in one tap.
 * The seasons and the relative rainfall are editorial (`data/journeys.ts`):
 * the bars show more and less, never millimetres.
 */
export function WhenToGo() {
  const today = todayInKigali();
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const note = MONTHS[month];
  if (!note) return null;
  const dates = longWeekendIn(month, today);
  const dry = note.season === "dry";

  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="When "
        emphasis="to go"
        lede="Two dry seasons, two wet ones. Tap a month and we'll pick a long weekend in it."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-4 rounded-card bg-card p-4 ring-1 ring-border md:p-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CloudRain className="size-3.5" aria-hidden />
              More rain
            </span>
            <span className="hidden flex-wrap items-center gap-x-4 sm:flex">
              {(Object.keys(SEASON_LABEL) as Season[]).map((season) => (
                <span key={season} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", BAR[season])} aria-hidden />
                  {SEASON_LABEL[season]}
                </span>
              ))}
            </span>
          </div>

          <div role="radiogroup" aria-label="Month" className="grid h-48 grid-cols-12 gap-1 md:h-56 md:gap-2">
            {MONTHS.map((entry) => {
              const selected = entry.month === month;
              return (
                <button
                  key={entry.month}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${LONG[entry.month]}, ${SEASON_LABEL[entry.season]}`}
                  onClick={() => setMonth(entry.month)}
                  className="group flex h-full flex-col items-center justify-end gap-2 rounded-[0.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex w-full flex-1 items-end">
                    <span
                      aria-hidden
                      style={{ height: HEIGHT[entry.rain] }}
                      className={cn(
                        "w-full rounded-t-[0.5rem] rounded-b-[0.25rem] transition-all duration-travel ease-settle",
                        BAR[entry.season],
                        selected
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                          : "opacity-80 group-hover:opacity-100",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-2xs font-semibold md:text-xs",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {SHORT[entry.month]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-[22rem] overflow-hidden rounded-card bg-surface-secondary">
          {(Object.keys(SEASON_IMAGE) as Season[]).map((season) => (
            <div
              key={season}
              aria-hidden
              className={cn(
                "absolute inset-0 transition-opacity duration-arrive ease-settle",
                season === note.season ? "opacity-100" : "opacity-0",
              )}
            >
              <ArtDirectedImage
                stem={SEASON_IMAGE[season].stem}
                alt=""
                sizes="(max-width: 1024px) 100vw, 40vw"
                width={960}
                height={720}
                pictureClassName="block h-full w-full"
                className={cn("h-full w-full", season === note.season && "animate-drift")}
              />
            </div>
          ))}
          {/* The words sit on their own card over the photograph, not on a
              darkening fade: the photo stays bright, the type stays legible. */}
          <div className="relative flex h-full flex-col justify-end p-4">
            <div className="flex flex-col gap-3 rounded-[1.25rem] bg-card p-5 text-foreground shadow-control">
              <span className="flex w-max items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text">
                {dry ? (
                  <Sun className="size-3.5" strokeWidth={2.2} aria-hidden />
                ) : (
                  <CloudRain className="size-3.5" strokeWidth={2.2} aria-hidden />
                )}
                {SEASON_LABEL[note.season]}
              </span>
              <div key={month} className="animate-fade-up flex flex-col gap-0.5 opacity-0 [animation-fill-mode:forwards]">
                <p className="text-2xl font-bold leading-tight">{LONG[month]}</p>
                <p className="text-sm text-muted-foreground">{note.note}</p>
              </div>
              <Link
                href={exploreHref({ ...EMPTY_INTENT, ...dates })}
                className="inline-flex w-max items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-transform duration-quick hover:-translate-y-0.5"
              >
                Stays for {formatWeekendDay(dates.checkIn, today)} –{" "}
                {formatWeekendDay(dates.checkOut, today)}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
