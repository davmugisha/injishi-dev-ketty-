import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@injishi/ui";
import { findCatalogueProperty } from "@/data/catalogue";
import {
  DINING_CATEGORY_ORDER,
  availableOnly,
  diningOutlet,
  groupByCategory,
  outletsForProperty,
  productsForProperty,
  propertyHasDining,
} from "@/data/dining";
import { formatRwf } from "@/lib/money";
import { propertyMetadata, propertyStaticParams } from "@/lib/property-route";
import {
  DemoDataNotice,
  PROPERTY_DINING_DEMO_DETAIL,
} from "../demo-data-notice";

/**
 * One property's complete food and drink card.
 *
 * IT IS A CHILD OF THE PROPERTY RATHER THAN A GLOBAL `/menu/[outlet]`, and the
 * nesting carries the product rule. `data/dining.ts` records it as contract
 * C19: a product tied to a hotel is that hotel's, shown on that hotel's
 * surfaces and to that hotel's checked-in guests. A route keyed on the outlet
 * would have made a menu addressable without the business that cooks it, which
 * is the shape that lets an independent outlet's card turn up under a hotel
 * name. `productsForProperty` filters on the product's own `propertySlug` and
 * never widens to "and anything nearby", so this page can only ever print what
 * this property sells.
 *
 * `generateStaticParams` DOES NOT return the whole catalogue, unlike the
 * property page and the gallery beside it. Five of the fifty-two properties
 * have a menu; prerendering the other forty-seven would put forty-seven pages
 * on disk whose entire body is a heading over nothing, and would make
 * `/property/<any-slug>/menu` a URL that answers 200 for a lodge with no
 * kitchen. A slug outside the list falls through to `notFound()` below, so the
 * two agree: no menu, no page.
 *
 * The layout follows `gallery/page.tsx`, the other sub-route under a property —
 * a back link, a plain heading, and the content at the width it is read at.
 * `/property` is on `WHITE_HEADER_ROUTES` in `data/navigation.ts` and the
 * matcher treats it as a prefix, so this page inherits the white header and
 * must open on the page background rather than on a photographic hero.
 *
 * IT IS TEXT-SET FOR THE REASON `property-dining.tsx` gives: the `image` stem
 * on every product is scenery standing in for food nobody has photographed, and
 * a hillside above "Beef brochettes" is a claim the demo notice cannot undo.
 */

export function generateStaticParams() {
  return propertyStaticParams().filter(({ slug }) => propertyHasDining(slug));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return propertyMetadata(params, (property) => ({
    title: `${property.name} bar and restaurant`,
    description: `The bar and restaurant card at ${property.name} in ${property.location}, with prices in Rwandan francs.`,
  }));
}

