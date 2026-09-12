import { IMAGE_VARIANTS } from "@/data/generated/image-variants";

/**
 * Responsive source sets for the art-directed `<picture>` elements.
 *
 * The photography was exported at different widths per subject: the hero
 * stills carry 480/960/full, while the district crops only carry 480/full.
 * Emitting a fixed `srcSet` for every stem meant asking for files that were
 * never exported, so this declares what each stem actually has.
 */

/**
 * Widths for stems that predate the encode pipeline.
 *
 * Anything encoded by `scripts/encode-images.mjs` reports its own widths in
 * the generated map, which wins over this one. New photography should never
 * need an entry here.
 */
const LEGACY_VARIANTS: Record<string, number[]> = {
  "rwanda-lake-kivu": [480, 960, 1920],
  "rwanda-kigali-hero": [480, 960, 1920],
  "rwanda-apartment-interior": [480, 960, 1920],
  "rwanda-district-kigali": [480, 900],
  "rwanda-district-musanze": [480, 900],
  "rwanda-district-rubavu": [480, 900],
};

/** Stems known to neither map ship a single file at full width. */
const DEFAULT_WIDTHS = [1920];

/**
 * What a stem actually has on disk.
 *
 * The generated map is the truth for anything the encoder has processed; the
 * legacy table covers the original exports. Emitting a width that was never
 * written is what put `/assets/rwanda-*.jpg` in the 404 list, so this is the
 * one place that decides.
 */
function widthsFor(stem: string): number[] {
  return IMAGE_VARIANTS[stem] ?? LEGACY_VARIANTS[stem] ?? DEFAULT_WIDTHS;
}

/**
 * Build a `srcSet` for one format.
 *
 * The widest entry is the unsuffixed file — that is how the exports were
 * named — so it is emitted without a suffix.
 */
export function buildSrcSet(stem: string, extension: "avif" | "webp" | "jpg"): string {
  const widths = widthsFor(stem);
  const widest = widths.at(-1);

  return widths
    .map((width) => {
      const file =
        width === widest ? `${stem}.${extension}` : `${stem}-${width}.${extension}`;
      return `/assets/${file} ${width}w`;
    })
    .join(", ");
}

/** The `src` fallback: the unsuffixed, full-width file. */
export function fullSizeSrc(stem: string, extension: "avif" | "webp" | "jpg"): string {
  return `/assets/${stem}.${extension}`;
}
