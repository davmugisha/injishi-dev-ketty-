import { useId, type SVGProps } from "react";
import { SquareArrowOutUpRight } from "lucide-react";

/** The boxed diagonal arrow that ends every "see all" link. */
export function ArrowBoxIcon(props: SVGProps<SVGSVGElement>) {
  return <SquareArrowOutUpRight width={24} height={24} aria-hidden {...props} />;
}

/**
 * Google's "G", with Google's own four brand colours.
 *
 * THIS FILE IS THE AC-7 EXEMPTION, AND THE EXEMPTION IS THE LOCATION.
 * `#4285F4`, `#34A853`, `#FBBC05` and `#EA4335` are prescribed by Google and
 * can never be an Injishi role, so they stay literal. The whole reason both
 * brand marks were lifted out of the sign-in capture and put here is that the
 * hex greps ADR-017 runs skip this one file: a brand hex found anywhere else
 * is a real failure rather than an argument about intent. Do not paste these
 * values into a page, and do not put a non-brand colour in this file.
 */
export function GoogleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * Apple's mark. One path, and it takes `currentColor` rather than a brand fill,
 * which is what Apple's own guidance asks for on a monochrome sign-in button.
 * So it is not an AC-7 exemption at all — it inherits whatever role the button
 * around it sets.
 */
export function AppleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden {...props}>
      <path d="M13.62 12.36c-.24.55-.52 1.06-.85 1.53-.45.64-.82 1.08-1.1 1.32-.43.4-.9.6-1.39.61-.36 0-.79-.1-1.29-.31-.5-.21-.95-.31-1.37-.31-.44 0-.91.1-1.41.31-.5.21-.91.32-1.22.33-.48.02-.95-.19-1.42-.62-.31-.26-.7-.71-1.16-1.37-.5-.7-.92-1.51-1.24-2.43C.79 10.42.55 9.45.55 8.5c0-1.09.24-2.03.71-2.82.37-.64.86-1.14 1.48-1.51.61-.37 1.27-.56 1.99-.57.39 0 .89.12 1.52.36s1.03.36 1.21.36c.13 0 .58-.14 1.34-.42.72-.26 1.33-.37 1.83-.33 1.36.11 2.38.65 3.06 1.62-1.22.74-1.82 1.78-1.81 3.11.01 1.04.39 1.9 1.13 2.59.33.32.71.56 1.12.74-.09.26-.18.51-.29.74zM10.74.32c0 .81-.3 1.58-.89 2.28-.71.84-1.58 1.32-2.51 1.25-.01-.1-.02-.21-.02-.32 0-.78.34-1.62.94-2.31C8.56.87 8.98.61 9.45.4c.47-.21.93-.32 1.36-.34.01.09.02.18.02.27z" />
    </svg>
  );
}

/**
 * A network's own logo file, drawn inside an `<svg>` so it keeps the same
 * `SVGProps` shape as every other mark here: the checkout maps key MTN, Airtel
 * and `CardMark` to one component type, and a call site sizes all three with
 * `width`/`height` alone.
 *
 * The files are the operators' official artwork, copied byte for byte from
 * `injishi.context/doc/` into `public/assets/payments/`. They replace two
 * hand-drawn stand-ins (an "MTN" text disc and a red disc with a guessed
 * swoosh) that neither network would recognise as its mark. The corner is
 * clipped to the rounded square both brands publish their app icons in.
 */
