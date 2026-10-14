/**
 * Photography for the operator's visual catalogs (Rooms & rates, Menu).
 *
 * The demo dataset carries no image field — a Room type is a name, a size and
 * an occupancy, and a menu item is `[name, price, available]`. Rather than
 * inventing an image column the API does not have, this module resolves a photo
 * for a given key from the property photography the app already ships, and
 * gives everything else a designed placeholder instead of a grey rectangle.
 *
 * ASSET NOTE: the shipped photographs are property/room exteriors and interiors.
 * There is no food or spa photography in the tree, so menu items resolve to the
 * lettered placeholder below by design. Drop real item photos in
 * `public/shared/img/menu/` and extend `MENU_PHOTOS` to light them up — the
 * gallery already renders whatever it is given.
 */
import { green, ink } from "@injishi/design-tokens";


export interface Photo {
  src: string;
  /** AVIF twin where one exists; the <picture> prefers it. */
  avif?: string;
}

/** Menu item photography — empty until real item photos are supplied. */
const MENU_PHOTOS: Record<string, Photo> = {};

/**
 * A stable index for a key. Same key, same colour, every render and every
 * reload.
 */
function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The photo for a menu item, or null when none has been supplied yet. */
export function menuItemPhoto(name: string): Photo | null {
  return MENU_PHOTOS[name] ?? null;
}

/**
 * Two letters for the placeholder tile, taken from the *first* word rather than
 * one letter from each of the first two.
 *
 * Initialising across words collides constantly on a real menu — "Continental
 * breakfast" and "Chicken brochette" both reduce to CB, and a catalog with two
 * identical plates looks like a duplicate row. The first word is what
 * distinguishes menu items in practice, so CO and CH, and the whole F&B
 * department comes out distinct: CO, CL, CH, FR, FA, ES, HO.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[·-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w));
  if (words.length === 0) return "—";
  const first = words[0].replace(/[^a-zA-Z0-9]/g, "");
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  // A one-letter first word ("A la carte") carries no signal on its own.
  return (first + (words[1]?.[0] ?? "")).toUpperCase() || "—";
}

/**
 * A placeholder ground derived from the name, drawn only from the two brand
 * ramps and only from steps dark enough to carry white lettering at 4.5:1 — so
 * the tiles read as one deliberate set rather than as seven different
 * accidents, and the lettering is legible on every one of them.
 *
 * READ FROM THE PACKAGE, not written as `var(--ink-950, #042330)`. The ramps
 * survive ADR-027's palette deletion and this is one of the few places that
 * legitimately wants a ramp STEP rather than a role — there is no role for
 * "the seventh distinct tile colour". Importing them means the values move
 * when the ramp moves, and the hex fallbacks that used to sit beside each
 * variable — the half a palette regeneration could not reach — are gone.
 */
const PLACEHOLDER_INKS = [
  ink[950],
  ink[900],
  ink[800],
  ink[700],
  ink[600],
  green[950],
  green[900],
];

export function placeholderInk(name: string): string {
  return PLACEHOLDER_INKS[hash(name) % PLACEHOLDER_INKS.length];
}
