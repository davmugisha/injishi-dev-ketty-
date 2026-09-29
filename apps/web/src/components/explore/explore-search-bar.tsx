"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import { forwardRef, useState } from "react";
import { Checkbox, Popover, PopoverContent, PopoverTrigger } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { SearchIcon } from "@/components/icons";
import { MapPinIcon } from "@/components/icons/search";
import { GuestPanel } from "@/components/search/guest-panel";
import { StayDatePicker } from "@/components/search/stay-date-picker";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import { toParamDate, type StayIntent } from "@/lib/search-params";
import {
  DEFAULT_GUESTS,
  guestSummary,
  intentDateRange,
  intentDateSummary,
} from "@/lib/stay-search";

/**
 * The sticky search bar above the results.
 *
 * The reference keeps a compact "Where to? / Dates / Travelers" strip pinned
 * below the header as the list scrolls beneath it, so a guest can still change
 * the trip without scrolling back up. This is that strip, and it is
 * deliberately NOT the tall home-page pill.
 *
 * It is drawn the way the reference draws it: THREE SEPARATE bordered fields,
 * each 48px tall with its own icon, a small grey label over the value, and the
 * round submit button standing clear of them at the same 48px. It was one
 * divided pill with a chevron on each segment and the button welded to the
 * end, which is the shape that read as broken beside the reference — nothing
 * to aim at, one cue repeated three times, and the action dressed as a fourth
 * question.
 *
 * It edits INTENT only — where, when, who — the same three questions the
 * home hero asks. Refinement (type, price, amenities…) lives in the rail
 * below it; this bar is the funnel's shared vocabulary, not the rail's.
 */
