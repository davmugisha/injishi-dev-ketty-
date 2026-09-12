import Link from "next/link";
import { cn } from "@injishi/utils";
import { ArrowBoxIcon } from "@/components/icons/marks";

/**
 * The heading block that opens most sections: a light/bold two-part title, an
 * optional lede, and an optional "see all" link with the boxed arrow.
 *
 * Every section in the captures rebuilt this markup by hand; the arrow's SVG
 * alone appeared nine times on the home page.
 *
 * There is exactly one section-opener step and this component is it. DESIGN.md
 * names it Headline — "Spectral, 400, 24px -> 32px ... Section openers. Every
 * peer section uses this exact step — sections read as peers only if their
 * headings match, and drift here is the fastest way to break the page." The
 * `text-xl font-medium md:text-2xl` treatment that had grown on Property,
 * Support and the guide detail page was drift rather than a second role: the
 * documented hierarchy has nothing between Headline and Title, and Title
 * (22 -> 30px) is reserved for card and promise headings set into photographic
 * scrims. So there is no size variant here, and adding one would need the
 * hierarchy in DESIGN.md to gain a step first.
 */
export function SectionHeading({
  lead,
  emphasis,
  lede,
  action,
  as: Heading = "h2",
  className,
  headingClassName,
}: {
  lead: string;
  emphasis?: string;
  lede?: string;
  action?: { label: string; href: string };
  /**
   * The element to render. `h2` everywhere except a page whose opening section
   * is also its title — Support — which needs its one `h1` at this same step.
   */
  as?: "h1" | "h2" | "h3";
  className?: string;
  headingClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Heading
            className={cn(
              // Peer sections read as peers only if their headings match.
              // About, Services and Property had all landed on this step
              // independently while the shared component sat a size above it,
              // which is why call sites kept overriding it back down.
              //
              // `leading-[1.2]` is not decoration. DESIGN.md sets the Headline
              // role at line-height 1.2, but `text-2xl` carries Tailwind's own
              // 1.333 ratio and the arbitrary `lg:text-display-sm` only overrides
              // the size, so the ratio survived into the large step: measured,
              // this heading opened a 42.67px line box where the reference and
              // our own doc both want 38.4px. The one section opener on the
              // home page that already looked right — ExploreByDistrict — was
              // the one hand-rolling this exact value locally. Setting it here
              // is what lets that call site stop.
              "text-2xl font-normal leading-[1.2] text-page-fg lg:text-display-sm",
              headingClassName,
            )}
          >
            {lead}
            {emphasis ? <span className="font-bold">{emphasis}</span> : null}
          </Heading>

          {action ? (
            <SeeAllLink href={action.href} className="flex md:hidden">
              {action.label}
            </SeeAllLink>
          ) : null}
        </div>

        {lede ? (
          <p className="text-sm text-page-fg-70 md:max-w-tile md:text-base">
            {lede}
          </p>
        ) : null}
      </div>

      {action ? (
        <SeeAllLink href={action.href} className="hidden md:flex">
          {action.label}
        </SeeAllLink>
      ) : null}
    </div>
  );
}

function SeeAllLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn("group items-center gap-1.5 text-sm md:text-lg", className)}
    >
      <span className="whitespace-nowrap text-page-fg underline underline-offset-[4px]">
        {children}
      </span>
      <ArrowBoxIcon className="transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
    </Link>
  );
}

