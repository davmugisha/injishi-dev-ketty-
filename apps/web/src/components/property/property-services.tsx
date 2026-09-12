import { ServiceCard } from "@/components/services/service-card";
import type { ServiceListing } from "@/data/service-listings";

/**
 * The chargeable services one property sells, as a grid of service cards.
 *
 * IT REUSES `ServiceCard` RATHER THAN GROWING A SECOND CARD. The temptation
 * here is a compact row — a name, a franc figure and a chevron — because this
 * grid sits in the narrow left column of the property page rather than across
 * the full width of `/services`. It was not taken. A service card answers four
 * questions in the order a buyer arrives with them (what is it, whose is it,
 * what does it cost, how many people does it take), and the third and fourth
 * are the whole decision for a hall: a compact row that drops capacity, or
 * drops the unit beside the price, turns "RWF 3,200,000 per day" into a number
 * a reader cannot act on. A second card would also have to be kept in step with
 * the first every time the catalogue grows a field, and the two would drift.
 *
 * The card is already a `<Link>` to `/services/<slug>`, so every tile in this
 * grid is the hyperlink the property page owes — the detail page with the
 * gallery, the inclusions and the booking panel. Nothing here re-implements
 * that href.
 *
 * THE PROPERTY NAME IS NOT SUPPRESSED even though every card in this grid
 * belongs to the property whose page it is on. `ServiceCard` prints it under
 * the title, and hiding it would need a variant prop that exists for one
 * caller. It costs one line of repetition and buys a card that is identical on
 * both surfaces, which is what makes a reader who came from `/services`
 * recognise the tile they clicked.
 *
 * It takes the already-resolved list rather than a slug, because the page has
 * to know whether the list is empty before it can decide to print a heading at
 * all: a component that renders nothing still leaves "Book without staying"
 * standing over an empty column.
 */
export function PropertyServices({ services }: { services: ServiceListing[] }) {
  if (services.length === 0) return null;

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2">
      {services.map((service) => (
        <li key={service.slug} className="flex">
          <ServiceCard service={service} />
        </li>
      ))}
    </ul>
  );
}
