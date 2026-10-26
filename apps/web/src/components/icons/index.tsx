import type { SVGProps } from "react";
import {
  Compass,
  Heart,
  LifeBuoy,
  Moon,
  Search,
  Sun,
} from "lucide-react";

/**
 * The marks the public layer names directly, rather than through the kebab map
 * in `components/app/Icon.tsx`.
 *
 * Each is a thin wrapper over lucide so the call sites keep their own name and
 * their own default size. Props spread last, so a caller's `className`,
 * `width` or `strokeWidth` still wins.
 *
 * Below them sit the marks lucide does not carry and cannot: the five social
 * logos and the Injishi mark itself. Those stay hand-drawn.
 */

type IconProps = SVGProps<SVGSVGElement>;

export function SearchIcon(props: IconProps) {
  return <Search width={20} height={20} aria-hidden {...props} />;
}

export function MoonIcon(props: IconProps) {
  return <Moon width={18} height={18} aria-hidden {...props} />;
}

export function SunIcon(props: IconProps) {
  return <Sun width={18} height={18} aria-hidden {...props} />;
}

export function CompassIcon(props: IconProps) {
  return <Compass width={20} height={20} strokeWidth={1.7} aria-hidden {...props} />;
}

export function HeartIcon(props: IconProps) {
  return <Heart width={20} height={20} aria-hidden {...props} />;
}

export function LifebuoyIcon(props: IconProps) {
  return <LifeBuoy width={20} height={20} strokeWidth={1.5} aria-hidden {...props} />;
}

/**
 * Social marks, keyed by the network names in `SOCIAL_LINKS`.
 *
 * Hand-drawn on purpose: lucide-react ships no brand logos, so there is nothing
 * to import. Checked by `.unlazy/icons-lucide/checks/brand-absence.mjs`.
 */
export const SocialIcons = {
  facebook: (props: IconProps) => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M10 0C4.477 0 0 4.477 0 10c0 4.69 3.229 8.625 7.584 9.706v-6.65H5.522V10h2.062V8.683c0-3.403 1.54-4.981 4.882-4.981.634 0 1.727.124 2.174.248v2.77a12.853 12.853 0 0 0-1.155-.037c-1.64 0-2.273.621-2.273 2.236V10h3.266l-.56 3.056h-2.706v6.87C16.164 19.33 20 15.114 20 10c0-5.523-4.477-10-10-10z"
        fill="currentColor"
      />
    </svg>
  ),
  instagram: (props: IconProps) => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M10 1.8c2.672 0 2.988.012 4.04.06.976.042 1.503.206 1.855.343.464.18.8.399 1.148.746.352.352.566.684.746 1.149.137.351.3.882.344 1.855.047 1.055.058 1.371.058 4.04 0 2.671-.011 2.987-.058 4.038-.043.977-.207 1.504-.344 1.856-.18.465-.398.8-.746 1.148a3.077 3.077 0 0 1-1.148.746c-.352.137-.883.301-1.856.344-1.055.047-1.371.059-4.039.059-2.672 0-2.988-.012-4.04-.059-.976-.043-1.503-.207-1.855-.344-.464-.18-.8-.398-1.148-.746a3.076 3.076 0 0 1-.746-1.148c-.137-.352-.3-.883-.344-1.856-.047-1.054-.058-1.37-.058-4.039 0-2.672.011-2.988.058-4.039.043-.976.207-1.504.344-1.855.18-.465.398-.801.746-1.149a3.076 3.076 0 0 1 1.148-.746c.352-.137.883-.3 1.856-.344 1.05-.046 1.367-.058 4.039-.058zM10 0C7.285 0 6.945.012 5.879.059 4.816.105 4.086.277 3.453.523A4.88 4.88 0 0 0 1.68 1.68 4.9 4.9 0 0 0 .523 3.45C.277 4.085.105 4.811.06 5.874.012 6.945 0 7.285 0 10s.012 3.055.059 4.121c.046 1.063.218 1.793.464 2.426.258.66.598 1.219 1.157 1.773a4.888 4.888 0 0 0 1.77 1.153c.636.246 1.362.418 2.425.465 1.066.046 1.406.058 4.121.058 2.715 0 3.055-.012 4.121-.058 1.063-.047 1.793-.22 2.426-.465a4.888 4.888 0 0 0 1.77-1.153 4.888 4.888 0 0 0 1.152-1.77c.246-.636.418-1.363.465-2.425.047-1.066.058-1.406.058-4.121 0-2.715-.011-3.055-.058-4.121-.047-1.063-.22-1.793-.465-2.426A4.683 4.683 0 0 0 18.32 1.68 4.889 4.889 0 0 0 16.55.527C15.915.281 15.188.11 14.126.062 13.055.012 12.715 0 10 0z"
        fill="currentColor"
      />
      <path
        d="M10 4.863A5.138 5.138 0 0 0 4.863 10a5.138 5.138 0 0 0 10.273 0c0-2.836-2.3-5.137-5.136-5.137zm0 8.469a3.333 3.333 0 1 1 .001-6.665A3.333 3.333 0 0 1 10 13.332zM16.54 4.66a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"
        fill="currentColor"
      />
    </svg>
  ),
  twitter: (props: IconProps) => (
    <svg viewBox="0 0 20 19" fill="none" aria-hidden {...props}>
      <path
        d="M15.75 0h3.068l-6.7 7.678L20 18.125h-6.171l-4.834-6.338-5.531 6.338H.395l7.166-8.213L0 0h6.329l4.369 5.791L15.75 0Zm-1.075 16.285h1.7L5.404 1.744H3.581l11.094 14.541Z"
        fill="currentColor"
      />
    </svg>
  ),
  linkedin: (props: IconProps) => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20 20h-4v-6.999C16 11.081 15.153 10.01 13.634 10.01 11.981 10.01 11 11.126 11 13.001V20H7V7h4v1.462S12.255 6.26 15.083 6.26C17.912 6.26 20 7.986 20 11.558V20ZM2.442 4.921A2.45 2.45 0 1 1 2.442 0a2.45 2.45 0 0 1 0 4.921ZM0 20h5V7H0v13Z"
        fill="currentColor"
      />
    </svg>
  ),
  youtube: (props: IconProps) => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M19.8 6s-.195-1.379-.796-1.984c-.762-.797-1.613-.801-2.004-.848-2.797-.203-6.996-.203-6.996-.203h-.008s-4.2 0-6.996.203c-.39.047-1.242.05-2.004.848C.395 4.62.203 6 .203 6S0 7.621 0 9.238v1.516c0 1.617.2 3.238.2 3.238s.195 1.38.792 1.985c.762.796 1.762.77 2.207.855 1.602.152 6.801.2 6.801.2s4.203-.009 7-.208c.39-.047 1.242-.05 2.004-.847.601-.606.797-1.985.797-1.985S20 12.375 20 10.754V9.238C20 7.621 19.8 6 19.8 6zM7.935 12.594V6.973l5.402 2.82-5.402 2.8z"
        fill="currentColor"
      />
    </svg>
  ),
} as const;

