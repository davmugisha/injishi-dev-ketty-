"use client";

import {
  Bath,
  Briefcase,
  Check,
  Clock,
  ConciergeBell,
  Dumbbell,
  Flower2,
  PartyPopper,
  Shirt,
  ShieldCheck,
  ShoppingBag,
  Sofa,
  SquareParking,
  Store,
  Trees,
  Utensils,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@injishi/ui";
import type {
  FacilityOutlet,
  OutletKind,
  PropertyFacility,
} from "@injishi/contracts";
import { AmenityList } from "@/components/property/amenity-list";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  ORDERING_ACCESS_LABEL,
  OUTLET_KIND_LABEL,
  facilitiesToShow,
  fetchPropertyFacilities,
  hoursSummary,
} from "@/data/property-facilities";
import type { Amenity } from "@/data/properties";
import type { ApiResult } from "@/lib/api";

/** One glyph per outlet kind, so a long list can be scanned by shape. */
const KIND_ICON: Record<OutletKind, LucideIcon> = {
  restaurant: Utensils,
  bar: Wine,
  lounge: Sofa,
  banquet: PartyPopper,
  room_service: ConciergeBell,
  spa: Flower2,
  gym: Dumbbell,
  pool: Waves,
  gift_shop: ShoppingBag,
  parking: SquareParking,
  laundry: Shirt,
  business_center: Briefcase,
  other: Store,
};

/**
 * The amenity catalogue's own categories, as `amenities.category` holds them.
 *
 * Keyed by the label rather than an enum because the contract carries the
 * category as free text: a category added to the catalogue that is not here
 * still renders, with the plain check mark, instead of failing.
 */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  "Outdoors & views": Trees,
  Essentials: Check,
  Safety: ShieldCheck,
  Services: ConciergeBell,
  Bathroom: Bath,
  "Food & drink": Utensils,
};

/**
 * How many cards show before the rest fold behind "Show all".
 *
 * Eight is four rows of the two-column grid, about a screen in the narrow left
 * column. A hotel that lists twenty facilities would otherwise push "Similar
 * stays" three screens down, where the editorial list it replaced took one
 * short block. The fold opens IN PLACE: there is still no amenities route to
 * link to (ADR-044 D-a), and a guest who asked for the rest wants them here.
 */
const FOLD_AT = 8;

/**
 * The property page's amenities section: the API's facilities for a property on
 * Injishi, the catalogue's editorial amenities for one that is not.
 *
 * READ IN THE BROWSER so the page stays statically generated for the whole
 * catalogue, the same reason `BookingWidget` reads its rooms here rather than
 * on the server. The static HTML therefore carries the editorial list, and it
 * stays on screen while the API is asked: there is no spinner and no skeleton
 * in front of amenities that are already true. It is swapped only when the API
 * answers with a non empty list (`facilitiesToShow` owns that decision). A 404,
 * a timeout or a refusal leaves the editorial list exactly as it was, with no
 * error line — nothing the guest can act on has failed.
 *
 * The heading is the same word in both states, so the swap changes the list
 * under a guest's eye and never the section they are reading.
 */
export function PropertyFacilities({
  slug,
  amenities,
}: {
  slug: string;
  amenities: Amenity[];
}) {
  const [result, setResult] = useState<ApiResult<PropertyFacility[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchPropertyFacilities(slug);
      if (!cancelled) setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const facilities = facilitiesToShow(result);

  return (
    <section>
      <SectionHeading lead="Amenities" className="mb-6" />
      {facilities ? (
        <FacilityGrid facilities={facilities} />
      ) : (
        <AmenityList items={amenities} />
      )}
    </section>
  );
}

function FacilityGrid({ facilities }: { facilities: PropertyFacility[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  // Folding one card behind a button saves nothing, so a list only one past
  // the fold is shown whole.
  const folds = facilities.length > FOLD_AT + 1;
  const shown = folds && !expanded ? facilities.slice(0, FOLD_AT) : facilities;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-page-fg-70">
        As this property lists them on Injishi.
      </p>
      <ul
        id={listId}
        className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2"
      >
        {shown.map((facility) => (
          <li key={facility.key} className="flex">
            <FacilityCard facility={facility} />
          </li>
        ))}
      </ul>
      {folds ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          aria-controls={listId}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show fewer" : `Show all ${facilities.length}`}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One facility. Three shapes, one card (D-k).
 *
 * - An amenity alone says what it is and that it comes with the stay.
 * - An outlet alone says what it is, who may order, and when.
 * - An amenity an outlet points at is ONE card: the amenity face on top (the
 *   garden), then a hairline, then the outlet face beneath it (the bar in the
 *   garden, who it serves, its hours). Two cards for one garden is the
 *   duplication the link exists to prevent.
 */
function FacilityCard({ facility }: { facility: PropertyFacility }) {
  const { amenity, outlet } = facility;
  // The top face picks the glyph: a garden with a bar in it is a garden first.
  const Icon = amenity
    ? (amenity.category ? CATEGORY_ICON[amenity.category] : undefined) ?? Check
    : outlet
      ? KIND_ICON[outlet.outletKind]
      : Check;
  const eyebrow = amenity
    ? (amenity.category ?? "Amenity")
    : outlet
      ? OUTLET_KIND_LABEL[outlet.outletKind]
      : null;
  const title = amenity?.label ?? outlet?.name ?? "";

  return (
    <article className="flex w-full flex-col gap-3 rounded-card border border-input p-4">
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-page-fg-70" />
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow ? (
            <span className="text-xs uppercase tracking-widest text-page-fg-70">
              {eyebrow}
            </span>
          ) : null}
          <h3 className="font-sans text-base font-medium break-words text-page-fg">
            {title}
          </h3>
          {amenity ? (
            <span className="text-sm text-page-fg-70">Included with your stay</span>
          ) : null}
          {outlet && !amenity ? <OutletFace outlet={outlet} /> : null}
        </div>
      </div>

      {outlet && amenity ? (
        <OutletBelowAmenity outlet={outlet} />
      ) : null}
    </article>
  );
}

/** The outlet face under an amenity it also is, with its own glyph. */
function OutletBelowAmenity({ outlet }: { outlet: FacilityOutlet }) {
  const KindIcon = KIND_ICON[outlet.outletKind];
  return (
    <div className="flex items-start gap-3 border-t border-input pt-3">
      <KindIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-page-fg-70" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium break-words text-page-fg">
          {outlet.name}
          <span className="font-normal text-page-fg-70">
            {" · "}
            {OUTLET_KIND_LABEL[outlet.outletKind]}
          </span>
        </span>
        <OutletFace outlet={outlet} />
      </div>
    </div>
  );
}

/** What an outlet sells to whom, and when. Shared by both card shapes. */
function OutletFace({ outlet }: { outlet: FacilityOutlet }) {
  const hours = hoursSummary(outlet.hours);
  return (
    <>
      <span className="text-sm text-page-fg-70">
        {ORDERING_ACCESS_LABEL[outlet.orderingAccess]}
      </span>
      {hours ? (
        <span className="flex items-start gap-1.5 text-sm text-page-fg-70">
          <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{hours}</span>
        </span>
      ) : null}
      {/* Quiet on purpose: set only when someone other than the hotel runs
          it, and a guest needs to know whose bill they are on, not to be
          sold the operator. */}
      {outlet.operatorLabel ? (
        <span className="text-xs text-page-fg-70">Run by {outlet.operatorLabel}</span>
      ) : null}
    </>
  );
}
