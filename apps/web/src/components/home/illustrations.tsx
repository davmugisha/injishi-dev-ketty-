import { cn } from "@injishi/utils";

/**
 * The home page's drawn pattern: flat SVG, no gradients, its colour a
 * theme role so it follows light and dark mode.
 *
 * The pattern is Imigongo, the geometric relief art of the east:
 * chevrons and nested diamonds. It is drawn here rather than shipped as an
 * image, so it stays crisp at any width and costs a few hundred bytes.
 */

/* ---------------------------------------------------------------- patterns */

/**
 * An Imigongo field: nested diamonds on a chevron band, tiled. Sits absolutely
 * behind content; the caller sets the colour (`text-*`) and strength
 * (`opacity-*`).
 */
export function ImigongoBackground({ id, className }: { id: string; className?: string }) {
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter">
            <path d="M24 2 L46 24 L24 46 L2 24 Z" />
            <path d="M24 10 L38 24 L24 38 L10 24 Z" />
          </g>
          <path d="M24 18 L30 24 L24 30 L18 24 Z" fill="currentColor" />
          <path d="M0 0 L6 0 L0 6 Z M48 0 L42 0 L48 6 Z M0 48 L6 48 L0 42 Z M48 48 L42 48 L48 42 Z" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
