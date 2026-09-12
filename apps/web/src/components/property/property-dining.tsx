import Link from "next/link";
import { Button, Separator } from "@injishi/ui";
import {
  availableOnly,
  diningOutlet,
  outletsForProperty,
  productsForProperty,
  type DiningOutlet,
} from "@/data/dining";
import { formatRwf } from "@/lib/money";

/**
 * How many lines of the card the property page shows before it stops.
 *
 * Six is two full rows on the two-column tablet step and fits the narrow left
 * column of the property page without pushing "Similar stays" below a second
 * screen. The Kigali Serena sells eleven, so the cut is real rather than
 * theoretical, and the count in the footer link says how many were held back —
 * a taster that does not admit it is a taster reads as the whole menu.
 */
const TASTE_LINES = 6;

/**
 * What an outlet's `kind` is called in prose.
 *
 * Declared here rather than in `data/dining.ts` because the fixture does not
 * export one and this is the only public surface that words it. If a second
 * surface ever needs the same three words, the map moves to the fixture and
 * this copy goes — one fact, one owner. Written as a `Record` over the union so
 * a fourth kind fails the build here instead of printing an empty string.
 */
const OUTLET_KIND_LABEL: Record<DiningOutlet["kind"], string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  cafe: "Café",
};

/**
 * The bar and restaurant a property runs, on the property page.
 *
 * WHAT IT IS FOR. A guest deciding between two hotels wants to know whether
 * they can eat without leaving, what that costs, and until when. So this shows
 * the outlets first — a name, what sort of room it is, and its hours, which is
 * the only figure on this section that changes the evening — and then a short
 * run of actual priced lines underneath, because "restaurant on site" is a
 * claim every hotel makes and a franc figure beside a dish is the thing that
 * makes it concrete.
 *
 * IT IS DELIBERATELY TEXT-SET, WITH NO DISH PHOTOGRAPHY. `data/dining.ts`
 * carries an `image` stem on every product, and its own header explains what
 * those stems are: scenery frames that exist on disk, standing in for dishes
 * nobody has photographed. Rendering them would put a hillside above "Beef
 * brochettes" on the page of a named, operating hotel — a picture that reads as
 * a photograph of the food in a way the demo notice cannot walk back. A menu
 * card set in type is also simply how a menu is read.
 *
 * Only what the kitchen is selling appears here. `availableOnly` is applied
 * before the slice, so the taster never opens on the two fixtures that are
 * marked sold out; the full menu page below shows those, struck and labelled,
 * because a reader planning dinner needs to know a line is off and a reader
 * skimming a hotel page does not.
 *
 * The order is the fixture's own menu order — `productsForProperty` sorts by
 * `DINING_CATEGORY_ORDER` — so the taster opens on starters and the grill
 * rather than on whichever line happens to be first in the array.
 */
export function PropertyDining({
  propertySlug,
  propertyName,
}: {
  propertySlug: string;
  propertyName: string;
}) {
  const outlets = outletsForProperty(propertySlug);
  if (outlets.length === 0) return null;

  // The taster is drawn from what is actually on sale; the COUNT in the footer
  // link is the whole card, sold-out lines included, because that is what the
  // menu page prints. Counting the taster's own source would quietly shrink the
  // menu by however many lines the kitchen is out of that day.
  const products = productsForProperty(propertySlug);
  const taste = availableOnly(products).slice(0, TASTE_LINES);

  return (
    <div className="flex flex-col gap-8">
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        {outlets.map((outlet) => (
          <li
            key={outlet.slug}
            className="flex flex-col gap-1 rounded-card border border-input p-4"
          >
            <span className="text-xs uppercase tracking-widest text-page-fg-70">
              {OUTLET_KIND_LABEL[outlet.kind]}
            </span>
            <b className="text-page-fg">{outlet.name}</b>
            <span className="text-sm text-page-fg-70">{outlet.hours}</span>
            <p className="mt-2 text-sm text-page-fg-70">{outlet.blurb}</p>
          </li>
        ))}
      </ul>

      {taste.length > 0 ? (
        <div className="flex flex-col">
          <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-widest text-page-fg-70">
            On the card
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {taste.map((product) => {
              // Resolved from the product's own outlet rather than from the
              // list above, because a hotel with a bar and a restaurant sells
              // brochettes in one and gin in the other, and a line that does
              // not say which room it belongs to sends the reader to the wrong
              // one at nine in the evening.
              const outlet = diningOutlet(product.outletSlug);
              return (
                <li
                  key={product.slug}
                  className="flex items-baseline justify-between gap-4 border-b border-input py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-page-fg">
                      {product.name}
                    </span>
                    <span className="text-xs text-page-fg-70">
                      {outlet ? outlet.name : propertyName}
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-medium text-page-fg">
                    {formatRwf(product.priceRwf)}
                  </span>
                </li>
              );
            })}
          </ul>

          <Separator className="mt-6" />
          <Button asChild variant="link" size="sm" className="mt-2 px-0">
            <Link href={`/property/${propertySlug}/menu`}>
              {products.length > taste.length
                ? `Full menu — all ${products.length} dishes and drinks`
                : "Full bar and restaurant menu"}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