export default async function PropertyMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = findCatalogueProperty(slug);
  // Two conditions, one refusal. An unknown slug and a property with no kitchen
  // are the same answer to a reader — there is no menu at this address — and
  // splitting them would mean writing an empty-menu screen for a page that
  // should not exist.
  if (!property || !propertyHasDining(slug)) notFound();

  const outlets = outletsForProperty(slug);
  const products = productsForProperty(slug);
  const sections = groupByCategory(products);
  const soldOut = products.length - availableOnly(products).length;

  return (
    <div className="bg-background">
      <div className="container flex max-w-wide flex-col gap-8 pb-24 pt-24 lg:pt-28">
        <div className="flex flex-col gap-2">
          <Link
            href={`/property/${property.slug}`}
            className="inline-flex w-max items-center gap-2 text-sm text-page-fg-70 underline underline-offset-4 transition-colors hover:text-page-fg"
          >
            <ChevronLeft width={14} height={14} strokeWidth={1.5} aria-hidden />
            Back to {property.name}
          </Link>
          <h1 className="text-[clamp(1.375rem,2.5vw,1.875rem)] font-semibold leading-tight text-page-fg">
            Bar &amp; restaurant
          </h1>
          <p className="text-base text-page-fg-70">
            {/* The counts are derived, never typed in beside the fixture. A
                headline figure maintained by hand is the first thing to go
                stale when a dish is added, and a card that undercounts itself
                reads as abandoned. */}
            {products.length} dishes and drinks across {outlets.length}{" "}
            {outlets.length === 1 ? "outlet" : "outlets"} at {property.name}
            {soldOut > 0
              ? `. ${soldOut} ${soldOut === 1 ? "line is" : "lines are"} off today.`
              : "."}
          </p>
        </div>

        <DemoDataNotice detail={PROPERTY_DINING_DEMO_DETAIL} />

        {/* The outlets before the card, because "where" comes before "what": a
            hotel with a grill in the garden and a terrace bar above it serves
            two different rooms at two different hours, and the category
            headings below cannot say that. */}
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          {outlets.map((outlet) => (
            <li
              key={outlet.slug}
              className="flex flex-col gap-1 rounded-card border border-input p-4"
            >
              <b className="text-page-fg">{outlet.name}</b>
              <span className="text-sm text-page-fg-70">{outlet.hours}</span>
              <p className="mt-2 text-sm text-page-fg-70">{outlet.blurb}</p>
            </li>
          ))}
        </ul>

        {/*
          Sections run in `DINING_CATEGORY_ORDER` — starters, the grill, the
          lake, mains, and out through the drinks — which is the order a menu is
          printed in. `groupByCategory` derives the headings from the products
          actually present rather than from the full order list, so a property
          that sells no desserts never prints a Desserts rule with nothing under
          it.
        */}
        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <section key={section.category}>
              <h2 className="mb-4 font-sans text-sm font-semibold uppercase tracking-widest text-page-fg-70">
                {section.category}
              </h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {section.products.map((product) => {
                  const outlet = diningOutlet(product.outletSlug);
                  return (
                    <li
                      key={product.slug}
                      className="flex items-start justify-between gap-6 border-b border-input py-4"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Struck rather than dropped, the same treatment
                              `AmenityList` gives a facility the house does
                              not have: a reader who came for the goat
                              brochettes is answered, and a menu that silently
                              omits them leaves them asking at the desk. */}
                          <span
                            className={
                              product.available
                                ? "text-base font-medium text-page-fg"
                                : "text-base font-medium text-page-fg-70 line-through"
                            }
                          >
                            {product.name}
                          </span>
                          {product.available ? null : (
                            <Badge variant="subtle" size="sm">
                              Off today
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-page-fg-70">
                          {product.description}
                        </p>
                        {outlet ? (
                          <span className="text-xs uppercase tracking-widest text-page-fg-70">
                            {outlet.name}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={
                          product.available
                            ? "shrink-0 whitespace-nowrap text-base font-medium text-page-fg"
                            : "shrink-0 whitespace-nowrap text-base font-medium text-page-fg-70"
                        }
                      >
                        {formatRwf(product.priceRwf)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/*
          Room service is a link and not a button, and the sentence does the
          work the link cannot. `/stay` is on `PROTECTED_PREFIXES` in
          `middleware.ts`, so a reader with no session is bounced to `/sign-in`
          rather than shown a cart — which is correct, because ordering to a
          room only means anything for somebody in one. The wording therefore
          names the condition BEFORE the link rather than after it: a bare
          "Order to your room" on a public marketplace page reads as an offer to
          everyone reading it, and the reader who is not staying here finds that
          out by being sent to a sign-in screen.
        */}
        <aside className="flex flex-col gap-2 rounded-card border border-input bg-secondary p-5">
          <b className="text-page-fg">Staying at {property.name}?</b>
          <p className="text-sm text-page-fg-70">
            Guests who have checked in order this card to their room, and the
            kitchen answers in the same thread the order was placed from.
          </p>
          <Link
            href="/stay/order"
            className="w-max text-sm text-page-fg underline underline-offset-4"
          >
            Order to your room
          </Link>
        </aside>

        {/* The category vocabulary is the fixture's, and the count is read from
            it so this line cannot claim a section the menu does not have. */}
        <p className="text-xs text-page-fg-70">
          Sections follow the house menu order — {sections.length} of the{" "}
          {DINING_CATEGORY_ORDER.length} the kitchen writes to. Every figure is
          in Rwandan francs.
        </p>
      </div>
    </div>
  );
}
