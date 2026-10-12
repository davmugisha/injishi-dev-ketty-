import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImigongoBackground, LodgeScene } from "@/components/home/illustrations";

/**
 * The slim host band that closes the page.
 *
 * One line to the other audience, property owners. It used to be a 320px
 * photograph with a scrim; at the foot of a long page that was a second hero
 * for the minority of readers. Product-true copy only, and no offer number.
 */
export function HostBand() {
  return (
    <section className="container pb-16 pt-4">
      <div className="relative isolate grid items-center gap-6 overflow-hidden rounded-card bg-card px-6 py-8 text-foreground ring-1 ring-border md:grid-cols-[minmax(0,1fr)_auto_minmax(0,16rem)] md:px-10">
        <ImigongoBackground id="host-imigongo" className="-z-10 text-accent opacity-[0.08]" />
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Own a guesthouse, lodge or apartment?</h2>
          <p className="text-sm text-muted-foreground">
            List it on Injishi: guests pay by mobile money, held in escrow, and book without a phone call.
          </p>
        </div>
        <Link
          href="/host"
          className="inline-flex w-max shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity duration-quick hover:opacity-90"
        >
          Become a host
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <LodgeScene className="hidden md:block" />
      </div>
    </section>
  );
}