function NetworkLogo({
  href,
  ...props
}: SVGProps<SVGSVGElement> & { href: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <clipPath id={clip}>
        <rect width="24" height="24" rx="5" />
      </clipPath>
      <image
        href={href}
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clip})`}
      />
    </svg>
  );
}

/** MTN MoMo's official logo. */
export function MtnMark(props: SVGProps<SVGSVGElement>) {
  return <NetworkLogo href="/assets/payments/mtn-momo.jpg" {...props} />;
}

/** Airtel's official logo. */
export function AirtelMark(props: SVGProps<SVGSVGElement>) {
  return <NetworkLogo href="/assets/payments/airtel-money.png" {...props} />;
}

/**
 * The generic card glyph for the "Credit or debit card" row.
 * `currentColor`, so it takes the row's own role like `AppleMark` does.
 */
export function CardMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
      {...props}
    >
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 9.5h20" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * The Injishi mark as a solid glyph, taking its colour from `currentColor`.
 * Ours, so no icon set carries it; this one stays hand-drawn.
 */
export function InjishiGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="48"
      height="43"
      viewBox="0 0 431 384"
      fill="none"
      role="img"
      aria-label="Injishi"
      {...props}
    >
      <path
        d="M400.02,162.42c-.68,1.32-1.89,2.18-3.41,2.43-1.8.3-3.67-.38-5.03-1.8-13.98-14.6-30.86-26.55-49.28-34.95-2.14-.98-4.39,1.2-3.49,3.38,5.77,14,13.14,27.59,20.31,40.81,14.13,26.04,28.74,52.96,31,82.92.25,3.39-.68,8.04-3.34,10.25-1.44,1.2-3.18,1.58-5.04,1.08-2.55-.67-4.54-2.9-5.07-5.69-3.65-19.31-9.16-38.37-16.39-56.66-5.27-13.37-12.31-28.39-24.53-38.5-15.33-12.69-36.34-15.77-57.23-17.1-1.77-.11-3.15,1.52-2.71,3.23,7.61,29.75,7.49,62.91-.38,96.38-7.27,30.87-20.72,61.72-41.12,94.29-1.73,2.76-4.1,6.54-8.59,7.54-.53.12-1.07.17-1.6.17-2.08,0-4.04-.88-5.28-2.44-2.93-3.72-.4-8.08.81-10.18,20.57-35.44,32.89-63.8,39.94-91.94,8.5-33.88,8.42-66.66-.21-95.07-.36-1.17-1.52-1.91-2.73-1.75-63.75,8.55-124.86,40.5-168.15,88.04-1.23,1.34-2.44,2.7-3.65,4.06-4.45,4.98-9.05,10.13-14.25,14.61-.26.22-.58.52-.94.86-2.75,2.54-7.34,6.8-11.03,4.62-1.24-.73-2.03-1.87-2.3-3.28-.75-3.95,2.94-8.82,3.36-9.36,46.06-59.04,114.28-100.1,187.94-113.35,1.79-.32,2.74-2.32,1.81-3.89-10.16-17.16-28.02-30.7-49.92-37.67-19.93-6.32-42.97-7.54-70.43-3.71-30.91,4.31-60.65,13.73-88.39,28-1.72.89-5.76,2.97-8.78-.41-1.21-1.36-1.77-3.19-1.53-5.01.26-1.93,1.36-3.65,3.02-4.73,33.42-21.71,77.35-32.87,127.03-32.32,38.05.44,75.87,7.25,112.69,14.61,2.55.51,4.21-2.62,2.34-4.43-18.85-18.27-42.26-32.23-67.2-39.94-2.01-.62-3.6-2.06-4.25-3.87-.86-2.41.05-4.74,2.44-6.22,1.68-1.04,4.07-1.64,6.36-1.64.66,0,1.3.05,1.92.15,22.93,3.71,42.11,18.21,56.26,30.42,4.26,3.68,8.5,7.52,12.59,11.24,8.48,7.69,17.16,15.58,26.53,22.4,1.97,1.43,4.65-.35,4.09-2.72l-6.85-28.82c-.32-1.35-1.17-4.95,2.18-6.7,1.29-.68,2.89-.78,4.39-.27,8.24,2.81,15.78,7.66,21.82,14.01,1.24,1.31,1.66,3.19,1.1,4.92-.56,1.7-1.98,2.96-3.72,3.28-1.39.25-2.81.3-4.19.14-1.59-.18-3.01,1.01-2.98,2.61.17,10.21,6.66,19.67,13.46,25.64,7.03,6.18,15.65,10.62,23.99,14.9,2.6,1.33,5.28,2.71,7.88,4.12,9.96,5.41,22.18,13.23,28.27,25.8.97,2,1.68,5.17.46,7.51Z"
        fill="currentColor"
      />
    </svg>
  );
}
