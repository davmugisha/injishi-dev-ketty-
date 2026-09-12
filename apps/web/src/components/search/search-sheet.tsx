"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@injishi/ui";
import { ScrollShadow } from "@heroui/react";
import { cn } from "@injishi/utils";
import { StayDatePicker } from "@/components/search/stay-date-picker";
import { DestinationField } from "@/components/search/destination-field";
import { GuestPanel } from "@/components/search/guest-panel";
import type { Destination } from "@/data/destinations";
import { rankDestinations } from "@/lib/destination-search";
import {
  dateSummary,
  EMPTY_SEARCH,
  guestSummary,
  toDateRange,
  withDateRange,
  type StaySearch,
} from "@/lib/stay-search";

/**
 * The search, as a sheet, below `lg`.
 *
 * The three fields become three stacked cards with one expanded at a time, so
 * the answered steps stay on screen as summaries instead of being replaced by
 * the next question. The pill's segmented layout does not survive a 390px
 * viewport: at that width each zone is under 90px, which is narrower than the
 * shortest value any of them holds.
 */

type Step = "destination" | "dates" | "guests";

export function SearchSheet({
  open,
  onOpenChange,
  search,
  onChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: StaySearch;
  onChange: (next: StaySearch) => void;
  onSubmit: (next: StaySearch) => void;
}) {
  const [step, setStep] = useState<Step>("destination");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reopening lands on "where" again, and the field takes focus so the
  // keyboard is already up.
  useEffect(() => {
    if (!open) return;
    setStep("destination");
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  const dates = dateSummary(search.checkIn, search.checkOut, search.flexDays);
  const where = search.destination?.label ?? search.query.trim();

  const chooseDestination = (destination: Destination) => {
    onChange({ ...search, destination, query: destination.label });
    setStep("dates");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none bg-canvas p-0"
      >
        <DialogTitle className="sr-only">Search stays</DialogTitle>
        <DialogDescription className="sr-only">
          Choose where you are going, when, and how many people are coming
        </DialogDescription>

        <header className="flex items-center justify-between px-5 pb-3 pt-5">
          {/* The sheet pins itself white in both themes, so its controls take
              `inverse` — an always-white fill — rather than a theme-following
              outline that would invert underneath it. */}
          <Button
            variant="inverse"
            size="icon"
            aria-label="Close search"
            onClick={() => onOpenChange(false)}
            className="border border-black/10 bg-transparent hover:bg-black/5"
          >
            <X width={16} height={16} strokeWidth={1.7} aria-hidden />
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => onChange(EMPTY_SEARCH)}
            className="text-ink/60 underline hover:text-ink"
          >
            Clear all
          </Button>
        </header>

        <ScrollShadow className="flex-1 space-y-3 scrollbar overflow-y-auto px-4 pb-4">
          <StepCard
            title="Where to?"
            summary={where || "Anywhere in Rwanda"}
            expanded={step === "destination"}
            onExpand={() => setStep("destination")}
          >
            <div className="relative">
              <div className="mb-3 flex items-center gap-3 rounded-card border border-black/10 bg-white px-4 py-3">
                <DestinationField
                  query={search.query}
                  onQueryChange={(query) =>
                    onChange({ ...search, query, destination: null })
                  }
                  onSelect={chooseDestination}
                  open={false}
                  placeholder="District, park or stay"
                  inputRef={inputRef}
                />
              </div>
              {/* The sheet renders results inline rather than as a floating
                  panel; a popover inside a full-screen dialog on a phone ends
                  up either clipped or covering its own input. */}
              <InlineResults
                query={search.query}
                onSelect={chooseDestination}
              />
            </div>
          </StepCard>

          <StepCard
            title="When?"
            summary={dates ?? "Any week"}
            expanded={step === "dates"}
            onExpand={() => setStep("dates")}
          >
            <div className="-mx-2 origin-top scale-[0.92] sm:scale-100">
              <StayDatePicker
                variant="hero"
                range={toDateRange(search)}
                onChange={(range) => onChange(withDateRange(search, range))}
                flexDays={search.flexDays}
                onFlexChange={(flexDays) => onChange({ ...search, flexDays })}
                onDone={() => setStep("guests")}
              />
            </div>
          </StepCard>

          <StepCard
            title="Who's coming?"
            summary={guestSummary(search.guests)}
            expanded={step === "guests"}
            onExpand={() => setStep("guests")}
          >
            <GuestPanel
              guests={search.guests}
              onChange={(guests) => onChange({ ...search, guests })}
              onDone={() => onSubmit(search)}
            />
          </StepCard>
        </ScrollShadow>

        <div className="border-t border-black/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => onSubmit(search)}
            className="h-13 gap-2.5 text-base"
          >
            <Search width={18} height={18} strokeWidth={1.9} aria-hidden />
            Search stays
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A collapsed step shows its answer; the expanded one shows its control. */
function StepCard({
  title,
  summary,
  expanded,
  onExpand,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  if (!expanded) {
    return (
      <Button
        variant="inverse"
        shape="rounded"
        onClick={onExpand}
        className="h-auto w-full justify-between rounded-card px-5 py-4 text-left font-normal shadow-[0_2px_10px_-6px_rgba(4,35,48,0.3)] hover:bg-white/80"
      >
        <span className="text-sm text-ink/65">{title}</span>
        <span className="ml-4 min-w-0 truncate text-base text-ink">{summary}</span>
      </Button>
    );
  }

  return (
    <section className="rounded-card bg-white p-4 shadow-[0_10px_30px_-14px_rgba(4,35,48,0.4)]">
      <h2 className="mb-3 px-1 text-xl font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The ranked list, rendered in the flow of the sheet.
 *
 * Same ranking the desktop panel uses; the rows are drawn here rather than
 * reused from DestinationField because the sheet needs them in the document
 * flow, and that component's list is positioned as a floating panel.
 */
function InlineResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (destination: Destination) => void;
}) {
  const ranked = rankDestinations(query, 6);

  return (
    <ul className="overflow-hidden rounded-card border border-black/5">
      {ranked.map((hit) => (
        <li key={hit.destination.id}>
          <Button
            variant="inverse"
            shape="square"
            onClick={() => onSelect(hit.destination)}
            className={cn(
              "h-auto w-full justify-between gap-3 border-b border-black/5 px-4 py-3 text-left font-normal last:border-b-0",
              "active:bg-secondary",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-base leading-tight text-ink">
                {hit.destination.label}
              </span>
              <span className="block truncate text-sm leading-tight text-ink/65">
                {hit.destination.context}
              </span>
            </span>
            {hit.destination.count ? (
              <span className="shrink-0 text-xs tabular-nums text-ink/40">
                {hit.destination.count}
              </span>
            ) : null}
          </Button>
        </li>
      ))}
    </ul>
  );
}
