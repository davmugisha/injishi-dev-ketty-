"use client";

import { CalendarDays, ChevronDown, MapPin, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { SearchIcon } from "@/components/icons";
import { DestinationField } from "@/components/search/destination-field";
import { GuestPanel } from "@/components/search/guest-panel";
import { StayDatePicker } from "@/components/search/stay-date-picker";
import type { Destination } from "@/data/destinations";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import { propertyHref, toParamDate, type StayIntent } from "@/lib/search-params";
import {
  DEFAULT_GUESTS,
  guestSummary,
  intentDateRange,
  intentDateSummary,
} from "@/lib/stay-search";

/**
 * The search bar above the results: where, when, who.
 *
 * One raised panel with the three questions divided inside it and the search
 * button at its right end. "Where to?" is TYPEABLE: it ranks districts,
 * parks, neighbourhoods and stays by name as the guest types (the home hero's
 * `DestinationField`, so both surfaces suggest the same places), and a stay
 * picked there opens its page directly.
 *
 * From `lg` the bar is pinned under the header as a compact pill, with the
 * filter row (`below`) pinned under it. It publishes its bottom edge as
 * `--explore-band-bottom` so the map beside the list sits just under it.
 *
 * It edits INTENT only. Refinement (type, price, amenities…) lives in the
 * rail; this bar is the funnel's shared vocabulary, not the rail's.
 */
export function ExploreSearchBar({
  intent,
  onIntentChange,
  onSubmit,
  below,
}: {
  intent: StayIntent;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onSubmit: () => void;
  /** Pinned with the bar, under it: Explore's filter row. */
  below?: React.ReactNode;
}) {
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  // Publish the band's bottom edge for the pinned columns (see the doc above).
  // A ResizeObserver catches every size change; the layout effect below also
  // syncs straight after a fold or unfold, so the columns move in the same
  // frame as the band rather than one observer delivery later.
  const bandRef = useRef<HTMLDivElement | null>(null);
  const syncBand = useCallback(() => {
    const band = bandRef.current;
    if (!band) return;
    const root = document.documentElement;
    const pinned = window.matchMedia("(min-width: 1024px)").matches;
    // `top-20` (80px) is where the band pins under the fixed header.
    if (pinned) root.style.setProperty("--explore-band-bottom", `${80 + band.offsetHeight}px`);
    else root.style.removeProperty("--explore-band-bottom");
  }, []);
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const ro = new ResizeObserver(syncBand);
    ro.observe(band);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--explore-band-bottom");
    };
  }, [syncBand]);

  const place = placeLabel(intent);
  const dates = intentDateSummary(intent) ?? "Any week";
  const guests = guestSummary(intent.guests);

  return (
    <div
      ref={bandRef}
      data-explore-searchbar
      // `lg:top-20`, not `top-0`: the shared `SiteHeader` is fixed and 80px
      // tall from `md`, so the band pins exactly under it. Below `lg` the
      // panel stacks to three rows and pinning it would cover half a phone.
      //
      // The `before:` strip fills the 80px between the viewport top and the
      // band. The site header floats as a pill once scrolled (inset from the
      // edges, `md:top-4`), so without it the results scrolled up through
      // that gap and showed around the pill. The header stacks above it
      // (`z-[999999]` against this band's `z-[999998]`).
      className="relative z-[999998] border-b border-separator bg-background py-3 lg:sticky lg:top-20 lg:py-2.5 lg:before:pointer-events-none lg:before:absolute lg:before:inset-x-0 lg:before:bottom-full lg:before:h-20 lg:before:bg-background lg:before:content-['']"
    >
      <div className="container">
        <div className="mx-auto flex w-full max-w-wide flex-col rounded-card bg-card p-1.5 shadow-control ring-1 ring-border lg:flex-row lg:items-center lg:rounded-full lg:p-1 lg:pl-2">
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-separator lg:flex-row lg:divide-x lg:divide-y-0">
            <DestinationSegment
              intent={intent}
              onIntentChange={onIntentChange}
              open={destOpen}
              onOpenChange={setDestOpen}
            />

            <Popover open={datesOpen} onOpenChange={setDatesOpen}>
              <PopoverTrigger asChild>
                <Trigger icon={CalendarDays} label="Dates" value={dates} />
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
                <Trigger icon={Users} label="Travelers" value={guests} />
              </PopoverTrigger>
              <PopoverContent align="end" collisionPadding={16} className="w-auto border-none p-0">
                <GuestPanel
                  guests={intent.guests}
                  // A URL always resolves a party, so "reset" here means back
                  // to the default party, not back to no answer.
                  onChange={(next) => onIntentChange({ guests: next ?? DEFAULT_GUESTS })}
                  onDone={() => setGuestsOpen(false)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            aria-label="Search stays"
            className="mt-1.5 flex h-12 shrink-0 items-center justify-center gap-2 rounded-card bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:mt-0 lg:size-11 lg:rounded-full lg:px-0"
          >
            <SearchIcon className="size-5" />
            <span className="lg:sr-only">Search</span>
          </button>
        </div>
        {below ? <div className="mt-3">{below}</div> : null}
      </div>
    </div>
  );
}

