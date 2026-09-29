"use client";

import { CalendarDays, MapPin, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@injishi/ui";
import { useEffect, useRef, useState } from "react";
import { cn } from "@injishi/utils";
import { StayDatePicker } from "@/components/search/stay-date-picker";
import { DestinationField } from "@/components/search/destination-field";
import { GuestPanel } from "@/components/search/guest-panel";
import { SearchSheet } from "@/components/search/search-sheet";
import type { Destination } from "@/data/destinations";
import { usePanelPlacement } from "@/hooks/use-panel-placement";
import {
  dateSummary,
  EMPTY_SEARCH,
  GUESTS_PLACEHOLDER,
  searchGuestSummary,
  searchHref,
  toDateRange,
  withDateRange,
  type StaySearch,
} from "@/lib/stay-search";

/**
 * The hero search bar.
 *
 * One pill, three fields, one submit — destination, dates, guests. The version
 * this replaces offered property type, district and budget: three ways to
 * filter and no way to say where or when, so the only question a guest arrives
 * with could not be asked. Its panels were also rendered at `opacity-0` with
 * no handler bound, so none of them opened.
 *
 * Exactly one field is open at a time and the open one carries the wash, which
 * is what makes a four-zone pill readable at a glance. Below `lg` the whole
 * thing collapses to a summary button that opens the same three steps as a
 * sheet — a 44px-tall segmented pill on a phone is a row of mis-taps.
 */

type OpenField = "destination" | "dates" | "guests" | null;

export function StaySearchBar() {
  const router = useRouter();
  const [search, setSearch] = useState<StaySearch>(EMPTY_SEARCH);
  const [open, setOpen] = useState<OpenField>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The hero pill sits low on the page, so every panel measures its room
  // before it opens. 460px is the tallest of the three (the two-month
  // calendar); using one figure keeps all three panels on the same side.
  const placement = usePanelPlacement(barRef, open !== null, 460);
  const dates = dateSummary(search.checkIn, search.checkOut, search.flexDays);
  /**
   * Null until the guest says who is coming, and then the placeholder stands
   * in — the same treatment "Any week" already had.
   *
   * WHO used to print `guestSummary(DEFAULT_GUESTS)`, so a pill that had been
   * asked nothing answered "2 guests": the one field of the three that stated
   * a fact about the visitor's trip before they had said anything. It also
   * made the party look chosen, which is the half of it that matters — a guest
   * travelling alone or in six had no cue that the number was ours and not
   * theirs.
   */
  const guests = searchGuestSummary(search);
  const panelSide =
    placement === "top" ? "bottom-[calc(100%+12px)]" : "top-[calc(100%+12px)]";

  /** A click anywhere outside the pill closes whatever is open. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const submit = (next: StaySearch = search) => {
    setOpen(null);
    router.push(searchHref(next));
  };

  const chooseDestination = (destination: Destination) => {
    const next = { ...search, destination, query: destination.label };
    setSearch(next);
    // Picking a place answers "where"; "when" is the next question, so the
    // date panel takes over rather than leaving the guest to find it.
    setOpen("dates");
  };

  return (
    <div className="w-full">
      {/* ---------------- Desktop: the pill ---------------- */}
      <div
        ref={barRef}
        className="relative z-20 hidden w-[min(920px,calc(100vw-3rem))] lg:block"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className={cn(
            "flex items-center gap-1 rounded-full bg-white p-2 pl-3 transition-shadow duration-300",
            open
              ? "shadow-[0_24px_60px_-20px_rgba(4,35,48,0.55)]"
              : "shadow-[0_14px_40px_-18px_rgba(4,35,48,0.45)]",
          )}
        >
          {/* Where */}
          <Segment
            active={open === "destination"}
            className="flex-[1.5]"
            onClick={() => {
              setOpen("destination");
              inputRef.current?.focus();
            }}
          >
            <FieldLabel>Where</FieldLabel>
            <span className="flex items-center gap-2.5">
              <PinGlyph className="shrink-0 text-ink/40" />
              <DestinationField
                query={search.query}
                onQueryChange={(query) =>
                  setSearch((current) => ({ ...current, query, destination: null }))
                }
                onSelect={chooseDestination}
                open={open === "destination"}
                // A default value, not an instruction: it sits beside "Any
                // week", and "Search a district, park or stay" both repeated
                // the field's own label and broke that rhythm. The instruction
                // lives in the panel, where it is actionable. WHO is the one
                // exception and says so at `GUESTS_PLACEHOLDER`.
                placeholder="Anywhere in Rwanda"
                inputRef={inputRef}
                placement={placement}
              />
            </span>
          </Segment>

          <Divider hidden={open === "destination" || open === "dates"} />

          {/* When */}
          <Segment
            active={open === "dates"}
            className="flex-1"
            onClick={() => setOpen(open === "dates" ? null : "dates")}
          >
            <FieldLabel>When</FieldLabel>
            <span className="flex items-center gap-2.5">
              <CalendarGlyph className="shrink-0 text-ink/40" />
              <span
                className={cn(
                  "block truncate text-base leading-tight",
                  // /65, not /45: the search bar is white in both themes and
                  // ink/45 measured 2.83:1 on it. /65 is 5.19:1.
                  dates ? "text-ink" : "text-ink/65",
                )}
              >
                {dates ?? "Any week"}
              </span>
            </span>
            {open === "dates" ? (
              <div
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  "absolute left-1/2 z-50 -translate-x-1/2",
                  panelSide,
                )}
              >
                <StayDatePicker
                  variant="hero"
                  range={toDateRange(search)}
                  onChange={(range) =>
                    setSearch((current) => withDateRange(current, range))
                  }
                  flexDays={search.flexDays}
                  onFlexChange={(flexDays) =>
                    setSearch((current) => ({ ...current, flexDays }))
                  }
                  onDone={() => setOpen("guests")}
                />
              </div>
            ) : null}
          </Segment>

          <Divider hidden={open === "dates" || open === "guests"} />

          {/* Who */}
          <Segment
            active={open === "guests"}
            className="flex-1"
            onClick={() => setOpen(open === "guests" ? null : "guests")}
          >
            <FieldLabel>Who</FieldLabel>
            <span className="flex items-center gap-2.5">
              <GuestGlyph className="shrink-0 text-ink/40" />
              <span
                className={cn(
                  "block truncate text-base leading-tight",
                  // Muted while it is a placeholder, exactly as WHEN is, so
                  // the three zones read as one row of unanswered questions.
                  guests ? "text-ink" : "text-ink/65",
                )}
              >
                {guests ?? GUESTS_PLACEHOLDER}
              </span>
            </span>
            {open === "guests" ? (
              <div
                onClick={(event) => event.stopPropagation()}
                className={cn("absolute right-0 z-50", panelSide)}
              >
                <GuestPanel
                  guests={search.guests}
                  onChange={(guests) => setSearch((current) => ({ ...current, guests }))}
                  onDone={() => setOpen(null)}
                />
              </div>
            ) : null}
          </Segment>

          <Button
            type="submit"
            variant="primary"
            className="ml-1 h-14 shrink-0 gap-2.5 px-7 text-base"
          >
            <SearchGlyph />
            Search
          </Button>
        </form>
      </div>

      {/* ---------------- Mobile: summary button + sheet ---------------- */}
      <Button
        variant="inverse"
        onClick={() => setSheetOpen(true)}
        className="h-auto w-full justify-start gap-3 p-2 pl-5 text-left font-normal shadow-[0_14px_40px_-18px_rgba(4,35,48,0.45)] lg:hidden"
      >
        <span className="min-w-0 flex-1 py-1">
          <span className="block truncate text-base leading-tight text-ink">
            {search.destination?.label || search.query.trim() || "Where to?"}
          </span>
          <span className="block truncate text-sm leading-tight text-ink/65">
            {[dates ?? "Any week", guests ?? GUESTS_PLACEHOLDER].join(" · ")}
          </span>
        </span>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <SearchGlyph />
        </span>
      </Button>

      <SearchSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        search={search}
        onChange={setSearch}
        onSubmit={(next) => {
          setSheetOpen(false);
          submit(next);
        }}
      />
    </div>
  );
}

