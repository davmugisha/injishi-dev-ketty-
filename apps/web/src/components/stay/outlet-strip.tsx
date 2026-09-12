"use client";

import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { productsForOutlet, type DiningOutlet } from "@/data/dining";
import { formatRwf } from "@/lib/money";

/** The kind, in the words a guest would use rather than the enum's. */
const KIND_LABEL: Record<DiningOutlet["kind"], string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  cafe: "Café",
};

/**
 * The places inside this hotel that sell food and drink.
 *
 * It is on the hub, above the order screen, because "what is open" is a
 * different question from "what shall I order" and a menu of twenty lines
 * answers it badly. The hours are the point: a guest deciding at half past
 * eleven at night wants to know the terrace bar is still on and the grill is
 * not.
 *
 * THE PHOTOGRAPH IS SCENERY AND IS TREATED AS SUCH. `data/dining.ts` says
 * plainly that no outlet and no dish has been photographed, and that every
 * `image` is a landscape frame that happens to be on disk. So the alt text
 * describes the frame's job — a decorative band — rather than claiming to show
 * the room, and the price line beneath carries the actual information.
 *
 * The lowest price is MEASURED from the outlet's own products rather than
 * typed, so it cannot drift from the card the next screen prints.
 */
export function OutletStrip({ outlets }: { outlets: DiningOutlet[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {outlets.map((outlet) => {
        const products = productsForOutlet(outlet.slug);
        const from = products.reduce(
          (lowest, product) => Math.min(lowest, product.priceRwf),
          Number.MAX_SAFE_INTEGER,
        );
        return (
          <li
            key={outlet.slug}
            className="overflow-hidden rounded-card border border-border bg-card"
          >
            <ArtDirectedImage
              stem={outlet.image}
              alt=""
              sizes="(min-width: 640px) 24rem, 100vw"
              width={960}
              height={420}
              className="h-32 w-full"
            />
            <div className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="font-display text-base font-bold tracking-tight">
                  {outlet.name}
                </h3>
                <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {KIND_LABEL[outlet.kind]}
                </span>
              </div>
              <p className="money mt-1 text-xs text-muted-foreground">{outlet.hours}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {outlet.blurb}
              </p>
              {products.length > 0 ? (
                <p className="money mt-3 text-xs font-semibold">
                  {products.length} {products.length === 1 ? "item" : "items"} · from{" "}
                  {formatRwf(from)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
