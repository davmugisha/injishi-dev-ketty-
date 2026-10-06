import Link from "next/link";
import { CalendarClock, Percent, Receipt, type LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_CHARGES, type HostCharge } from "@/data/host";

/**
 * "What it costs to list": the three facts of the business model, plainly.
 *
 * This was the proof block, titled "What Injishi takes from hosts" over a 0%
 * panel. Read alone, that says a host pays nothing, on a site whose
 * registration bills a fee, and the FAQ beside it said "no listing fee" in so
 * many words. The section now names both charges and when each falls, the
 * registration fee at the end of registering and the monthly plan once live,
 * and keeps the 0% panel for the claim that is true: no commission on a
 * booking. No figure is quoted for either charge; `HOST_CHARGES` says why.
 *
 * The layout is the reference's two column split, as before: words on the
 * left, the panel on the right. The three charges are a list rather than a
 * paragraph because they are three separate answers to one question, and a
 * host comparing platforms scans for exactly these three. Each carries a line
 * icon in a hairline circle, DESIGN.md's icon treatment, at 1px on
 * `currentColor` like the benefit marks above it.
 *
 * The panel is a tonal band (`bg-ink`), not a filled card, so it separates
 * from the page the way the Flat-Surface Rule asks. Its stat sets at the
 * Display step, a peer of the hero headline and no larger.
 *
 * `id="host-charges"` is the anchor the chooser's fee line links to, and
 * `scroll-mt-24` keeps the heading clear of the fixed header when it lands.
 */
export function HostCharges() {
  return (
    <section
      id="host-charges"
      aria-labelledby="host-charges-title"
      className="section-y container scroll-mt-24"
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <div id="host-charges-title">
            <SectionHeading lead="What it costs to " emphasis="list" />
          </div>

          <p className="text-base leading-normal text-page-fg lg:text-lg">
            {HOST_CHARGES.lede}
          </p>

          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {HOST_CHARGES.items.map((charge) => {
              const Icon = CHARGE_ICONS[charge.icon];
              return (
                <li key={charge.icon} className="flex gap-4 py-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-page-fg">
                    <Icon {...FRAME} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-medium text-page-fg">
                      {charge.title}
                    </h3>
                    <p className="text-base text-page-fg-70">{charge.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* The reference's text link, kept as text. Anything heavier here
              would compete with the closing CTA two sections down. */}
          <Link
            href="/how-it-works#escrow"
            className="w-max text-page-fg underline underline-offset-[4px]"
          >
            How escrow and payouts work
          </Link>
        </div>

        {/* No eyebrow above the number: the heading opposite already asks the
            question, and `stat.label` under the rule already names the unit. */}
        <div className="flex flex-col justify-center gap-5 rounded-card bg-ink p-8 text-white lg:min-h-[400px] lg:p-12">
          <p className="font-display text-display-sm font-medium lg:text-display-md">
            {HOST_CHARGES.stat.value}
          </p>
          <div className="h-px w-full bg-white/20" />
          <p className="max-w-tile text-white/70">{HOST_CHARGES.stat.label}</p>
        </div>
      </div>
    </section>
  );
}

/** 22px, the bottom of DESIGN.md's 22 to 24px icon step, stroked at 1px. */
const FRAME = { size: 22, strokeWidth: 1, "aria-hidden": true } as const;

/**
 * One mark per charge. A receipt for the fee, which is billed once and kept; a
 * calendar for the plan, whose point is WHEN it starts; a percent sign for the
 * commission, which is the number the panel opposite states.
 */
const CHARGE_ICONS = {
  fee: Receipt,
  plan: CalendarClock,
  commission: Percent,
} satisfies Record<HostCharge["icon"], LucideIcon>;
