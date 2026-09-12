/**
 * Generate apps/web/src/data/properties.ts from the captured reference data.
 *
 * Everything the site shows about a property comes from dox_context/reference/,
 * where each record carries the URLs it was read from. Nothing here invents a
 * fact: fields the sources did not publish are emitted as null and the UI is
 * expected to omit them rather than fill them in.
 *
 * Two things the real data forced, which the old fixtures got wrong:
 *
 *  - Price basis is explicit. A Kigali hotel quotes per room, room-only; a
 *    gorilla-trekking lodge quotes per person and includes all meals, drinks
 *    and activities. Rendering both as "from X per night" is a lie by omission,
 *    so `price.basis` and `price.includes` travel with every rate.
 *
 *  - There are no guest reviews and no hosts. Inventing either for a real,
 *    named business would be fabricating a review of someone's actual company.
 *    Only real aggregate scores appear, and only with their source attached.
 *
 *   node scripts/generate-properties.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REF = path.join(ROOT, "dox_context/reference");
const OUT = path.join(ROOT, "apps/web/src/data/properties.ts");

const kigali = JSON.parse(readFileSync(path.join(REF, "kigali-hotels-apartments.json"), "utf8"));
const lodges = JSON.parse(readFileSync(path.join(REF, "safaribookings-rwanda.json"), "utf8"));

const USD_TO_RWF = kigali.fx.usd_to_rwf;
const FX_DATE = kigali.fx.rate_date;

const slugify = (s) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const rwf = (usd) => (usd == null ? null : Math.round((usd * USD_TO_RWF) / 500) * 500);

/**
 * Star class as a number, or null.
 *
 * The lodge sources put free text in this field — "Serena Resorts collection;
 * no numeric star shown on the official page" — because Rwandan lodges mostly
 * do not publish stars. Anything without a leading digit has no star rating.
 */
const parseStar = (value) => {
  if (typeof value === "number") return value;
  const match = /^\s*([1-5])\b/.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
};

/**
 * Photography pools, discovered from what has actually been sourced.
 *
 * Hardcoding stems here meant the generator happily emitted galleries of
 * `[a, b, c, a, b]` — duplicate React keys, and a gallery captioned "5 photos"
 * that held three. Pools are read off disk instead, and frames are handed out
 * distinct, so a gallery can never repeat a frame and `photoCount` is always
 * the truth.
 */
const SOURCED = path.join(ROOT, "apps/web/public/assets/sourced");
const available = existsSync(SOURCED)
  ? readdirSync(SOURCED)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .map((f) => f.replace(/\.[^.]+$/, ""))
      .sort()
  : [];

const byPrefix = (...prefixes) =>
  prefixes.flatMap((prefix) => available.filter((stem) => stem.startsWith(prefix)));


/**
 * Frames of the actual building, for the properties we have one of.
 *
 * Almost no Rwandan hotel has a free-licensed photograph of itself, so most
 * galleries can only show the place a stay sits in. Where a real photograph of
 * the property does exist it leads, because a picture of the building is worth
 * more than a picture of the city it stands in.
 */
const PROPERTY_FRAMES = {
  "radisson-blu-hotel-and-convention-centre-kigali": ["kigali-convention-centre-02"],
  "hotel-des-mille-collines": ["mille-collines-02", "mille-collines-01"],
};

/**
 * Frames reserved to a single property.
 *
 * These are excluded from the shared pools below. A photograph of the Radisson
 * Blu's own building was being handed out to the Serena and the Dmall as well,
 * which puts one hotel's building on another hotel's listing — the same class
 * of misrepresentation as an invented review.
 */
const RESERVED = new Set(Object.values(PROPERTY_FRAMES).flat());
const unreserved = (stems) => stems.filter((stem) => !RESERVED.has(stem));

const KIGALI_FRAMES = unreserved(byPrefix("kigali-"));
const AREA_FRAMES = {
  "Volcanoes National Park": unreserved(byPrefix("volcanoes-np", "virunga-range", "mountain-gorilla", "musanze")),
  "Akagera National Park": unreserved(byPrefix("akagera-np")),
  "Nyungwe Forest National Park": unreserved(byPrefix("nyungwe-forest", "rwanda-tea")),
  "Lake Kivu": unreserved(byPrefix("lake-kivu", "gisenyi", "karongi")),
};

