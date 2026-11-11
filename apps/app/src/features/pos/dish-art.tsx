/**
 * The picture of a dish or a drink. The catalogue stores no photographs yet, so each item gets a real photograph
 * from the bundled library in `/public/menu` (credits in `/public/menu/CREDITS.md`), picked from its name first and
 * its section second. An item neither says anything about (a test entry, a typo) gets a calm initials tile, never a
 * drawing. Decoration only: hidden from screen readers, since the name is always written beside it.
 */
const BY_NAME: [RegExp, string][] = [
  [/mandazi/i, "mandazi"],
  [/mojito/i, "mojito"],
  [/pi[ñn]a colada/i, "pina_colada"],
  [/long island/i, "long_island"],
  [/tequila sunrise/i, "tequila_sunrise"],
  [/caipirinha/i, "caipirinha"],
  [/cocktail|daiquiri|margarita\b/i, "mojito"],
  [/beer|lager|primus|m[üu]tzig|skol|virunga|heineken|guinness/i, "beer"],
  [/ros[ée]/i, "rose_wine"],
  [/sparkling|champagne|prosecco/i, "sparkling"],
  [/white wine/i, "white_wine"],
  [/wine/i, "red_wine"],
  [/whisk/i, "whisky"],
  [/vodka/i, "vodka"],
  [/\bgin\b/i, "gin"],
  [/\brum\b/i, "rum"],
  [/cognac|brandy/i, "cognac"],
  [/amarula|baileys|liqueur/i, "amarula"],
  [/cappuccino|latte|macchiato/i, "cappuccino"],
  [/espresso/i, "espresso"],
  [/coffee|americano/i, "americano"],
  [/african tea|chai|spiced tea/i, "african_tea"],
  [/\btea\b/i, "tea"],
  [/passion/i, "passion_juice"],
  [/pineapple/i, "pineapple_juice"],
  [/tree tomato|tamarillo/i, "tomato_juice"],
  [/juice|smoothie/i, "fresh_juice"],
  [/soda|soft drink|coke|cola|fanta|sprite|tonic/i, "soda"],
  [/water/i, "water"],
  [/chicken burger/i, "chicken_burger"],
  [/bean burger|veggie burger/i, "bean_burger"],
  [/burger/i, "beef_burger"],
  [/pizza|margherita/i, "pizza"],
  [/sandwich|toast/i, "sandwich"],
  [/fruit salad|fruit plate|fruit/i, "fruit_plate"],
  [/salad/i, "salad"],
  [/tilapia|whole fish/i, "whole_fish"],
  [/sambaza|sardine/i, "sambaza"],
  [/fish/i, "fish_fillet"],
  [/wings/i, "wings"],
  [/samosa/i, "samosa"],
  [/chicken stew|chicken curry/i, "chicken_stew"],
  [/brochette|kebab|skewer|mishkaki/i, "brochette"],
  [/grilled chicken|chicken quarter|roast chicken|chicken/i, "grilled_chicken"],
  [/stew/i, "goat_stew"],
  [/isombe|cassava leaves/i, "isombe"],
  [/ugali|posho/i, "ugali"],
  [/beans/i, "beans_rice"],
  [/curry/i, "curry"],
  [/fillet|steak|pepper sauce/i, "beef_fillet"],
  [/chips masala|masala chips/i, "chips_masala"],
  [/chips|fries/i, "chips"],
  [/plantain|matoke|banana(?! pancake)/i, "plantain"],
  [/umuceri|\brice\b/i, "rice"],
  [/pancake/i, "pancakes"],
  [/ice cream|gelato/i, "ice_cream"],
  [/omelette|eggs?\b/i, "omelette"],
  [/full breakfast|english breakfast/i, "full_breakfast"],
  [/continental|breakfast|croissant/i, "continental"],
  [/birthday|party|set-up/i, "birthday"],
  [/cake/i, "cake"],
  [/corkage/i, "corkage"],
  [/delivery/i, "delivery"],
  [/hire|private room|room booking/i, "room_hire"],
  [/meat|beef|goat|nyama/i, "brochette"],
];

/** When the name says nothing, the section usually does. */
const BY_SECTION: [RegExp, string][] = [
  [/beer/i, "beer"],
  [/wine/i, "red_wine"],
  [/cocktail/i, "mojito"],
  [/spirit/i, "whisky"],
  [/coffee|tea/i, "americano"],
  [/juice|soft/i, "fresh_juice"],
  [/water/i, "water"],
  [/dessert/i, "ice_cream"],
  [/breakfast/i, "continental"],
  [/burger/i, "beef_burger"],
  [/pizza/i, "pizza"],
  [/side/i, "chips"],
  [/bar bite|snack|starter/i, "wings"],
  [/grill|main|lunch|dinner|room|in-room/i, "grilled_chicken"],
  [/drink/i, "soda"],
];

/** The photograph for an item (a path under /public), or null when neither its name nor its section says what it is. */
export function dishPhoto(name: string, section = ""): string | null {
  const slot = BY_NAME.find(([re]) => re.test(name))?.[1] ?? BY_SECTION.find(([re]) => re.test(section))?.[1];
  return slot ? `/menu/${slot}.jpg` : null;
}

/** Kept for callers that only need to know whether an item has a picture. */
export function dishSymbol(name: string, section = ""): string | null {
  return dishPhoto(name, section);
}

const SIZE = {
  /** The till's product card: the full width of the card. */
  tile: "aspect-[4/3] w-full rounded-[14px]",
  /** A square beside a line on the bill, in a list or a table. */
  thumb: "size-11 rounded-xl",
  /** A small square in a dense table row. */
  row: "size-9 rounded-[10px]",
} as const;

export function DishArt({
  name,
  section = "",
  size = "tile",
}: {
  name: string;
  section?: string;
  size?: keyof typeof SIZE;
}) {
  const src = dishPhoto(name, section);
  const initials = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      data-ui="dish-photo"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[var(--pos-band)] ${SIZE[size]}`}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: small bundled JPEGs; the till must work without the image optimiser
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`size-full object-cover ${size === "tile" ? "transition duration-300 group-enabled:group-hover:scale-[1.04]" : ""}`}
        />
      ) : (
        <span
          className={`font-semibold tracking-tight text-[var(--pos-ink-3)] ${size === "tile" ? "text-[26px]" : "text-[13px]"}`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
