"use client";

import { FlutedGlass } from "@paper-design/shaders-react";

/**
 * The fluted-glass texture behind the footer's accent panel.
 *
 * Its own file, and its own client boundary, so `site-footer.tsx` stays a
 * Server Component. `@paper-design/shaders-react` marks `"use client"` on its
 * barrel, so importing it directly from the footer would work, but it would
 * also pull a WebGL canvas into the same module as the link markup. This keeps
 * the island the size of the thing that actually needs the browser.
 *
 * Three deliberate choices, all cost control:
 *
 *  - `speed={0}` — the shader paints once and stops. There is no animation
 *    frame loop, so the footer costs nothing after first paint and there is
 *    no reduced-motion case to answer.
 *  - `maxPixelCount` — caps the backing buffer. Without it a 4K display pays
 *    for a full-resolution canvas to draw a texture nobody reads.
 *  - `aria-hidden` on the wrapper in `site-footer.tsx` — this is texture, not
 *    content.
 *
 * HIGHLIGHT and SHADOW are the two literals in this file, and they are here
 * because the shader parses colour strings itself: `var(--white)` is not a
 * value it can read, so a token reference cannot be passed through. They mirror
 * the FIXED project tokens `--white` and `--black`, which ADR-010 pinned to one
 * value in both themes, so the pair cannot drift from the palette. They are
 * specular light and shade, not brand colour. ADR-023 records the exception.
 */
const HIGHLIGHT = "#FFFFFF"; // mirrors the fixed --white token
const SHADOW = "#000000"; // the shadow side of the flute, not --ink as a fill
const TRANSPARENT = "#00000000";

export function FooterGlass() {
  return (
    <FlutedGlass
      speed={0}
      maxPixelCount={1920 * 1080}
      size={0.89}
      shape="lines"
      angle={0}
      distortionShape="prism"
      distortion={0.5}
      shift={0}
      blur={0}
      edges={0.25}
      stretch={0}
      scale={1.11}
      fit="cover"
      highlights={0.1}
      shadows={0.2}
      grainMixer={0.1}
      grainOverlay={0.1}
      colorBack={TRANSPARENT}
      colorHighlight={HIGHLIGHT}
      colorShadow={SHADOW}
      className="size-full bg-transparent"
    />
  );
}
