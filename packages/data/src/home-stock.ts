import type { StockImage } from "./media.ts";

/** Local covers for rental units when the landlord has not uploaded photos yet. */
/** Unsplash covers (saved under /stock/homes) when the landlord has not uploaded photos. */
const HOME_STOCK_COVERS: readonly Pick<StockImage, "src" | "alt">[] = [
  {
    src: "/stock/homes/one-bedroom-living.jpg",
    alt: "Bright living room with a sofa, coffee table and large windows",
  },
  {
    src: "/stock/homes/studio-loft-interior.jpg",
    alt: "Open loft apartment with seating and a tall window wall",
  },
  {
    src: "/stock/homes/apartment-duplex-front.jpg",
    alt: "Modern apartment living room with a sofa and floor lamp",
  },
  {
    src: "/stock/homes/apartment-courtyard-aerial.jpg",
    alt: "Tall residential tower and courtyard seen from above",
  },
  {
    src: "/stock/homes/garden-flats-exterior.jpg",
    alt: "Apartment buildings with balconies along a landscaped path",
  },
  {
    src: "/stock/homes/family-house-garden.jpg",
    alt: "Suburban house with a front lawn and driveway",
  },
];

/** A stable stock photo for a unit or tenancy, from its id. */
export function homeStockCover(seed: string): Pick<StockImage, "src" | "alt"> {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i);
  return HOME_STOCK_COVERS[Math.abs(h) % HOME_STOCK_COVERS.length];
}

/** The cover URL to show: the uploaded photo, or a local stock fallback. */
export function homeCoverPhoto(seed: string, photos: readonly string[]): { src: string; alt: string; stock: boolean } {
  const first = photos[0]?.trim();
  if (first) return { src: first, alt: "Photo of the home", stock: false };
  return { ...homeStockCover(seed), stock: true };
}