/**
 * One zone of the pill.
 *
 * `active` moves the wash. The whole zone is the hit target — the reference
 * makes only the text clickable in two of its three, which leaves dead pixels
 * inside a control that looks pressable everywhere.
 */
function Segment({
  active,
  className,
  onClick,
  children,
}: {
  active: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        // Only the zone ITSELF toggles. A key pressed on something inside it —
        // a night in the calendar, a stepper in the guest panel, the
        // destination input — belongs to that control. This used to exempt
        // the input alone, so Enter on a day button bubbled here, was
        // `preventDefault`ed before the button saw it, and closed the panel
        // instead of picking the night: a keyboard user could open the
        // calendar and never choose a date.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "relative min-w-0 cursor-pointer rounded-full px-5 py-2.5 transition-colors duration-200",
        // THE FOCUS INDICATOR LIVES HERE, not on the input inside it.
        // HeroUI's `.input:focus` ring drew a 2px orange box around the text,
        // inside a zone the wash had already marked. The zone is the control,
        // so the zone is what lights up. `focus-within` covers the tab-in case
        // the `open` state does not, and the ring is `focus-visible` only, so
        // a mouse user gets the wash alone.
        "outline-none focus-visible:ring-2 focus-visible:ring-focus has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus focus-within:bg-surface-tint",
        // `surface-tint`, not `ink-50`. THE NUMBERED INK RAMP DOES NOT EXIST
        // IN THIS LAYER. The public layer takes its roles from
        // `@injishi/design-tokens/heroui.css`, which ships the semantic roles
        // and not the ramps, so `--ink-50` resolves to nothing and `bg-ink-50`
        // compiled to nothing with it. The open field carried NO wash, which is
        // the one thing that says which of the four zones you are in. Checked
        // in the browser: `--surface-tint` resolves here, `--ink-50` does not.
        active ? "bg-surface-tint" : "hover:bg-black/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-0.5 block text-2xs font-medium uppercase tracking-wide text-ink/65">
      {children}
    </span>
  );
}

function Divider({ hidden }: { hidden: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-8 w-px shrink-0 bg-black/10 transition-opacity duration-200",
        hidden ? "opacity-0" : "opacity-100",
      )}
    />
  );
}

function SearchGlyph() {
  return <Search width={18} height={18} strokeWidth={1.9} aria-hidden />;
}

/**
 * The three field marks.
 *
 * All three carry the same 1.6 stroke, so the pill reads as one control rather
 * than three borrowed ones.
 */
const GLYPH = { width: 18, height: 18, strokeWidth: 1.6, "aria-hidden": true } as const;

function PinGlyph({ className }: { className?: string }) {
  return <MapPin {...GLYPH} className={className} />;
}

function CalendarGlyph({ className }: { className?: string }) {
  return <CalendarDays {...GLYPH} className={className} />;
}

function GuestGlyph({ className }: { className?: string }) {
  return <UserRound {...GLYPH} className={className} />;
}