export function ExploreSearchBar({
  intent,
  onIntentChange,
  onSubmit,
}: {
  intent: StayIntent;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onSubmit: () => void;
}) {
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  return (
    <div
      data-explore-searchbar
      // `top-16 md:top-20`, NOT `top-0`. The route wears the shared
      // `SiteHeader` now, which is FIXED, so a strip pinned to 0 would sit
      // under the bar rather than below it. The two offsets are the two states
      // the bar has: at rest it is 64px tall against the top edge, and once
      // scrolled it lifts to `top-4` at `md`, which puts its underside at
      // exactly 80px. Sticking to those numbers is what keeps the strip
      // touching the bar in both states instead of overlapping it in one.
      className="sticky top-16 z-[999998] border-b border-separator bg-background/95 py-3 backdrop-blur md:top-20"
    >
      <div className="container">
        {/*
          THREE SEPARATE FIELDS, not one divided pill. The reference draws each
          question as its own bordered box with its own icon, with the round
          submit button standing clear of all three — and read side by side
          with it, the single pill was the thing that looked wrong: the
          hairline dividers gave no edge to aim at, the chevrons repeated a
          "this opens" cue the label already carried, and the button was
          welded to the last field so it read as a fourth question rather than
          as the action.
        */}
        {/*
          WRAPS below `lg`, and that is the point of `flex-wrap` here. Three
          fields plus a 48px button across 375px left each one 90px, which is
          28px of text once the icon and the padding are paid for: every value
          rendered as "Any …" and the first label broke across two lines. The
          destination takes a full row of its own on a phone and the other two
          share the next one with the button, so all three stay readable. From
          `lg` the row is one line at the reference's widths.
        */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-max lg:flex-nowrap">
          <Popover>
            <PopoverTrigger asChild>
              <Trigger
                icon={MapPin}
                label="Where to?"
                value={districtLabel(intent.districts)}
                className="w-full flex-none lg:w-[340px]"
              />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[220px] border border-border p-3">
              <span className="block px-3 py-2 text-2xs font-medium text-black/50">
                DISTRICT
              </span>
              {SEARCH_DISTRICTS.map((district) => (
                <Checkbox
                  key={district.slug}
                  isSelected={intent.districts.includes(district.slug)}
                  onChange={() =>
                    onIntentChange({
                      districts: intent.districts.includes(district.slug)
                        ? intent.districts.filter((slug) => slug !== district.slug)
                        : [...intent.districts, district.slug],
                    })
                  }
                  className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-normal text-black transition-colors duration-150 hover:bg-secondary/60"
                >
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="shrink-0" />
                    {district.name}
                  </span>
                </Checkbox>
              ))}
            </PopoverContent>
          </Popover>

          <Popover open={datesOpen} onOpenChange={setDatesOpen}>
            <PopoverTrigger asChild>
              <Trigger
                icon={CalendarDays}
                label="Dates"
                value={intentDateSummary(intent) ?? "Any week"}
                className="lg:w-[250px]"
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={16}
              className="max-h-[var(--radix-popover-content-available-height)] w-auto scrollbar overflow-y-auto border-none p-0"
            >
              <StayDatePicker
                variant="hero"
                range={intentDateRange(intent)}
                onChange={(range) =>
                  onIntentChange({
                    checkIn: toParamDate(range?.from),
                    checkOut: range?.from ? toParamDate(range?.to) : null,
                  })
                }
                flexDays={intent.flex}
                onFlexChange={(flex) => onIntentChange({ flex })}
                onDone={() => setDatesOpen(false)}
              />
            </PopoverContent>
          </Popover>

          <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
            <PopoverTrigger asChild>
              <Trigger
                icon={Users}
                label="Travelers"
                value={guestSummary(intent.guests)}
                className="lg:w-[260px]"
              />
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={16} className="w-auto border-none p-0">
              <GuestPanel
                guests={intent.guests}
                // The panel can now UNASK the question, which the hero needs
                // and this bar cannot use: a URL always resolves a party, and
                // the list on screen really is filtered by it. Reset here
                // means back to the default party, not back to no answer.
                onChange={(guests) => onIntentChange({ guests: guests ?? DEFAULT_GUESTS })}
                onDone={() => setGuestsOpen(false)}
              />
            </PopoverContent>
          </Popover>

          {/*
            A round button standing on its own, sized to the fields beside it.
            It is the one ACTION in a row of four controls, and the reference
            separates it for that reason; welded flush to the last field it
            read as another field.
          */}
          <button
            type="button"
            onClick={onSubmit}
            aria-label="Search stays"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <SearchIcon className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `forwardRef`, because `PopoverTrigger asChild` clones this element and
 * needs a real DOM ref to measure and position against. A plain function
 * component here would leave the popover unable to anchor itself.
 */
const Trigger = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }
>(function Trigger({ label, value, icon: Icon, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        // `h-12` on every field, and the submit button is `size-12` beside
        // them, so the four controls share one baseline instead of each
        // taking the height its own text happened to need.
        "flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded border border-slate-line bg-white px-3 text-left text-black transition-colors hover:border-ink lg:flex-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {/*
        The icon carries the question, which is why the chevron is gone. Each
        field used to end in a downward arrow saying "this opens" — three
        times, on a row where every control opens — and the reference spends
        that space on a mark that says WHICH question instead.
      */}
      <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />

      {/*
        `w-full truncate`, not `max-w-[140px]`. A max-width caps how wide the
        value may grow; it does not make an over-long one shorten, so at 390px
        the three triggers rendered their values at full length and ran into
        each other — "Anywhere in RwandaAny week". Truncation needs a bounded
        width, and the `min-w-0` chain from the button down to here is what
        lets a flex item shrink below its content in the first place.
      */}
      <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
        <span className="whitespace-nowrap text-2xs font-normal text-black/65">{label}</span>
        <span className="block w-full truncate text-sm font-medium">{value}</span>
      </span>
    </button>
  );
});

function districtLabel(districts: string[]): string {
  if (districts.length === 0) return "Anywhere in Rwanda";
  if (districts.length === 1) {
    return SEARCH_DISTRICTS.find((d) => d.slug === districts[0])?.name ?? "1 district";
  }
  return `${districts.length} districts`;
}
