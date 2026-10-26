import type { SVGProps } from "react";
import {
  Building,
  Building2,
  Castle,
  BedDouble,
  Hotel,
  House,
  KeyRound,
  Handshake,
  Tent,
  TreePalm,
  UtensilsCrossed,
} from "lucide-react";
import type { AccommodationClass } from "@injishi/contracts";
import type { HostKind } from "@/data/host";

/**
 * Property-type and location marks used by the search controls.
 *
 * Every mark is lucide's own geometry. Each wrapper keeps the name and the
 * default size its call sites already pass, and spreads props last so a
 * caller's `className` or `size` still wins.
 *
 * The eight classes are drawn with eight distinct lucide marks on purpose: the
 * `/host` funnel shows them side by side, so two classes sharing a glyph would
 * read as one. `residence` and `bar_restaurant` make ten marks on that card and
 * are the two that are not classes — see `ResidenceIcon` and
 * `BarRestaurantIcon`.
 */

type IconProps = SVGProps<SVGSVGElement>;
type MarkProps = IconProps & { size?: number };

function HouseIcon({ size = 24, ...props }: MarkProps) {
  return <House width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

function ApartmentIcon({ size = 24, ...props }: MarkProps) {
  return <Building2 width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/** A lodge is a stay set in the landscape, not a block on a street. */
function LodgeIcon({ size = 24, ...props }: MarkProps) {
  return <TreePalm width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

function HotelIcon({ size = 24, ...props }: MarkProps) {
  return <Hotel width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/** A villa is a grand standalone residence, so it reads heavier than a house. */
function VillaIcon({ size = 24, ...props }: MarkProps) {
  return <Castle width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/** A motel sells the room rather than the building, so the bed carries it. */
function MotelIcon({ size = 24, ...props }: MarkProps) {
  return <BedDouble width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

function TentedCampIcon({ size = 24, ...props }: MarkProps) {
  return <Tent width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/**
 * `other` is by definition unspecified — a business that genuinely does not fit
 * the seven named classes. A plain building says "a place" and claims nothing
 * more, which is the truthful drawing.
 */
export function OtherPropertyIcon({ size = 24, ...props }: MarkProps) {
  return <Building width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/**
 * Total over `AccommodationClass`, all 8 keys.
 *
 * Typed rather than widened to `Record<string, …>`: the `/host` funnel was the
 * one surface where a class rename produced a missing icon and no error at all,
 * because the lookup was cast to a string index and fell through to a default.
 * With this type, adding or renaming a class is a compile error here and in
 * every consumer (ADR-011 call 7).
 */
/**
 * A residence is the only tile on the `/host` card that is not a building type,
 * so it is the only one not drawn as a building. Every accommodation class
 * answers "what shape is the place"; this one answers "on what terms is it
 * let", and a key is that answer. Drawing it as another house would put it in
 * the row it is deliberately not in — and would collide with `HouseIcon`.
 */
function ResidenceIcon({ size = 24, ...props }: MarkProps) {
  return <KeyRound width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

const PropertyKindIcons: Record<
  AccommodationClass,
  (props: MarkProps) => React.JSX.Element
> = {
  hotel: HotelIcon,
  motel: MotelIcon,
  tented_camp: TentedCampIcon,
  guest_house: HouseIcon,
  apartment: ApartmentIcon,
  lodge: LodgeIcon,
  villa: VillaIcon,
  other: OtherPropertyIcon,
};

/**
 * The `/host` chooser's marks: every accommodation class plus `residence`.
 *
 * Spread from `PropertyKindIcons` rather than rewritten, so the totality above
 * still does its work — a renamed class is a compile error in ONE map and this
 * one inherits the fix. `HostKind` is imported from the data module that owns
 * the union, so the extra key cannot drift from the extra tile either.
 */
/**
 * A broker sells no building at all — they place a tenant in someone else's.
 * Two hands meeting is the only mark on the registration card that draws an
 * ACT rather than a property, which is exactly the distinction the tile makes.
 */
export function BrokerIcon({ size = 24, ...props }: MarkProps) {
  return <Handshake width={size} height={size} strokeWidth={1.7} aria-hidden {...props} />;
}

/**
 * A bar & restaurant sells a table, not a bed. It is the only tile on the
 * `/host` card that houses nobody overnight, so it is the only one drawn with
 * cutlery rather than with a building or a key — the mark has to carry that
 * difference on its own, because the tile sits beside eight buildings.
 */
function BarRestaurantIcon({ size = 24, ...props }: MarkProps) {
  return (
    <UtensilsCrossed
      width={size}
      height={size}
      strokeWidth={1.7}
      aria-hidden
      {...props}
    />
  );
}

export const HostKindIcons: Record<
  HostKind,
  (props: MarkProps) => React.JSX.Element
> = {
  ...PropertyKindIcons,
  residence: ResidenceIcon,
  bar_restaurant: BarRestaurantIcon,
};
