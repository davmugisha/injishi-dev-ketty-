import type { MetadataRoute } from "next";
import { fixed } from "@injishi/design-tokens";

// Colors come from design tokens (no hardcoded hex): `ink` is the brand navy
// used for the toolbar tint, `white` the splash canvas. Both are fixed roles,
// so they hold their value in either theme (ADR-010 call 2).
const THEME = fixed.ink;
const BACKGROUND = fixed.white;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Injishi",
    short_name: "Injishi",
    description:
      "Run hospitality bookings and residential leases, take money-backed commitments, and stay RRA-compliant.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    dir: "ltr",
    theme_color: THEME,
    background_color: BACKGROUND,
    categories: ["business", "travel", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore", url: "/explore" },
      { name: "Guides", url: "/guides" },
      { name: "Support", url: "/support" },
    ],
  };
}
