import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * The Explore map's basemap: OpenFreeMap's "Liberty" style (free, keyless,
 * commercial use allowed), recoloured into the marketplace's own palette —
 * the cool hue-208 ground of the page, sage-teal greens for Rwanda's hills
 * and forests, teal-blue water, and one warm sand tone for the arterials so
 * the eye can follow a route. Both themes come from the same layer recipe;
 * only the palette differs, so light and dark never drift apart.
 *
 * MapLibre paints with literal colours (WebGL), not CSS variables, which is
 * why this is the one file in the app allowed to spell them out
 * (`allowHexIn` in eslint.config.mjs). The values are sampled from the
 * marketplace tokens: page ground `oklch(97% .01 208)`, ink
 * `oklch(21% .01 208)`, accent `oklch(65% .11 208)`.
 *
 * Every layer id below is a Liberty / OpenMapTiles id; an id the upstream
 * style drops simply stops matching.
 */

const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type Palette = {
  land: string;
  residential: string;
  park: string;
  wood: string;
  grass: string;
  water: string;
  waterway: string;
  waterLabel: string;
  roadMajor: string;
  roadMajorCasing: string;
  roadMid: string;
  roadMidCasing: string;
  roadMinor: string;
  roadMinorCasing: string;
  building: string;
  boundary: string;
  label: string;
  labelStrong: string;
  poi: string;
  halo: string;
  reliefOpacity: number;
};

const LIGHT: Palette = {
  land: "#f2f7f7",
  residential: "#e8eff0",
  park: "#d3eadc",
  wood: "#c2e1cf",
  grass: "#d9eee2",
  water: "#b9e0ea",
  waterway: "#93cddd",
  waterLabel: "#2f7385",
  roadMajor: "#f7e6bd",
  roadMajorCasing: "#e5cd92",
  roadMid: "#ffffff",
  roadMidCasing: "#cfdcdf",
  roadMinor: "#ffffff",
  roadMinorCasing: "#dde6e8",
  building: "#e2e9eb",
  boundary: "#8fa8ae",
  label: "#3b4b4f",
  labelStrong: "#141f22",
  poi: "#3f6f7a",
  halo: "#f7fbfb",
  reliefOpacity: 0.35,
};

const DARK: Palette = {
  land: "#111a1d",
  residential: "#162125",
  park: "#14302a",
  wood: "#153429",
  grass: "#142c26",
  water: "#0d3440",
  waterway: "#165466",
  waterLabel: "#7fc3d3",
  roadMajor: "#5b5038",
  roadMajorCasing: "#3a3426",
  roadMid: "#2b3c42",
  roadMidCasing: "#1b282c",
  roadMinor: "#223136",
  roadMinorCasing: "#1c292d",
  building: "#1a2629",
  boundary: "#4e6a71",
  label: "#b4c7cb",
  labelStrong: "#eef6f7",
  poi: "#7fb2be",
  halo: "#0d1416",
  reliefOpacity: 0.12,
};

// Layers that add noise without helping a guest pick a stay.
const DROPPED = new Set([
  "road_one_way_arrow",
  "road_one_way_arrow_opposite",
  "building-3d",
  "park_outline",
]);

function roadColour(id: string, p: Palette): string | null {
  const casing = id.includes("casing");
  if (/motorway|trunk_primary/.test(id)) return casing ? p.roadMajorCasing : p.roadMajor;
  if (/secondary_tertiary|_link/.test(id)) return casing ? p.roadMidCasing : p.roadMid;
  if (/minor|street|service_track/.test(id)) return casing ? p.roadMinorCasing : p.roadMinor;
  return null; // rail, paths: leave as Liberty draws them
}

function restyle(layer: LayerSpecification, p: Palette): LayerSpecification | null {
  if (DROPPED.has(layer.id)) return null;
  const id = layer.id;
  const paint: Record<string, unknown> = { ...("paint" in layer ? layer.paint : {}) };
  const layout: Record<string, unknown> = { ...("layout" in layer ? layer.layout : {}) };

  if (layer.type === "background") paint["background-color"] = p.land;
  // Natural Earth shaded relief at country zooms: the hills are half of what
  // makes Rwanda look like Rwanda, so keep them, softly.
  else if (id === "natural_earth") paint["raster-opacity"] = p.reliefOpacity;
  else if (id === "park") Object.assign(paint, { "fill-color": p.park, "fill-opacity": 0.9 });
  else if (id === "landcover_wood") Object.assign(paint, { "fill-color": p.wood, "fill-opacity": 0.85 });
  else if (id === "landcover_grass") Object.assign(paint, { "fill-color": p.grass, "fill-opacity": 0.9 });
  else if (id === "landuse_residential") Object.assign(paint, { "fill-color": p.residential, "fill-opacity": 0.8 });
  else if (id.startsWith("landuse_") && layer.type === "fill") paint["fill-opacity"] = 0.35;
  else if (id === "water") paint["fill-color"] = p.water;
  else if (id.startsWith("waterway") && layer.type === "line") paint["line-color"] = p.waterway;
  else if (id === "building") Object.assign(paint, { "fill-color": p.building, "fill-opacity": 0.7 });
  else if (id === "boundary_2" || id === "boundary_3") paint["line-color"] = p.boundary;
  else if (layer.type === "line" && /^(road|bridge|tunnel)_/.test(id)) {
    const colour = roadColour(id, p);
    if (colour) paint["line-color"] = colour;
  } else if (layer.type === "symbol") {
    const halo = { "text-halo-color": p.halo, "text-halo-width": 1.6, "text-halo-blur": 0.4 };
    if (id === "label_city" || id === "label_city_capital") {
      Object.assign(paint, { "text-color": p.labelStrong, ...halo });
      Object.assign(layout, { "text-transform": "uppercase", "text-letter-spacing": 0.18 });
    } else if (id.startsWith("label_country")) {
      Object.assign(paint, { "text-color": p.labelStrong, ...halo });
      Object.assign(layout, { "text-letter-spacing": 0.08 });
    } else if (id.startsWith("water_name") || id === "waterway_line_label") {
      Object.assign(paint, { "text-color": p.waterLabel, ...halo });
    } else if (id.startsWith("poi_")) {
      Object.assign(paint, { "text-color": p.poi, ...halo });
    } else if (id.startsWith("label_") || id.startsWith("highway-name")) {
      Object.assign(paint, { "text-color": p.label, ...halo });
    } else if (id.startsWith("highway-shield") || id === "road_shield_us") {
      // Road numbers matter in town, not across the whole country.
      Object.assign(layer, { minzoom: Math.max(layer.minzoom ?? 0, 11) });
    }
  }

  return { ...layer, paint, layout } as LayerSpecification;
}

export type MapTheme = "light" | "dark";

/** Liberty, recoloured. Pure: the fetched style is not mutated. */
function brandedLiberty(style: StyleSpecification, theme: MapTheme): StyleSpecification {
  const palette = theme === "dark" ? DARK : LIGHT;
  return {
    ...style,
    layers: style.layers
      .map((layer) => restyle({ ...layer }, palette))
      .filter((l): l is LayerSpecification => l !== null),
  };
}

let liberty: Promise<StyleSpecification> | null = null;

/** Fetched once per page load; a failure clears the cache so a retry can win. */
function loadLiberty(): Promise<StyleSpecification> {
  liberty ??= fetch(LIBERTY_STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`basemap style: HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .catch((error: unknown) => {
      liberty = null;
      throw error;
    });
  return liberty;
}

export function loadMapStyle(theme: MapTheme): Promise<StyleSpecification> {
  return loadLiberty().then((style) => brandedLiberty(style, theme));
}
