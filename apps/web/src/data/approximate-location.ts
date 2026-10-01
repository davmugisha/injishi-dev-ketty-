import type { DistrictSlug } from "@/data/search-options";

/**
 * Approximate map points for stays that have not published coordinates.
 *
 * The in-app catalogue and the filler properties are sample listings with no
 * real address — they name a neighbourhood ("Kacyiru", "Kinigi") and a
 * district, nothing finer. Leaving them off the map made 54 of 61 results
 * vanish from the split view. Instead each is pinned to the centre of the
 * neighbourhood it names (public geography, not a business's address), or to
 * its district when the neighbourhood is not in the table, with a small
 * deterministic offset so stays in the same place do not stack.
 *
 * Every point made here is flagged `approximate`, and the map says so; a
 * property that publishes real coordinates always wins.
 */

type LatLng = readonly [lat: number, lng: number];

const NEIGHBOURHOOD: Readonly<Record<string, LatLng>> = {
  // Kigali
  kacyiru: [-1.9441, 30.088],
  kimihurura: [-1.953, 30.093],
  kiyovu: [-1.948, 30.064],
  nyarugenge: [-1.95, 30.0588],
  nyarutarama: [-1.933, 30.105],
  remera: [-1.958, 30.112],
  gacuriro: [-1.918, 30.093],
  kimironko: [-1.948, 30.126],
  nyamirambo: [-1.979, 30.044],
  // Musanze
  kinigi: [-1.429, 29.596],
  musanze: [-1.499, 29.634],
  nyange: [-1.47, 29.565],
  // Rubavu
  gisenyi: [-1.702, 29.258],
  rubavu: [-1.702, 29.258],
  kinunu: [-1.86, 29.335],
  // Karongi
  kibuye: [-2.06, 29.348],
  bwishyura: [-2.065, 29.352],
  // Rusizi
  gisakura: [-2.47, 29.12],
  kamembe: [-2.48, 28.907],
  // Nyagatare / eastern savannah
  nyagatare: [-1.293, 30.327],
  kayonza: [-1.879, 30.645],
  rwesero: [-1.33, 30.3],
  rwempasha: [-1.24, 30.26],
};

const DISTRICT: Readonly<Record<DistrictSlug, LatLng>> = {
  kigali: [-1.9536, 30.0605],
  musanze: [-1.499, 29.634],
  rubavu: [-1.681, 29.2624],
  karongi: [-2.0567, 29.3833],
  rusizi: [-2.484, 28.907],
  nyagatare: [-1.2925, 30.3273],
};

/** "Gisenyi shore" → "gisenyi"; "Kayonza gate" → "kayonza". */
function placeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(town|shore|gate|village)\b/g, "")
    .trim();
}

/** Deterministic offset in [-1, 1] from a seed string (FNV-1a). */
function unitFromSeed(seed: string, salt: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ salt, 16777619);
  return ((h >>> 0) % 20000) / 10000 - 1;
}

export type ApproximateLocation = { latitude: number; longitude: number };

/**
 * A point for `slug` in the named neighbourhood, else its district. Returns
 * null only when neither is known. Neighbourhood points stay within ~400 m of
 * the centre; district fallbacks spread a little wider.
 */
export function approximateLocation(
  slug: string,
  neighbourhood: string | undefined,
  district: DistrictSlug,
): ApproximateLocation | null {
  const named = neighbourhood ? NEIGHBOURHOOD[placeKey(neighbourhood)] : undefined;
  const centre = named ?? DISTRICT[district];
  if (!centre) return null;
  const spread = named ? 0.004 : 0.012;
  return {
    latitude: centre[0] + unitFromSeed(slug, 1) * spread,
    longitude: centre[1] + unitFromSeed(slug, 2) * spread,
  };
}
