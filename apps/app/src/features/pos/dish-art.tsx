/**
 * The picture of a dish or a drink. No photographs are stored, so each item gets a tile in a warm tint (brand and
 * status tokens only, picked per item so a section is not one flat colour) with a symbol for what it is, read from
 * its name or its section, or its initials when nothing matches. Decoration only: it is hidden from screen readers.
 */
const ART: [RegExp, string][] = [
  [/beer|lager|primus|mützig|skol|virunga/i, "🍺"],
  [/wine|rosé|sparkling/i, "🍷"],
  [/cocktail|mojito|margarita\b/i, "🍸"],
  [/spirit|cognac|rum|whisk|vodka|gin\b|amarula|tot\b/i, "🥃"],
  [/coffee|espresso|cappuccino|latte/i, "☕"],
  [/\btea\b|chai/i, "🍵"],
  [/juice|smoothie/i, "🧃"],
  [/soda|soft drink|coke|fanta/i, "🥤"],
  [/water/i, "💧"],
  [/burger/i, "🍔"],
  [/pizza|margherita/i, "🍕"],
  [/chips|fries/i, "🍟"],
  [/salad/i, "🥗"],
  [/fish|tilapia|sambaza/i, "🐟"],
  [/chicken/i, "🍗"],
  [/brochette|beef|goat|meat|stew|isombe/i, "🍢"],
  [/rice|beans/i, "🍛"],
  [/plantain|banana/i, "🍌"],
  [/pancake/i, "🥞"],
  [/ice cream/i, "🍨"],
  [/cake|dessert/i, "🍰"],
  [/fruit/i, "🍉"],
  [/birthday|party|set-up/i, "🎉"],
  [/fee|hire|corkage|cutting|service/i, "🧾"],
];

const TINT = [
  "bg-[radial-gradient(circle_at_30%_25%,var(--warning-soft),var(--surface)_75%)]",
  "bg-[radial-gradient(circle_at_70%_30%,var(--accent-soft),var(--surface)_75%)]",
  "bg-[radial-gradient(circle_at_40%_70%,var(--success-soft),var(--surface)_75%)]",
  "bg-[radial-gradient(circle_at_60%_40%,var(--warning-soft),var(--accent-soft)_90%)]",
];

/** The symbol for an item, or null when its name and section say nothing recognisable. */
export function dishSymbol(name: string, section = ""): string | null {
  return ART.find(([re]) => re.test(name))?.[1] ?? ART.find(([re]) => re.test(section))?.[1] ?? null;
}

/**
 * `tile` is the menu card's picture (full width); `thumb` a square beside a line on the bill or in a list.
 */
export function DishArt({
  name,
  section = "",
  size = "tile",
}: {
  name: string;
  section?: string;
  size?: "tile" | "thumb";
}) {
  const symbol = dishSymbol(name, section);
  const tint = TINT[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TINT.length];
  const initials = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const tile = size === "tile";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-separator/60 ${tint} ${
        tile ? "h-24 w-full rounded-2xl" : "size-11 rounded-xl"
      }`}
    >
      {symbol ? (
        <span
          className={`leading-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)] ${
            tile ? "text-[56px] transition group-enabled:group-hover:scale-110" : "text-[24px]"
          }`}
        >
          {symbol}
        </span>
      ) : (
        <span className={`font-bold text-foreground/60 ${tile ? "text-[26px]" : "text-[14px]"}`}>{initials}</span>
      )}
    </span>
  );
}