/**
 * Frames that may appear in a gallery but must never lead.
 *
 * `kigali-hills-view-01` is a real Kigali hillside — corrugated roofing, a dirt
 * lot, parked minibuses. Honest, and fine as context deeper in a gallery, but
 * as the opening image of a five-star hotel it reads as a bait-and-switch. The
 * frame stays in the pool because the pool is thin; it just cannot go first.
 */
const NEVER_LEAD = new Set(["kigali-hills-view-01", "kigali-city-street-01"]);

/** Frames that stand in when a pool is short, so nothing renders empty. */
const FALLBACK = ["rwanda-lake-kivu", "rwanda-district-musanze", "rwanda-district-rubavu", "rwanda-district-kigali"];

/**
 * `count` distinct frames from a pool, starting at `offset`.
 *
 * The offset is the property's index, so neighbouring cards in the grid do not
 * open on the same photograph — 19 cards were drawing on 7 files with four of
 * them appearing twice, side by side.
 */
function framesFor(pool, offset, count, slug) {
  const own = PROPERTY_FRAMES[slug] ?? [];
  const source = [...(pool.length > 0 ? pool : FALLBACK), ...FALLBACK];
  const out = [...own];
  // Walk the pool from the offset until `count` distinct frames are collected.
  // Taking a fixed slice and then de-duplicating left the Radisson with four
  // frames in a five-slot grid, and an empty cell on the page.
  for (let i = 0; out.length < count && i < source.length; i++) {
    const stem = source[(offset + i) % source.length];
    if (!out.includes(stem)) out.push(stem);
  }
  // Move a never-lead frame out of the opening slot if anything else can take
  // it. If the whole set is never-lead, the order stands rather than emptying.
  if (own.length === 0 && NEVER_LEAD.has(out[0])) {
    const alt = out.findIndex((stem) => !NEVER_LEAD.has(stem));
    if (alt > 0) [out[0], out[alt]] = [out[alt], out[0]];
  }
  return out;
}

const DISTRICT_BY_AREA = {
  "Volcanoes National Park": "musanze",
  "Akagera National Park": "nyagatare",
  "Nyungwe Forest National Park": "rusizi",
};

const TYPE_LABEL = {
  hotel: "Hotel", boutique_hotel: "Boutique hotel", serviced_apartment: "Serviced apartment",
  aparthotel: "Aparthotel", guesthouse: "Guesthouse", lodge: "Lodge",
  tented_camp: "Tented camp", villa: "Villa",
};

const BASIS_LABEL = {
  per_room_per_night: "per room, per night",
  per_apartment_per_night: "per apartment, per night",
  per_person_per_night: "per person, per night",
};

