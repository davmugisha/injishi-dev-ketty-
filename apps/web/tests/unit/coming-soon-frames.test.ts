import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * The Coming soon loop (mobile spec 0004, AC-7) is pure CSS, so its contract lives in the stylesheet:
 * seven typefaces in a fixed order, 0.6 seconds each, stepping rather than fading, and still under
 * reduced motion. A browser draws it; this reads the frames the browser will draw.
 */
const css = readFileSync(
  new URL("../../src/app/(marketplace)/(bare)/downloads/coming-soon/coming-soon.module.css", import.meta.url),
  "utf8",
);

/** One frame's face: the `--font-*` family, the weight and the style. */
function faceOf(block: string) {
  return {
    family: block.match(/font-family:\s*var\(--font-([a-z-]+)\)/)?.[1],
    weight: block.match(/font-weight:\s*(\d+)/)?.[1],
    style: block.match(/font-style:\s*(\w+)/)?.[1],
  };
}

const keyframes = css.slice(css.indexOf("@keyframes typefaces"));
const frames = [...keyframes.matchAll(/((?:[\d.]+%,?\s*)+)\{([^}]*)\}/g)].map(([, stops, block]) => ({
  at: Number.parseFloat(stops),
  ...faceOf(block),
}));

/** The words at rest: the `.word` rule itself, before any frame or media query. */
const word = css.match(/^\.word\s*\{([^}]*)\}/m)?.[1] ?? "";

describe("the Coming soon loop (AC-7)", () => {
  test("steps through the seven typefaces in the spec's order", () => {
    expect(frames.map(({ family, weight, style }) => [family, weight, style])).toEqual([
      ["instrument-sans", "600", "normal"],
      ["instrument-serif", "400", "normal"],
      ["figtree", "900", "normal"],
      ["space-mono", "700", "normal"],
      ["instrument-serif", "400", "italic"],
      ["bricolage-grotesque", "800", "normal"],
      ["figtree", "300", "normal"],
    ]);
  });

  test("gives each face the same share of the loop", () => {
    for (const [i, frame] of frames.entries()) expect(frame.at).toBeCloseTo((i * 100) / 7, 3);
  });

  test("lasts 4.2 seconds, 0.6 per face, stepping with no fade, forever", () => {
    const [, seconds] = word.match(/animation:\s*typefaces\s+([\d.]+)s\s+step-end\s+infinite/) ?? [];

    expect(Number(seconds) / frames.length).toBeCloseTo(0.6, 5);
  });

  test("at rest the words are the first frame's face, Instrument Sans 600", () => {
    expect(faceOf(word)).toEqual({ family: "instrument-sans", weight: "600", style: "normal" });
  });

  test("stops under reduced motion, leaving the words in that first face", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.word\s*\{\s*animation:\s*none;/);
  });
});
