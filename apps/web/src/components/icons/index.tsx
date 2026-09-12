import type { SVGProps } from "react";
import {
  ArrowRight,
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

export function ArrowRightIcon(props: IconProps) {
  return <ArrowRight width={24} height={24} strokeWidth={1.7} aria-hidden {...props} />;
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

/**
 * The Injishi mark, drawn as a gradient outline in the footer. Ours, so no
 * icon set carries it.
 */
export function InjishiMark(props: IconProps) {
  return (
    <svg width="96" height="86" viewBox="0 0 431 384" fill="none" aria-hidden {...props}>
      <path
        d="M400.02,162.42c-.68,1.32-1.89,2.18-3.41,2.43-1.8.3-3.67-.38-5.03-1.8-13.98-14.6-30.86-26.55-49.28-34.95-2.14-.98-4.39,1.2-3.49,3.38,5.77,14,13.14,27.59,20.31,40.81,14.13,26.04,28.74,52.96,31,82.92.25,3.39-.68,8.04-3.34,10.25-1.44,1.2-3.18,1.58-5.04,1.08-2.55-.67-4.54-2.9-5.07-5.69-3.65-19.31-9.16-38.37-16.39-56.66-5.27-13.37-12.31-28.39-24.53-38.5-15.33-12.69-36.34-15.77-57.23-17.1-1.77-.11-3.15,1.52-2.71,3.23,7.61,29.75,7.49,62.91-.38,96.38-7.27,30.87-20.72,61.72-41.12,94.29-1.73,2.76-4.1,6.54-8.59,7.54-.53.12-1.07.17-1.6.17-2.08,0-4.04-.88-5.28-2.44-2.93-3.72-.4-8.08.81-10.18,20.57-35.44,32.89-63.8,39.94-91.94,8.5-33.88,8.42-66.66-.21-95.07-.36-1.17-1.52-1.91-2.73-1.75-63.75,8.55-124.86,40.5-168.15,88.04-1.23,1.34-2.44,2.7-3.65,4.06-4.45,4.98-9.05,10.13-14.25,14.61-.26.22-.58.52-.94.86-2.75,2.54-7.34,6.8-11.03,4.62-1.24-.73-2.03-1.87-2.3-3.28-.75-3.95,2.94-8.82,3.36-9.36,46.06-59.04,114.28-100.1,187.94-113.35,1.79-.32,2.74-2.32,1.81-3.89-10.16-17.16-28.02-30.7-49.92-37.67-19.93-6.32-42.97-7.54-70.43-3.71-30.91,4.31-60.65,13.73-88.39,28-1.72.89-5.76,2.97-8.78-.41-1.21-1.36-1.77-3.19-1.53-5.01.26-1.93,1.36-3.65,3.02-4.73,33.42-21.71,77.35-32.87,127.03-32.32,38.05.44,75.87,7.25,112.69,14.61,2.55.51,4.21-2.62,2.34-4.43-18.85-18.27-42.26-32.23-67.2-39.94-2.01-.62-3.6-2.06-4.25-3.87-.86-2.41.05-4.74,2.44-6.22,1.68-1.04,4.07-1.64,6.36-1.64.66,0,1.3.05,1.92.15,22.93,3.71,42.11,18.21,56.26,30.42,4.26,3.68,8.5,7.52,12.59,11.24,8.48,7.69,17.16,15.58,26.53,22.4,1.97,1.43,4.65-.35,4.09-2.72l-6.85-28.82c-.32-1.35-1.17-4.95,2.18-6.7,1.29-.68,2.89-.78,4.39-.27,8.24,2.81,15.78,7.66,21.82,14.01,1.24,1.31,1.66,3.19,1.1,4.92-.56,1.7-1.98,2.96-3.72,3.28-1.39.25-2.81.3-4.19.14-1.59-.18-3.01,1.01-2.98,2.61.17,10.21,6.66,19.67,13.46,25.64,7.03,6.18,15.65,10.62,23.99,14.9,2.6,1.33,5.28,2.71,7.88,4.12,9.96,5.41,22.18,13.23,28.27,25.8.97,2,1.68,5.17.46,7.51Z"
        fill="none"
        stroke="url(#injishi-mark-stroke)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="injishi-mark-stroke"
          x1="-100.7"
          y1="436.2"
          x2="427.3"
          y2="-43"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-white)" stopOpacity=".06" />
          <stop offset="1" stopColor="var(--color-white)" stopOpacity=".5" />
        </linearGradient>
      </defs>
    </svg>
  );
}
