"use client";

import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import {
  ArrowRight,
  Check,
  GitCompare,
  Link2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@injishi/ui";
import { cn } from "@injishi/utils";
import { NoPhoto } from "@/components/stays/no-photo";
import type { Listing } from "@/data/listings";
import { amenityMark } from "@/lib/amenity-icon";
import { bookingUnit } from "@/lib/booking-unit";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { ratingLabel } from "@/lib/rating";
import { partyPrice } from "@/lib/party-price";
import { EMPTY_INTENT, MAX_PICKS, propertyHref, type StayIntent } from "@/lib/search-params";

/**
 * Compare properties.
 *
 * The rail's "Compare properties" tile turns compare mode on (`?compare=1`).
 * In that mode every result card carries a Compare checkbox, a tray floats at
 * the bottom of the screen with what has been picked, and "Compare" opens the
 * stays side by side in a sheet. The picks live in the URL (`?cmp=`, in pick
 * order), so a comparison survives a reload and can be sent as a link.
 *
 * Only real data is compared. `data/stay-facets.ts` invents cancellation,
 * payment and accessibility answers for the filter rail; none of those appear
 * here. Facilities come from each property's own amenity list, views only
 * from the two the amenity prose actually states.
 *
 * Rates are compared with care. A gorilla lodge quotes per person, all
 * inclusive; a Kigali hotel quotes per room, room only. So "Lowest rate" only
 * appears when every stay quotes on the same basis, and the sheet says why
 * when they do not.
 */

export const COMPARE_LIMIT = MAX_PICKS;

const photoOf = (listing: Listing): string | null =>
  listing.image ? (listing.image.src ?? `/assets/${listing.image.stem}.jpg`) : null;
const nameOf = (listing: Listing) =>
  `${listing.nameLead}${listing.nameRest ? ` ${listing.nameRest}` : ""}`;
const hrefOf = (listing: Listing, intent?: StayIntent) =>
  intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`;

/* --------------------------------------------------------------- toggle */

/** The checkbox laid over a result card's photo while compare mode is on. */
export function CompareToggle({
  listing,
  selected,
  disabled,
  onToggle,
}: {
  listing: Listing;
  selected: boolean;
  /** True when the tray is full and this stay is not already in it. */
  disabled: boolean;
  onToggle: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Compare ${nameOf(listing)}`}
      disabled={disabled}
      title={disabled ? `You can compare up to ${COMPARE_LIMIT} stays. Remove one first.` : undefined}
      onClick={(event) => {
        // The card is one big link; the checkbox must not open the stay.
        event.preventDefault();
        event.stopPropagation();
        onToggle(listing.slug);
      }}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-xs font-bold shadow-control ring-1 backdrop-blur transition-[background-color,color,transform] duration-quick ease-settle active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-foreground text-background ring-foreground"
          : "bg-card/95 text-foreground ring-border hover:bg-card",
        disabled && "cursor-not-allowed opacity-60 active:scale-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-5 items-center justify-center rounded-full transition-colors duration-quick",
          selected ? "bg-accent text-accent-foreground" : "bg-card ring-1 ring-inset ring-border",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {selected ? "Comparing" : "Compare"}
    </button>
  );
}

/* ----------------------------------------------------------------- tray */

/**
 * The tray floating at the bottom of the viewport: what is picked, room for
 * the rest, and the button that opens the comparison. Shown in compare mode.
 */
