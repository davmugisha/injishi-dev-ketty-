/**
 * Location privacy on every public read (mobile spec 0005, D-o, AC-24).
 *
 * A property whose owner asked for location privacy (`properties.location_privacy`, a private home
 * above all) is shown as an AREA, never a point: its latitude and longitude each become the centre of
 * the 0.01 degree cell they fall in (about 1.1 km on a side in Rwanda), so a map draws a circle of
 * 800 m around it, which covers the whole cell (its half diagonal is about 790 m) and therefore the
 * true spot.
 *
 * Deterministic on purpose: the same property always answers the same centre, so reading it many
 * times cannot be averaged back towards the true spot, as random noise could.
 *
 * Every public route that returns coordinates goes through this one function: explore, `/properties*`
 * and `/marketplace/*` (through `ListingRepository`). The true coordinates never leave the API on a
 * public route.
 */

/** The cell's side, in degrees. */
export const LOCATION_CELL_DEGREES = 0.01;

/** The circle a map draws around a blurred point, in metres: it covers the whole cell. */
export const LOCATION_CIRCLE_METRES = 800;

export interface PublicLocation {
  latitude: number | null;
  longitude: number | null;
  /** True when the coordinates are a cell's centre, not the property's own spot. */
  approximate: boolean;
}

/** The centre of the cell one coordinate falls in. */
function cellCentre(value: number): number {
  // `toFixed` first, so a value on a cell edge (1.95 * 100 is 194.99999999999997) lands in its own
  // cell, not the one below it.
  const cell = Math.floor(Number((value / LOCATION_CELL_DEGREES).toFixed(6)));
  return Number(((cell + 0.5) * LOCATION_CELL_DEGREES).toFixed(4));
}

/** The coordinates a public read may return for a property. */
export function blurLocation(
  latitude: number | null,
  longitude: number | null,
  flagged: boolean,
): PublicLocation {
  if (latitude === null || longitude === null) {
    return { latitude: null, longitude: null, approximate: false };
  }
  if (!flagged) return { latitude, longitude, approximate: false };
  return {
    latitude: cellCentre(latitude),
    longitude: cellCentre(longitude),
    approximate: true,
  };
}