/**
 * "Where to?", typeable. Shows the current place until focused; then the
 * guest types and picks:
 *
 *  - a district or a park   → filters by its district
 *  - a neighbourhood        → searches by its name (it appears in addresses)
 *  - a stay                 → opens that stay's page
 *  - free text + Enter      → searches every stay's name and address
 */
function DestinationSegment({
  intent,
  onIntentChange,
  open,
  onOpenChange,
}: {
  intent: StayIntent;
  onIntentChange: (next: Partial<StayIntent>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const current = placeLabel(intent);
  const hasPlace = intent.districts.length > 0 || intent.query.trim() !== "";

  // Close on a click anywhere outside the segment and its suggestions.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });

  const close = () => {
    onOpenChange(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const choose = (destination: Destination) => {
    if (destination.kind === "stay" && destination.slug) {
      close();
      router.push(propertyHref(destination.slug, intent));
      return;
    }
    if (destination.kind === "area" || !destination.district) {
      onIntentChange({ query: destination.label, districts: [] });
    } else {
      onIntentChange({ districts: [destination.district], query: "" });
    }
    close();
  };

  return (
    <div
      ref={boxRef}
      className="relative lg:flex-[1.25]"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <form
        role="search"
        onSubmit={(event) => {
          // Reached only when no suggestion claimed the Enter: free text.
          event.preventDefault();
          if (query.trim()) onIntentChange({ query: query.trim(), districts: [] });
          close();
        }}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex h-16 cursor-text items-center gap-3 px-4 transition-colors lg:h-12 lg:rounded-full",
          open ? "bg-surface-secondary" : "hover:bg-surface-secondary",
        )}
      >
        <MapPin className="size-5 shrink-0 text-foreground lg:size-4" strokeWidth={1.8} aria-hidden />
        <label className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Where to?</span>
          <DestinationField
            query={open ? query : current}
            onQueryChange={setQuery}
            onSelect={choose}
            open={open}
            placeholder={hasPlace ? current : "Search a place or a stay"}
            inputRef={inputRef}
            onFocus={() => {
              setQuery("");
              onOpenChange(true);
            }}
            inputClassName="font-medium lg:text-sm [--field-foreground:var(--foreground)] placeholder:text-muted-foreground"
          />
        </label>
        {hasPlace && !open ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIntentChange({ districts: [], query: "" });
            }}
            aria-label="Clear the place"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" strokeWidth={2.4} aria-hidden />
          </button>
        ) : null}
      </form>
    </div>
  );
}

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
        "group flex h-16 min-w-0 flex-1 items-center gap-3 px-4 text-left text-foreground transition-colors hover:bg-surface-secondary aria-expanded:bg-surface-secondary lg:h-12 lg:rounded-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <Icon className="size-5 shrink-0 text-foreground lg:size-4" strokeWidth={1.8} aria-hidden />

      {/* `w-full truncate` inside a `min-w-0` chain: truncation needs a
          bounded width, which the chain provides. */}
      <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
        <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
        <span className="block w-full truncate text-base font-medium lg:text-sm">{value}</span>
      </span>

      <ChevronDown
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-quick group-aria-expanded:rotate-180"
        strokeWidth={2.2}
        aria-hidden
      />
    </button>
  );
});

/** "Anywhere in Rwanda", "Musanze", "2 districts", or the searched text. */
function placeLabel(intent: StayIntent): string {
  const { districts, query } = intent;
  if (districts.length === 1) {
    return SEARCH_DISTRICTS.find((d) => d.slug === districts[0])?.name ?? "1 district";
  }
  if (districts.length > 1) return `${districts.length} districts`;
  if (query.trim()) return query.trim();
  return "Anywhere in Rwanda";
}
