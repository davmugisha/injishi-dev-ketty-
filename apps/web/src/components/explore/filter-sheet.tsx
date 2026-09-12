"use client";

import { ScrollShadow } from "@heroui/react";
import { Button, Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@injishi/ui";
import { FilterRailBody } from "@/components/explore/explore-filters";
import type { Listing } from "@/data/listings";
import type { ExploreRefinement, StayIntent } from "@/lib/search-params";

/**
 * The mobile path to the rail.
 *
 * Below `lg` the desktop rail in `explore-filters.tsx` renders `hidden`, and
 * this is what replaces it: the exact same `FilterRailBody`, inside a sheet
 * that slides up from the bottom rather than sitting fixed in a column. The
 * body is shared rather than duplicated so a facet added to one path is never
 * missing from the other — the "mobile keeps a usable filter path" rule this
 * component exists to satisfy would be trivial to break by hand-copying a
 * second rail that quietly falls behind the first.
 *
 * `resultCount` is read live by the caller and passed through so the sheet's
 * own footer can say how many stays the CURRENT selection leaves before the
 * guest commits to it, the same way a mobile filter sheet always does.
 */
export function FilterSheet({
  open,
  onOpenChange,
  listings,
  intent,
  refinement,
  onIntentChange,
  onRefinementChange,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
  resultCount: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88dvh] rounded-t-3xl p-0">
        <SheetHeader className="border-b border-separator px-5 py-4 text-left">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <ScrollShadow className="flex-1 scrollbar overflow-y-auto px-5 py-2">
          <FilterRailBody
            listings={listings}
            intent={intent}
            refinement={refinement}
            onIntentChange={onIntentChange}
            onRefinementChange={onRefinementChange}
          />
        </ScrollShadow>

        <div className="border-t border-separator p-4">
          <SheetClose asChild>
            <Button className="w-full" size="lg">
              Show {resultCount} {resultCount === 1 ? "property" : "properties"}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
