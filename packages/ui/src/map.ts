/**
 * The arithmetic of a web map (Web Mercator, 256-pixel tiles), pure so it is tested on its own: where a
 * place falls in pixels at a zoom, which tiles cover a box, and the view that fits a set of places.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const TILE = 256;
const MAX_LAT = 85.05112878;

/** Rwanda's corners, for a map with nothing on it yet. */
export const RWANDA_BOUNDS: readonly LatLng[] = [
  { lat: -1.05, lng: 28.86 },
  { lat: -2.84, lng: 30.9 },
];

/** A place in world pixels at a zoom. */
export function project(p: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((p.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** World pixels back to a place. */
export function unproject(px: { x: number; y: number }, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom;
  const lng = (px.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * px.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** The tiles that cover a box centred on a place, with where each one sits in the box. */
export function tilesFor(
  center: LatLng,
  zoom: number,
  size: { width: number; height: number },
): { x: number; y: number; z: number; wrappedX: number; left: number; top: number }[] {
  const c = project(center, zoom);
  const left = c.x - size.width / 2;
  const top = c.y - size.height / 2;
  const count = 2 ** zoom;
  const out: { x: number; y: number; z: number; wrappedX: number; left: number; top: number }[] = [];
  for (let x = Math.floor(left / TILE); x <= Math.floor((left + size.width) / TILE); x += 1) {
    for (let y = Math.floor(top / TILE); y <= Math.floor((top + size.height) / TILE); y += 1) {
      if (y < 0 || y >= count) continue;
      out.push({ x, y, z: zoom, wrappedX: ((x % count) + count) % count, left: x * TILE - left, top: y * TILE - top });
    }
  }
  return out;
}

/** The centre and the largest whole zoom that shows every place in a box, with room around them. */
export function fitView(
  places: readonly LatLng[],
  size: { width: number; height: number },
  opts: { min: number; max: number; padding: number },
): { center: LatLng; zoom: number } {
  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const center = { lat: (south + north) / 2, lng: (west + east) / 2 };
  const room = {
    width: Math.max(1, size.width - opts.padding * 2),
    height: Math.max(1, size.height - opts.padding * 2),
  };
  for (let zoom = opts.max; zoom > opts.min; zoom -= 1) {
    const a = project({ lat: north, lng: west }, zoom);
    const b = project({ lat: south, lng: east }, zoom);
    if (b.x - a.x <= room.width && b.y - a.y <= room.height) return { center, zoom };
  }
  return { center, zoom: opts.min };
}
