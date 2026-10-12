import { cn } from "@injishi/utils";

/**
 * The home page's drawn vocabulary: flat SVG, no gradients, every colour a
 * theme role so the drawings follow light and dark mode.
 *
 * The pattern backgrounds are Imigongo, the geometric relief art of the east:
 * chevrons and nested diamonds. They are drawn here rather than shipped as
 * images, so they stay crisp at any width and cost a few hundred bytes.
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

/* ------------------------------------------------------------------- spots */

/** The four "How a stay works" drawings share one tile. */
function SpotTile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={label} className="size-24">
      <circle cx="48" cy="48" r="46" className="fill-accent/15" />
      {children}
    </svg>
  );
}

export function SpotFind() {
  return (
    <SpotTile label="A magnifier over the hills">
      <path d="M8 70 C 24 52 36 52 50 64 S 76 58 90 66 V74 H8 Z" className="fill-accent/40" />
      <path d="M14 76 C 30 62 46 64 58 72 S 80 70 88 74 Q 80 88 48 90 Q 20 88 14 76 Z" className="fill-accent/70" />
      <circle cx="44" cy="40" r="17" className="fill-card stroke-foreground" strokeWidth="3" />
      <path d="M36 44 L44 37 L52 44 V50 H36 Z" className="fill-accent" />
      <rect x="42" y="45" width="4" height="5" className="fill-card" />
      <path d="M57 53 L68 64" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" />
    </SpotTile>
  );
}

export function SpotPay() {
  return (
    <SpotTile label="A phone paying by mobile money">
      <rect x="30" y="16" width="34" height="62" rx="7" className="fill-card stroke-foreground" strokeWidth="3" />
      <rect x="35" y="24" width="24" height="40" rx="3" className="fill-accent/20" />
      <circle cx="47" cy="42" r="9" className="fill-accent" />
      <path d="M42.5 42 L46 45.5 L52 39" fill="none" className="stroke-accent-foreground" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="70" width="14" height="3" rx="1.5" className="fill-foreground/30" />
      <ellipse cx="72" cy="70" rx="10" ry="4" className="fill-accent-text" />
      <ellipse cx="72" cy="65" rx="10" ry="4" className="fill-accent" />
      <ellipse cx="72" cy="60" rx="10" ry="4" className="fill-accent-text" />
      <ellipse cx="72" cy="55" rx="10" ry="4" className="fill-accent stroke-card" strokeWidth="1.5" />
    </SpotTile>
  );
}

export function SpotCheckIn() {
  return (
    <SpotTile label="A key at an open door">
      <path d="M24 80 V30 Q24 20 34 20 H58 Q68 20 68 30 V80 Z" className="fill-accent/35" />
      <path d="M30 80 V32 Q30 26 36 26 H56 Q62 26 62 32 V80 Z" className="fill-card stroke-foreground" strokeWidth="2.5" />
      <circle cx="56" cy="54" r="2.5" className="fill-foreground" />
      <circle cx="40" cy="58" r="9" fill="none" className="stroke-accent-text" strokeWidth="4" />
      <path d="M48 58 H76 M68 58 V65 M74 58 V63" fill="none" className="stroke-accent-text" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 82 H86" className="stroke-foreground/30" strokeWidth="2" strokeLinecap="round" />
    </SpotTile>
  );
}

export function SpotReceipt() {
  return (
    <SpotTile label="A stamped receipt">
      <path
        d="M28 14 H66 V80 L61 76 L56 80 L51 76 L46 80 L41 76 L36 80 L31 76 L28 80 Z"
        className="fill-card stroke-foreground"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="34" y="24" width="20" height="4" rx="2" className="fill-foreground" />
      <rect x="34" y="34" width="26" height="3" rx="1.5" className="fill-foreground/30" />
      <rect x="34" y="42" width="22" height="3" rx="1.5" className="fill-foreground/30" />
      <rect x="34" y="50" width="26" height="3" rx="1.5" className="fill-foreground/30" />
      <circle cx="66" cy="64" r="13" className="fill-accent stroke-card" strokeWidth="3" />
      <path d="M60 64 L64.5 68.5 L72 60" fill="none" className="stroke-accent-foreground" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </SpotTile>
  );
}

/* ------------------------------------------------------------------- lodge */

/** A banana plant, Rwanda's commonest garden tree, at (x, y) foot. */
function Banana({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0 V-34" className="stroke-accent-text" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 -34 C -10 -44 -24 -42 -30 -34 C -20 -36 -10 -34 0 -30 Z" className="fill-accent-text" />
      <path d="M0 -34 C 10 -46 24 -46 30 -38 C 20 -38 10 -36 0 -30 Z" className="fill-accent" />
      <path d="M0 -36 C -4 -50 0 -60 8 -64 C 6 -54 4 -44 0 -34 Z" className="fill-accent" />
      <path d="M0 -30 C -12 -30 -22 -22 -24 -14 C -16 -20 -8 -24 0 -26 Z" className="fill-accent" />
    </g>
  );
}

/** The host band's scene: a lodge on a hill, a road, the sun. */
export function LodgeScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 200" aria-hidden className={cn("h-auto w-full", className)}>
      <circle cx="282" cy="54" r="30" className="fill-accent/30" />
      <circle cx="282" cy="54" r="18" className="fill-accent/50" />
      <path d="M0 150 C 60 96 120 92 180 120 S 300 90 360 112 V200 H0 Z" className="fill-accent/30" />
      <path d="M0 170 C 80 132 160 128 230 150 S 330 150 360 140 V200 H0 Z" className="fill-accent/55" />
      <path
        d="M120 200 C 140 182 190 180 200 166 S 190 146 214 140"
        fill="none"
        className="stroke-card"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="1 9"
      />
      {/* The lodge. */}
      <g transform="translate(196 92)">
        <rect x="0" y="22" width="64" height="36" className="fill-card stroke-foreground" strokeWidth="2.5" />
        <path d="M-8 24 L32 0 L72 24 Z" className="fill-accent-text stroke-foreground" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="26" y="36" width="12" height="22" className="fill-accent" />
        <rect x="8" y="32" width="11" height="10" className="fill-accent/30 stroke-foreground" strokeWidth="1.5" />
        <rect x="45" y="32" width="11" height="10" className="fill-accent/30 stroke-foreground" strokeWidth="1.5" />
        <path d="M-4 58 H68" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <Banana x={176} y={152} />
      <Banana x={292} y={150} scale={0.8} />
      <Banana x={58} y={158} scale={0.9} />
    </svg>
  );
}
