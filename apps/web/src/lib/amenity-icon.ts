import {
  BusFront,
  Bath,
  Check,
  Coffee,
  ConciergeBell,
  CircleParking,
  Dumbbell,
  PawPrint,
  Sparkles,
  Trees,
  Tv,
  Utensils,
  WavesLadder,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * The mark and the short name a card prints for one amenity.
 *
 * Two problems are solved here, and both come from the fixture data rather
 * than from the design.
 *
 * ONE: the `icon` field on an `Amenity` is unusable. The fixtures carry
 * Phosphor names ("kayak", "e-foil", "jet-ski", "wave-sine") that never
 * matched the app's lucide map, so every one of them would render nothing.
 * They are also wrong about the thing they label: "kayak" sits on an outdoor
 * swimming pool and "jet-ski" on a convention centre. Reading the LABEL is
 * both more reliable and more honest.
 *
 * TWO: the labels are written for the property page, where a line can be as
 * long as it likes. "Working tea plantation and guided tea tasting" and
 * "Well-stocked bar and restaurant with open terrace" are real entries. A card
 * gives an amenity about eight characters beside an icon, so the match also
 * returns the SHORT name, and the long label survives untouched on the
 * property page where there is room for it.
 *
 * Order matters: the first pattern that hits wins. "Well-stocked bar and
 * restaurant" is a bar first, so bar is tested before restaurant.
 */
export interface AmenityMark {
  Icon: LucideIcon;
  /** What the card prints. Not the label; see above. */
  short: string;
}

const RULES: Array<[RegExp, AmenityMark]> = [
  [/pool|jacuzzi|hot tub/i, { Icon: WavesLadder, short: "Pool" }],
  [/breakfast|coffee|caf[eé]|tea (tasting|plantation)/i, { Icon: Coffee, short: "Breakfast" }],
  [/wi-?fi|internet/i, { Icon: Wifi, short: "Free WiFi" }],
  [/\bbar\b|wine|cocktail|drinks/i, { Icon: Wine, short: "Bar" }],
  [/restaurant|dining|kitchen|board|meals/i, { Icon: Utensils, short: "Restaurant" }],
  [/spa|massage|sauna|steam/i, { Icon: Sparkles, short: "Spa" }],
  [/gym|fitness|yoga|health club|leisure centre/i, { Icon: Dumbbell, short: "Fitness" }],
  [/parking|garage/i, { Icon: CircleParking, short: "Parking" }],
  [/shuttle|airport|transfer/i, { Icon: BusFront, short: "Airport shuttle" }],
  [/front desk|reception|concierge/i, { Icon: ConciergeBell, short: "24h desk" }],
  [/pet|dog friendly/i, { Icon: PawPrint, short: "Pet friendly" }],
  [/bathroom|en-suite|shower|bath/i, { Icon: Bath, short: "En-suite" }],
  [/tv|television|screen/i, { Icon: Tv, short: "TV" }],
  [/garden|terrace|balcon|deck|view/i, { Icon: Trees, short: "Terrace" }],
];

/**
 * Falls back to a tick and the label's first two words rather than dropping
 * the amenity. A property whose only two entries are unusual still says
 * something true on its card, which is the point of the row.
 */
export function amenityMark(label: string): AmenityMark {
  for (const [pattern, mark] of RULES) {
    if (pattern.test(label)) return mark;
  }
  return { Icon: Check, short: label.split(" ").slice(0, 2).join(" ") };
}
