import Image from "next/image";
import type { Amenity } from "@/data/properties";

/**
 * The catalogue's editorial amenities, as an icon list.
 *
 * Moved out of the property page unchanged when the API's facilities arrived
 * (ADR-050 D-k), because `PropertyFacilities` now decides which of the two
 * lists a property gets and has to be able to draw this one itself. It stays
 * the list a property with no record on Injishi shows, and the list every
 * property shows while the API has not answered.
 *
 * Every amenity, and no "more" link (ADR-044, D-a). This section ended in
 * `<Link href="#">More amenities</Link>`, sitting under a separator that
 * existed to set it apart. The list is not truncated — it maps the whole of
 * `items` — so the link offered a second copy of what the guest was already
 * reading, and `href="#"` meant it did not even offer that. There is no
 * amenities detail route to point it at, so the link went rather than moved.
 * Add one back only when this list starts cutting itself short and something
 * else holds the rest.
 */
export function AmenityList({ items }: { items: Amenity[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        // `available: false` means the house does not have it. Striking it
        // through rather than dropping it is what the reference does, and it
        // answers the question a guest actually came with.
        const unavailable = item.available === false;
        return (
          <li key={item.label} className="flex items-center gap-3">
            <Image
              src={`/assets/${item.icon}.svg`}
              alt=""
              width={24}
              height={24}
              className={`size-6 shrink-0 ${unavailable ? "opacity-40" : "opacity-70"}`}
            />
            <span
              className={
                unavailable
                  ? "text-sm text-page-fg-70 line-through"
                  : "text-sm text-page-fg"
              }
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