/** Split a name into the bold lead and the lighter remainder the card renders. */
function splitName(name) {
  const words = name.replace(/,.*$/, "").split(" ");
  if (words.length === 1) return { lead: words[0], rest: "" };
  const tailWords = ["Hotel", "Lodge", "Apartments", "Suites", "House", "Camp", "Reserve", "Collines"];
  const idx = words.findIndex((w, i) => i > 0 && tailWords.includes(w));
  const cut = idx > 0 ? idx : Math.ceil(words.length / 2);
  return { lead: words.slice(0, cut).join(" "), rest: words.slice(cut).join(" ") };
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const q = (v) => (v == null ? "null" : `"${esc(v)}"`);
const arr = (a, indent) =>
  !a || a.length === 0 ? "[]" :
  `[\n${a.map((x) => `${indent}  ${q(x)},`).join("\n")}\n${indent}]`;

/** Amenities carry an icon stem; the repo ships a small set, so map to what exists. */
const ICON_FOR = [
  [/wi-?fi|internet/i, "wifi-high"], [/pool|swim/i, "kayak"], [/spa|massage|wellness|sauna/i, "shower"],
  [/restaurant|dining|menu|meals|breakfast|board/i, "fork-knife"], [/bar|drinks|wine|cellar/i, "cooking-pot"],
  [/gym|fitness|health club/i, "e-foil"], [/shuttle|transfer|airport/i, "tender"],
  [/fire|hearth/i, "fan"], [/terrace|balcony|veranda|deck|garden|beach|boat|kayak|game drive/i, "wave-sine"],
  [/tv|television|entertainment/i, "television"], [/parking/i, "tender"],
];
const iconFor = (label) => (ICON_FOR.find(([re]) => re.test(label)) ?? [null, "jet-ski"])[1];

function amenityBlock(list, indent) {
  if (!list || list.length === 0) return "[]";
  return `[\n${list.map((a) =>
    `${indent}  { icon: ${q(iconFor(a))}, label: ${q(a)} },`).join("\n")}\n${indent}]`;
}

function galleryBlock(frames, name, indent) {
  return `[\n${frames.map((stem, i) =>
    `${indent}  { stem: ${q(stem)}, alt: ${q(`${name} — view ${i + 1}`)} },`).join("\n")}\n${indent}]`;
}

function highlightsFor(p, kind, basis) {
  const out = [];
  if (p.includes && /all meals|fully inclusive|all-inclusive|full board/i.test(p.includes + " " + basis)) {
    out.push({ icon: "kitchen", title: "Rates include your meals", body: p.includes });
  }
  if (p.star) out.push({ icon: "sparkle", title: `${p.star}-star accommodation`, body: `Classified ${p.star}-star.` });
  if (p.rooms) out.push({ icon: "calendar", title: `${p.rooms} ${p.rooms === 1 ? "room" : "rooms"}`, body: p.roomsNote ?? `The accommodation has ${p.rooms} rooms in total.` });
  if (p.locationNote) out.push({ icon: "location", title: "Where it sits", body: p.locationNote });
  return out.slice(0, 3);
}

function record(r, indent = "  ") {
  const i2 = indent + "  ";
  const hl = r.highlights.map((h) =>
    `${i2}  { icon: ${q(h.icon)}, title: ${q(h.title)}, body: ${q(h.body)} },`).join("\n");
  const specs = r.specs.map((s) =>
    `${i2}  { label: ${q(s.label)}, value: ${q(s.value)} },`).join("\n");
  const ttk = r.thingsToKnow.map((c) =>
    `${i2}  {\n${i2}    title: ${q(c.title)},\n${i2}    icon: ${q(c.icon)},\n` +
    `${i2}    items: ${arr(c.items, i2 + "    ")},\n${i2}    learnMoreHref: ${q(c.learnMoreHref)},\n${i2}  },`).join("\n");

  return `${indent}{
${i2}slug: ${q(r.slug)},
${i2}name: ${q(r.name)},
${i2}location: ${q(r.location)},
${i2}district: ${q(r.district)},
${i2}kind: ${q(r.kind)},
${i2}propertyType: ${q(r.propertyType)},
${i2}starClass: ${r.starClass ?? "null"},
${i2}rooms: ${r.rooms ?? "null"},
${i2}bedrooms: ${r.bedrooms},
${i2}maxGuests: ${r.maxGuests},
${i2}capacity: ${arr(r.capacity, i2)},
${i2}heroImage: { stem: ${q(r.heroImage.stem)}, alt: ${q(r.heroImage.alt)} },
${i2}gallery: ${galleryBlock(r.galleryFrames, r.name, i2)},
${i2}photoCount: ${r.galleryFrames.length},
${i2}price: {
${i2}  fromUsd: ${r.price.fromUsd ?? "null"},
${i2}  fromRwf: ${r.price.fromRwf ?? "null"},
${i2}  basis: ${q(r.price.basis)},
${i2}  includes: ${q(r.price.includes)},
${i2}},
${i2}nightlyRateRwf: ${r.price.fromRwf ?? "null"},
${i2}rating: ${r.rating
    ? `{ score: ${r.rating.score}, outOf: ${r.rating.outOf}, source: ${q(r.rating.source)}, sourceUrl: ${q(r.rating.sourceUrl)} }`
    : "null"},
${i2}operator: ${r.operator ? `{ name: ${q(r.operator.name)}, website: ${q(r.operator.website)} }` : "null"},
${i2}cardName: { lead: ${q(r.cardName.lead)}, rest: ${q(r.cardName.rest)} },
${i2}summary: ${q(r.summary)},
${i2}cardImage: { stem: ${q(r.cardImage.stem)}, alt: ${q(r.cardImage.alt)} },${
    r.featuredRank ? `\n${i2}featuredRank: ${r.featuredRank},` : ""}
${i2}about: ${arr(r.about, i2)},
${i2}highlights: [
${hl}
${i2}],
${i2}specs: [
${specs}
${i2}],
${i2}amenities: ${amenityBlock(r.amenities, i2)},
${i2}place: {
${i2}  addressLines: [${q(r.place.addressLines[0])}, ${q(r.place.addressLines[1])}],
${i2}  latitude: ${r.place.latitude ?? "null"},
${i2}  longitude: ${r.place.longitude ?? "null"},
${i2}  blurb: ${q(r.place.blurb)},
${i2}},
${i2}thingsToKnow: [
${ttk}
${i2}],
${i2}sources: ${arr(r.sources, i2)},
${indent}},`;
}

/**
 * What we can actually say about staying here.
 *
 * An earlier version of this generator filled these columns with check-in
 * times, smoke-alarm assurances and a 48-hour cancellation window. None of it
 * came from a source — it was invented and then attached to named, operating
 * hotels, which is the same failure as inventing a review of one.
 *
 * The columns now carry only two kinds of statement: Injishi's own platform
 * terms, which are ours to make, and an explicit note that the property's
 * rules come from the property. `extra` holds whatever the sources did
 * publish for this particular stay.
 */
const THINGS_TO_KNOW = (extra = []) => [
  {
    title: "House rules", icon: "rules",
    items: [
      ...extra,
      "Check-in and checkout times are set by the accommodation",
      "Confirmed in writing when your booking is accepted",
    ],
    learnMoreHref: "/support",
  },
  {
    title: "Paying through Injishi", icon: "safety",
    items: [
      "Payment is held in escrow until check-in",
      "Released to the host only once you have arrived",
      "Rates shown exclude taxes unless the accommodation states otherwise",
    ],
    learnMoreHref: "/services",
  },
  {
    title: "Cancellation", icon: "cancellation",
    items: [
      "Cancellation terms are set by the accommodation, not by Injishi",
      "You will see them in full before you pay",
    ],
    learnMoreHref: "/legal/terms",
  },
];

const records = [];

// ---- Kigali hotels and apartments -----------------------------------------
kigali.properties.forEach((p, index) => {
  const slug = slugify(p.exact_name);
  const frames = framesFor(KIGALI_FRAMES, index, 5, slug);
  const fromRwf = rwf(p.price_from_usd);
  const rooms = p.rooms_total;
  const bedrooms = p.property_type === "serviced_apartment" ? 2 : 1;
  const basisLabel = BASIS_LABEL[p.price_basis] ?? p.price_basis;

  records.push({
    slug,
    name: p.exact_name,
    location: `${p.neighbourhood}, ${p.city}`,
    district: "kigali",
    kind: p.property_type,
    propertyType: `${TYPE_LABEL[p.property_type] ?? "Stay"} in ${p.neighbourhood}, ${p.city}`,
    starClass: p.star_class,
    rooms,
    bedrooms,
    maxGuests: bedrooms * 2,
    capacity: [
      rooms ? `${rooms} rooms` : `${TYPE_LABEL[p.property_type]}`,
      p.star_class ? `${p.star_class}-star` : p.neighbourhood,
      basisLabel,
    ],
    heroImage: { stem: frames[0], alt: `${p.exact_name} — ${p.neighbourhood}, Kigali` },
    galleryFrames: frames,
    cardImage: { stem: frames[0], alt: `${p.exact_name}, ${p.neighbourhood}` },
    cardName: splitName(p.exact_name),
    summary: [TYPE_LABEL[p.property_type], p.star_class ? `${p.star_class}-star` : null,
      p.price_includes].filter(Boolean).join(" • "),
    price: { fromUsd: p.price_from_usd, fromRwf, basis: basisLabel, includes: p.price_includes },
    rating: p.review_score_out_of_10
      ? { score: p.review_score_out_of_10, outOf: 10, source: "Trip.com", sourceUrl: kigali.sources.trip }
      : null,
    operator: p.official_website ? { name: p.exact_name, website: p.official_website } : null,
    about: [
      p.one_line_description,
      p.price_from_usd
        ? `Rates start at US$${p.price_from_usd} ${basisLabel} (${p.price_includes.toLowerCase()}), about ${fromRwf.toLocaleString("en-US")} RWF at the ${FX_DATE} rate.`
        : "This accommodation does not publish a rate; it is booked on request.",
    ],
    highlights: highlightsFor({
      includes: p.price_includes, star: p.star_class, rooms,
      locationNote: p.address ? `${p.address}, ${p.neighbourhood}.` : `In ${p.neighbourhood}, Kigali.`,
    }, p.property_type, p.price_basis),
    specs: [
      { label: "Type", value: TYPE_LABEL[p.property_type] ?? "Stay" },
      p.star_class ? { label: "Class", value: `${p.star_class}-star` } : null,
      rooms ? { label: "Rooms", value: String(rooms) } : null,
      { label: "Neighbourhood", value: p.neighbourhood },
      { label: "Rate basis", value: basisLabel },
      { label: "Included", value: p.price_includes },
      p.opened ? { label: "Opened", value: String(p.opened) } : null,
    ].filter(Boolean),
    amenities: p.top_amenities,
    place: {
      addressLines: [p.address ?? p.neighbourhood, `${p.city}, Rwanda`],
      latitude: p.latitude, longitude: p.longitude,
      blurb: `${p.neighbourhood} sits in ${p.city}. Exact directions are sent once a booking is confirmed.`,
    },
    thingsToKnow: THINGS_TO_KNOW(),
    sources: (p.source_urls ?? []).map((k) => kigali.sources[k] ?? k),
  });
});

// ---- Lodges ---------------------------------------------------------------
lodges.lodges.forEach((l, lodgeIndex) => {
  const area = l.park_or_area;
  const lodgeSlug = slugify(l.exact_name);
  const gallery = framesFor(AREA_FRAMES[area] ?? [], lodgeIndex, 5, lodgeSlug);
  const town = String(l.nearest_town ?? "").split(/[;(]/)[0].split("/")[0].trim();
  const district = DISTRICT_BY_AREA[area] ?? (/gisenyi|rubavu/i.test(l.nearest_town ?? "") ? "rubavu" : "karongi");
  const fromRwf = rwf(l.price_from_usd);
  const perPerson = /person|pp|fully inclusive|all-inclusive/i.test(
    `${l.price_basis ?? ""} ${l.price_unit ?? ""}`);
  const basisLabel = perPerson ? "per person, per night" : "per room, per night";
  const rooms = l.number_of_rooms;

  records.push({
    slug: lodgeSlug,
    name: l.exact_name,
    location: `${town}, ${area}`,
    district,
    kind: l.accommodation_type,
    propertyType: `${TYPE_LABEL[l.accommodation_type] ?? "Lodge"} in ${area}`,
    starClass: parseStar(l.star_or_class),
    rooms,
    bedrooms: 1,
    maxGuests: 2,
    capacity: [
      rooms ? `${rooms} ${l.accommodation_type === "tented_camp" ? "tents" : "rooms"}` : TYPE_LABEL[l.accommodation_type],
      l.category ? l.category.replace("_", " ") : area,
      basisLabel,
    ],
    heroImage: { stem: gallery[0], alt: `${l.exact_name} — ${area}` },
    galleryFrames: gallery,
    cardImage: { stem: gallery[0], alt: `${l.exact_name}, ${area}` },
    cardName: splitName(l.exact_name),
    summary: [TYPE_LABEL[l.accommodation_type], l.category?.replace("_", " "),
      perPerson ? "all-inclusive" : null].filter(Boolean).join(" • "),
    price: {
      fromUsd: l.price_from_usd, fromRwf, basis: basisLabel,
      includes: l.price_includes ? String(l.price_includes).split(".")[0] : "Rate on request",
    },
    rating: null, // No property-level score is published anywhere for these.
    operator: l.official_website ? { name: l.exact_name, website: l.official_website } : null,
    about: [
      l.one_line_description,
      l.price_from_usd
        ? `Rates start at US$${l.price_from_usd} ${basisLabel}${l.price_high_usd ? ` and run to US$${l.price_high_usd}` : ""}, about ${fromRwf.toLocaleString("en-US")} RWF at the ${FX_DATE} rate. Gorilla permits are charged separately.`
        : "This lodge does not publish rates; it is booked on request.",
    ],
    highlights: highlightsFor({
      includes: l.price_includes, star: parseStar(l.star_or_class), rooms,
      roomsNote: rooms ? `${rooms} ${l.accommodation_type === "tented_camp" ? "tents" : "rooms"} in total — these are small accommodations.` : null,
      locationNote: `${town}, in ${area}.`,
    }, l.accommodation_type, l.price_basis ?? ""),
    specs: [
      { label: "Type", value: TYPE_LABEL[l.accommodation_type] ?? "Lodge" },
      { label: "Area", value: area },
      rooms ? { label: "Rooms", value: String(rooms) } : null,
      l.category ? { label: "Category", value: l.category.replace("_", " ") } : null,
      { label: "Rate basis", value: basisLabel },
      { label: "Board", value: l.price_basis ?? "On request" },
    ].filter(Boolean),
    amenities: l.top_amenities,
    place: {
      addressLines: [town, `${area}, Rwanda`],
      latitude: l.latitude, longitude: l.longitude,
      blurb: `${l.exact_name} sits near ${town} in ${area}. Transfers are arranged with the lodge.`,
    },
    thingsToKnow: THINGS_TO_KNOW(
      /Volcanoes/.test(area) ? ["Gorilla permits are booked separately, at USD 1,500 per trek"] : [],
    ),
    sources: [l.source_url].filter(Boolean),
  });
});

// Featured deck: a spread across price and place rather than the top six by rate.
const FEATURED = ["kigali-serena-hotel", "wilderness-bisate", "radisson-blu-hotel-and-convention-centre-kigali",
  "lake-kivu-serena-hotel", "hotel-des-mille-collines", "one-and-only-nyungwe-house"];
records.forEach((r) => {
  const rank = FEATURED.indexOf(r.slug);
  if (rank !== -1) r.featuredRank = rank + 1;
});

const missing = FEATURED.filter((s) => !records.some((r) => r.slug === s));
if (missing.length) {
  console.error(`Featured slugs with no property record: ${missing.join(", ")}`);
  process.exit(1);
}

const header = `// Generated by scripts/generate-properties.mjs from dox_context/reference/.
// Do not edit by hand — edit the reference data and regenerate.
//
// Every property here is a real, operating business and every record carries
// the source URLs it was read from. Fields the sources did not publish are
// null; the UI omits them rather than inventing a value. There are deliberately
// no guest reviews and no host profiles: fabricating either for a named real
// company would be inventing testimony about someone's actual business.
//
// Rates converted at 1 USD = ${USD_TO_RWF} RWF (${FX_DATE}).
import type { District } from "@injishi/contracts";

export type PropertyKind =
  | "hotel" | "boutique_hotel" | "serviced_apartment" | "aparthotel"
  | "guesthouse" | "lodge" | "tented_camp" | "villa";

export interface SpecRow { label: string; value: string }
export interface Amenity { icon: string; label: string; available?: boolean; group?: string }
export interface GalleryImage { stem: string; alt: string }

export interface Highlight {
  icon: "location" | "checkin" | "workspace" | "kitchen" | "calendar" | "sparkle";
  title: string;
  body: string;
}

/** A real aggregate score, always carrying where it came from. */
export interface Rating { score: number; outOf: number; source: string; sourceUrl: string }

/**
 * What a rate actually means.
 *
 * A Kigali hotel quotes per room, room-only. A gorilla-trekking lodge quotes
 * per person and bundles meals, drinks and activities. Presenting both as
 * "from X per night" would compare two different products, so the basis and
 * what it includes travel with the number everywhere it is shown.
 */
export interface Price {
  fromUsd: number | null;
  fromRwf: number | null;
  basis: string;
  includes: string;
}

export interface Place {
  addressLines: [string, string];
  latitude: number | null;
  longitude: number | null;
  blurb: string;
}

export interface ThingsToKnowColumn {
  title: string;
  icon: "rules" | "safety" | "cancellation";
  items: string[];
  learnMoreHref: string;
}

export interface PropertyDetail {
  slug: string;
  name: string;
  location: string;
  district: District;
  kind: PropertyKind;
  propertyType: string;
  starClass: number | null;
  rooms: number | null;
  bedrooms: number;
  maxGuests: number;
  capacity: string[];
  heroImage: GalleryImage;
  gallery: GalleryImage[];
  photoCount: number;
  price: Price;
  /** Mirror of price.fromRwf, kept for card rendering and sorting. */
  nightlyRateRwf: number | null;
  rating: Rating | null;
  operator: { name: string; website: string | null } | null;
  /** How the name breaks across the card's bold/regular split. */
  cardName: { lead: string; rest: string };
  summary: string;
  cardImage: GalleryImage;
  /** Position on the home page deck. Absent means not featured. */
  featuredRank?: number;
  about: string[];
  highlights: Highlight[];
  specs: SpecRow[];
  amenities: Amenity[];
  place: Place;
  thingsToKnow: ThingsToKnowColumn[];
  /** The URLs this record was read from. */
  sources: string[];
}

export const PROPERTIES: PropertyDetail[] = [
`;

const body = records.map((r) => record(r)).join("\n");

const footer = `
];

export function findProperty(slug: string): PropertyDetail | undefined {
  return PROPERTIES.find((property) => property.slug === slug);
}
`;

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, header + body + footer);

console.log(`${records.length} properties written to apps/web/src/data/properties.ts`);
console.log(`  Kigali: ${kigali.properties.length}   Lodges: ${lodges.lodges.length}`);
console.log(`  Featured: ${FEATURED.join(", ")}`);
const noRate = records.filter((r) => r.price.fromRwf == null);
console.log(`  Without a published rate: ${noRate.length}${noRate.length ? ` (${noRate.map((r) => r.slug).join(", ")})` : ""}`);
