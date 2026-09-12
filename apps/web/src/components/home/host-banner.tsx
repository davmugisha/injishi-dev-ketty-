import Link from "next/link";

/**
 * The closing host banner — band 08 of ADR-022.
 *
 * The page ends by talking to the other audience: property owners. It ships
 * STATIC on purpose, with product-true copy only — escrow payouts and self
 * check-in are what the platform actually promises — and no offer number,
 * because no promotion exists to quote and inventing one would expire into a
 * lie. When the Promotions module lands, this becomes its third slot.
 *
 * The left-to-right ink gradient is the hero's idiom turned sideways: the
 * copy needs a dependable dark ground on an unpredictable photograph, and
 * `--color-ink-950` is the same token both surfaces read.
 */
export function HostBanner() {
  return (
    <section className="section-y container">
      <div className="relative overflow-hidden rounded-card">
        <picture className="block h-full w-full">
          <source
            type="image/avif"
            sizes="(max-width: 1024px) 100vw, 1320px"
            srcSet="/assets/rwanda-tea-01.avif"
          />
          <img
            src="/assets/rwanda-tea-01.jpg"
            sizes="(max-width: 1024px) 100vw, 1320px"
            width={1320}
            height={280}
            alt="Tea fields in the Rwandan hills"
            loading="lazy"
            decoding="async"
            className="h-[320px] w-full object-cover object-center md:h-[280px]"
          />
        </picture>

        {/* `var(--ink)`, and inline rather than an arbitrary Tailwind value.
            Two traps, both silent, both hit on the way here:

            1. `color-mix()` carries commas inside its own parentheses, which
               Tailwind's arbitrary-value parser cannot read, so the class
               compiled to nothing.
            2. `--color-ink-950` does not exist at runtime. The token sheet
               declares the ramp under `@theme inline`, and `inline` means
               Tailwind substitutes those values into utilities at build time
               instead of emitting custom properties. `bg-ink-950` works;
               `var(--color-ink-950)` in a style attribute resolves to nothing,
               which makes the whole gradient invalid and paints no scrim.

            Both failures look identical on screen: a white headline on a pale
            sky at about 1.5:1. `--ink` is a fixed token and IS emitted. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--ink) 0%, color-mix(in srgb, var(--ink) 72%, transparent) 55%, color-mix(in srgb, var(--ink) 25%, transparent) 100%)",
          }}
        />

        <div className="absolute inset-0 flex max-w-read flex-col justify-center gap-3 p-8 md:p-14">
          <h2 className="text-2xl font-bold leading-[1.15] text-white md:text-display-sm">
            List your property on Injishi
          </h2>
          <p className="text-base text-white/80">
            Verified hosts get escrow-backed payouts, self check-in tools, and
            guests who booked without a single phone call.
          </p>
          <Link
            href="/host"
            className="mt-2 inline-flex w-max items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-medium text-accent-foreground transition-all duration-300 hover:bg-accent-hover"
          >
            Become a host
          </Link>
        </div>
      </div>
    </section>
  );
}