export function CompareTray({
  selected,
  onRemove,
  onClear,
  onOpen,
  onClose,
}: {
  selected: Listing[];
  onRemove: (slug: string) => void;
  onClear: () => void;
  onOpen: () => void;
  /** Leaves compare mode. The picks are kept for when it comes back. */
  onClose: () => void;
}) {
  const ready = selected.length >= 2;
  const empties = Math.max(0, COMPARE_LIMIT - selected.length);
  const hint =
    selected.length === 0
      ? "Tick Compare on any stay to start."
      : selected.length === 1
        ? "Pick at least one more stay."
        : selected.length === COMPARE_LIMIT
          ? "That's the most we can line up."
          : "Ready to compare. Add more if you like.";

  return (
    <div
      role="region"
      aria-label="Stays to compare"
      className="compare-tray pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:pb-6"
    >
      <div className="pointer-events-auto flex w-full max-w-wide flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-card/95 p-3 shadow-control ring-1 ring-border backdrop-blur-md sm:flex-nowrap sm:p-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative hidden size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground sm:flex">
            <GitCompare className="size-5" strokeWidth={2} aria-hidden />
            {selected.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-2xs font-bold text-background ring-2 ring-card">
                {selected.length}
              </span>
            ) : null}
          </span>
          <div className="min-w-0" aria-live="polite">
            <p className="text-sm font-bold text-foreground">
              {selected.length === 0 ? "Compare stays" : `${selected.length} of ${COMPARE_LIMIT} picked`}
            </p>
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>

        <ul className="flex flex-1 items-center gap-2 overflow-x-auto px-1 py-1.5">
          {selected.map((listing) => (
            <li key={listing.slug} className="compare-pop relative shrink-0" title={nameOf(listing)}>
              <span className="relative block size-12 overflow-hidden rounded-card ring-2 ring-card shadow-control">
                {listing.image ? (
                  <Image src={photoOf(listing)!} alt="" fill sizes="48px" unoptimized className="object-cover" />
                ) : (
                  <NoPhoto compact />
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(listing.slug)}
                aria-label={`Remove ${nameOf(listing)} from comparison`}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-control transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" strokeWidth={3} aria-hidden />
              </button>
            </li>
          ))}
          {Array.from({ length: empties }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-card border border-dashed border-slate-line text-muted-foreground"
            >
              <Plus className="size-4" strokeWidth={2} />
            </li>
          ))}
        </ul>

        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
          {selected.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
          <Button size="sm" disabled={!ready} onClick={onOpen} className="gap-1.5">
            Compare{selected.length > 0 ? ` ${selected.length}` : ""}
            <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden />
          </Button>
        </div>
      </div>

      <style jsx global>{`
        .compare-tray > div {
          animation: compare-rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .compare-pop {
          animation: compare-pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes compare-rise {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
        }
        @keyframes compare-pop {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .compare-tray > div,
          .compare-pop {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- sheet */

type Row = {
  label: string;
  /** An icon beside the label (the facilities rows use the amenity's own). */
  labelIcon?: typeof Check;
  /** What is shown in a cell. */
  cell: (listing: Listing) => ReactNode;
  /** What "the same" means for this row, for "Show only differences". */
  key: (listing: Listing) => string;
  /** The slugs to mark as best on this row, if any. */
  best?: ReadonlySet<string>;
  bestLabel?: string;
  note?: string;
};

type Section = { title: string; rows: Row[] };

const Yes = () => (
  <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
    <Check className="size-3.5" strokeWidth={3} aria-label="Yes" />
  </span>
);
const No = () => (
  <span className="flex size-6 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
    <Minus className="size-3.5" strokeWidth={2.6} aria-label="No" />
  </span>
);

const REAL_VIEWS = { lake: "Lake view", mountain: "Mountain view" } as const;

function buildSections(selected: Listing[], intent?: StayIntent): Section[] {
  const slugsWhere = (test: (l: Listing) => boolean) =>
    new Set(selected.filter(test).map((l) => l.slug));

  const sameBasis = new Set(selected.map((l) => shortBasis(l.priceBasis))).size === 1;
  const priced = selected.filter((l) => l.nightlyRateRwf !== null);
  const lowest =
    sameBasis && priced.length >= 2 ? Math.min(...priced.map((l) => l.nightlyRateRwf!)) : null;
  const rated = selected.filter((l) => l.rating !== null);
  const topScore = rated.length >= 2 ? Math.max(...rated.map((l) => l.rating!.score)) : null;
  const sleeps = selected.map((l) => l.maxGuests);
  const mostGuests = new Set(sleeps).size > 1 ? Math.max(...sleeps) : null;

  // Facilities: the union of what the compared stays list, most common first,
  // so the rows a guest is most likely to care about lead.
  const counts = new Map<string, number>();
  for (const l of selected) {
    for (const key of l.facets.amenityKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const facilities = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key);

  const views = (l: Listing) =>
    l.facets.views.filter((v): v is keyof typeof REAL_VIEWS => v in REAL_VIEWS);

  return [
    {
      title: "Price",
      rows: [
        {
          label: "Rate",
          cell: (l) =>
            l.nightlyRateRwf === null ? (
              <span className="font-bold">{NO_RATE}</span>
            ) : (
              <span>
                <span className="text-base font-bold">{formatRateNumber(l.nightlyRateRwf)} RWF</span>
                <span className="block text-xs text-muted-foreground">{shortBasis(l.priceBasis)}</span>
                {(() => {
                  const party = partyPrice(l.nightlyRateRwf, l.priceBasis, intent ?? EMPTY_INTENT);
                  return party ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {party.label}: <b className="font-bold text-foreground">{party.amount}</b>
                    </span>
                  ) : null;
                })()}
              </span>
            ),
          key: (l) => `${l.nightlyRateRwf}|${shortBasis(l.priceBasis)}`,
          best: lowest === null ? undefined : slugsWhere((l) => l.nightlyRateRwf === lowest),
          bestLabel: "Lowest rate",
          note:
            !sameBasis && priced.length >= 2
              ? "Quoted on different bases (per room, per person), so not directly comparable."
              : undefined,
        },
        { label: "Included", cell: (l) => l.priceIncludes || "—", key: (l) => l.priceIncludes },
      ],
    },
    {
      title: "Reviews",
      rows: [
        {
          label: "Guest rating",
          cell: (l) => {
            if (!l.rating) return <span className="text-muted-foreground">Not yet rated</span>;
            return (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex h-7 items-center rounded-full bg-accent px-2.5 text-xs font-bold text-accent-foreground">
                  {l.rating.score.toFixed(1)}
                </span>
                <span className="font-bold text-accent-text">{ratingLabel(l.rating)}</span>
              </span>
            );
          },
          key: (l) => String(l.rating?.score ?? "none"),
          best: topScore === null ? undefined : slugsWhere((l) => l.rating?.score === topScore),
          bestLabel: "Top rated",
        },
      ],
    },
    {
      title: "The stay",
      rows: [
        { label: "Type", cell: (l) => ACCOMMODATION_CLASS_LABEL[l.kind], key: (l) => l.kind },
        {
          label: "Star class",
          cell: (l) =>
            l.starClass ? (
              <span className="flex items-center gap-0.5" aria-label={`${l.starClass} stars`}>
                {Array.from({ length: l.starClass }, (_, i) => (
                  <Star key={i} className="size-4 fill-current text-warning" aria-hidden />
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">Unclassified</span>
            ),
          key: (l) => String(l.starClass ?? 0),
        },
        {
          label: "Sleeps",
          cell: (l) => `Up to ${l.maxGuests} ${l.maxGuests === 1 ? "guest" : "guests"}`,
          key: (l) => String(l.maxGuests),
          best: mostGuests === null ? undefined : slugsWhere((l) => l.maxGuests === mostGuests),
          bestLabel: "Sleeps most",
        },
        {
          label: "Bedrooms",
          cell: (l) => {
            const noun = bookingUnit(l.kind, `${l.nameLead} ${l.nameRest}`).one;
            return `${l.bedrooms} ${l.bedrooms === 1 ? "bedroom" : "bedrooms"} per ${noun}`;
          },
          key: (l) => String(l.bedrooms),
        },
        {
          label: "Views",
          cell: (l) =>
            views(l).length ? (
              views(l).map((v) => REAL_VIEWS[v]).join(", ")
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          key: (l) => views(l).join(","),
        },
      ],
    },
    {
      title: "Facilities",
      rows: facilities.map((key) => {
        const { Icon } = amenityMark(key);
        return {
          label: key,
          labelIcon: Icon,
          cell: (l: Listing) => (l.facets.amenityKeys.includes(key) ? <Yes /> : <No />),
          key: (l: Listing) => String(l.facets.amenityKeys.includes(key)),
        };
      }),
    },
    {
      title: "Where",
      rows: [
        {
          label: "Location",
          cell: (l) => (
            <span className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
              {l.location}
            </span>
          ),
          key: (l) => l.location,
        },
      ],
    },
  ];
}

/** The side-by-side comparison, in a bottom sheet. */
export function CompareSheet({
  open,
  onOpenChange,
  selected,
  onRemove,
  onAddMore,
  intent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Listing[];
  onRemove: (slug: string) => void;
  /** Closes the sheet so the guest can pick another stay from the list. */
  onAddMore: () => void;
  intent?: StayIntent;
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const sections = useMemo(() => buildSections(selected, intent), [selected, intent]);
  const visible = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          rows: onlyDifferences
            ? section.rows.filter((row) => new Set(selected.map(row.key)).size > 1)
            : section.rows,
        }))
        .filter((section) => section.rows.length > 0),
    [sections, onlyDifferences, selected],
  );
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const shownRows = visible.reduce((n, s) => n + s.rows.length, 0);
  const columns = selected.length + (selected.length < COMPARE_LIMIT ? 1 : 0);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard can be refused (permissions, insecure origin); the address
      // bar still holds the same link, so failing quietly loses nothing.
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[90dvh] flex-col rounded-t-3xl bg-card p-0">
        <SheetHeader className="flex flex-col gap-3 border-b border-separator px-5 py-4 text-left sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pr-16">
          <div>
            <SheetTitle className="text-xl">Compare stays</SheetTitle>
            <SheetDescription>
              {selected.length} stays side by side · rates per night, before dates are chosen
            </SheetDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={onlyDifferences}
              onClick={() => setOnlyDifferences((on) => !on)}
              className="flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-xs font-bold text-foreground ring-1 ring-border transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  "relative flex h-7 w-11 items-center rounded-full p-0.5 transition-colors duration-quick",
                  onlyDifferences ? "bg-accent" : "bg-surface-secondary ring-1 ring-inset ring-border",
                )}
              >
                <span
                  className={cn(
                    "size-6 rounded-full bg-card shadow-control transition-transform duration-quick ease-settle",
                    onlyDifferences ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </span>
              Only differences
            </button>
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5" aria-live="polite">
              {copied ? (
                <Check className="size-4" strokeWidth={2.6} aria-hidden />
              ) : (
                <Link2 className="size-4" strokeWidth={2.2} aria-hidden />
              )}
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-32 sm:w-48" />
              {Array.from({ length: columns }, (_, i) => (
                <col key={i} className="w-52 sm:w-64" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 border-b border-separator bg-card px-4 pb-4 pt-5 text-left align-bottom sm:px-8"
                >
                  <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                    {onlyDifferences ? `${shownRows} of ${totalRows} differ` : `${totalRows} details`}
                  </span>
                </th>
                {selected.map((l) => (
                  <th
                    key={l.slug}
                    scope="col"
                    className="sticky top-0 z-20 border-b border-separator bg-card px-3 pb-4 pt-5 text-left align-top font-normal"
                  >
                    <ColumnHead listing={l} intent={intent} onRemove={onRemove} />
                  </th>
                ))}
                {selected.length < COMPARE_LIMIT ? (
                  <th
                    scope="col"
                    className="sticky top-0 z-20 border-b border-separator bg-card px-3 pb-4 pt-5 align-top font-normal"
                  >
                    <button
                      type="button"
                      onClick={onAddMore}
                      className="group flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-slate-line text-muted-foreground transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-surface-secondary transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        <Plus className="size-5" strokeWidth={2.2} aria-hidden />
                      </span>
                      <span className="text-sm font-bold">Add another stay</span>
                      <span className="text-xs">
                        {COMPARE_LIMIT - selected.length} more {COMPARE_LIMIT - selected.length === 1 ? "slot" : "slots"}
                      </span>
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>

            {visible.map((section) => (
              <tbody key={section.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={columns + 1}
                    className="bg-surface-secondary px-4 py-2 text-left sm:px-8"
                  >
                    <span className="sticky left-4 text-xs font-bold uppercase tracking-widest text-foreground sm:left-8">
                      {section.title}
                    </span>
                  </th>
                </tr>
                {section.rows.map((row) => {
                  const LabelIcon = row.labelIcon;
                  return (
                    <tr key={row.label} className="group/row">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-separator bg-card px-4 py-3.5 text-left align-top font-normal transition-colors group-hover/row:bg-surface-secondary sm:px-8"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          {LabelIcon ? (
                            <LabelIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
                          ) : null}
                          {row.label}
                        </span>
                        {row.note ? (
                          <span className="mt-1 block whitespace-normal text-xs text-muted-foreground">
                            {row.note}
                          </span>
                        ) : null}
                      </th>
                      {selected.map((l) => {
                        const isBest = row.best?.has(l.slug) ?? false;
                        return (
                          <td
                            key={l.slug}
                            className={cn(
                              "border-b border-separator px-3 py-3.5 align-top text-foreground transition-colors group-hover/row:bg-surface-secondary",
                              isBest ? "bg-surface-secondary" : "bg-card",
                            )}
                          >
                            <div className="flex flex-col items-start gap-1.5 whitespace-normal">
                              {isBest && row.bestLabel ? (
                                <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-bold text-accent-foreground">
                                  <Star className="size-3 fill-current" aria-hidden />
                                  {row.bestLabel}
                                </span>
                              ) : null}
                              {row.cell(l)}
                            </div>
                          </td>
                        );
                      })}
                      {selected.length < COMPARE_LIMIT ? (
                        <td className="border-b border-separator bg-card transition-colors group-hover/row:bg-surface-secondary" />
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>

          {visible.length === 0 ? (
            <p className="px-8 py-12 text-center text-sm text-muted-foreground">
              These stays match on every detail we hold. Turn off “Only differences” to see them all.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ColumnHead({
  listing,
  intent,
  onRemove,
}: {
  listing: Listing;
  intent?: StayIntent;
  onRemove: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-card bg-surface-secondary">
        {listing.image ? (
          <Image src={photoOf(listing)!} alt={listing.image.alt} fill sizes="256px" unoptimized className="object-cover" />
        ) : (
          <NoPhoto />
        )}
        <button
          type="button"
          onClick={() => onRemove(listing.slug)}
          aria-label={`Remove ${nameOf(listing)} from comparison`}
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-card/95 text-foreground shadow-control transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" strokeWidth={2.4} aria-hidden />
        </button>
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-card/95 px-2 py-0.5 text-2xs font-bold text-foreground shadow-control">
          <ShieldCheck className="size-3 text-accent-text" strokeWidth={2.6} aria-hidden />
          Verified
        </span>
      </div>
      <div className="min-h-12">
        <p className="line-clamp-2 text-base font-bold leading-tight text-foreground">{nameOf(listing)}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.location}</p>
      </div>
      <Button asChild size="sm" className="w-full gap-1.5">
        <Link href={hrefOf(listing, intent)}>
          View stay
          <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
