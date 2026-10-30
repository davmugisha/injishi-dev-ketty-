import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImigongoBackground } from "@/components/home/illustrations";
import { supportHref } from "@/lib/support-intent";

/**
 * The band the home page shows while nothing is listed yet.
 *
 * Production opened with an empty catalogue, and the shelf of stays that should
 * sit here returned nothing at all, so the page went from "when to go" straight
 * to "how a stay works" with no stay anywhere in between. This says what is
 * true instead: places are being verified, here is how, and here is what each
 * reader can do about it today. It is replaced by the shelf the moment one
 * property is public, with no flag to remember.
 *
 * Product-true copy only. The verification steps are the registration
 * pipeline's own (RRA TIN check, then a district officer's visit, D20), and
 * nothing here promises a date.
 */
export function OpeningBand() {
  return (
    <section className="section-y container">
      <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-card bg-card px-6 py-10 text-foreground ring-1 ring-border md:px-10 lg:flex-row lg:items-center lg:justify-between">
        <ImigongoBackground id="opening-imigongo" className="-z-10 text-accent opacity-[0.08]" />
        <div className="flex max-w-wide flex-col gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent-text">
            Opening across Rwanda
          </p>
          <h2 className="text-2xl font-bold leading-tight lg:text-3xl">
            The first stays are being verified now
          </h2>
          <p className="text-sm text-muted-foreground lg:text-base">
            Injishi lists a place only after it has passed verification: an RRA TIN check, then a
            visit from a district officer. The first hosts are going through it, Kigali first. Own a
            guesthouse, lodge or apartment? You can be one of them.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            href="/host"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity duration-quick hover:opacity-90"
          >
            List your place
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={supportHref("opening")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-surface-secondary px-6 py-3 text-sm font-semibold text-foreground ring-1 ring-border transition-colors duration-quick hover:bg-card"
          >
            Tell me when my district opens
          </Link>
        </div>
      </div>
    </section>
  );
}
