import Link from "next/link";
import { SpotCheckIn, SpotFind, SpotPay, SpotReceipt } from "@/components/home/illustrations";
import { SectionHeading } from "@/components/shared/section-heading";

/**
 * "How a stay works": four steps, from search to receipt.
 *
 * Every line is something the product does today, and says no more than
 * that. Payment is captured and HELD — the band says "held", never "released
 * to the host on arrival", because no release runs yet. Refunds within the
 * cancellation policy do run, so that much is promised.
 */
const STEPS = [
  {
    spot: SpotFind,
    title: "Find a stay",
    body: "Prices are per person, per night, and your party's total shows before you pay.",
  },
  {
    spot: SpotPay,
    title: "Pay by mobile money",
    body: "MTN MoMo or Airtel Money. The payment is held in escrow, not sent straight to the host.",
  },
  {
    spot: SpotCheckIn,
    title: "Check in",
    body: "Your booking reference is all the front desk needs. Cancel within the policy and you're refunded.",
  },
  {
    spot: SpotReceipt,
    // Not "EBM receipt": Injishi is not connected to the RRA yet, and the
    // receipt page itself says it is not a fiscal receipt.
    title: "Keep your receipt",
    body: "A receipt for every booking, kept with your trips.",
  },
] as const;

export function HowAStayWorks() {
  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="How a stay "
        emphasis="works"
        action={{ label: "The details", href: "/how-it-works" }}
      />

      <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* The thread through the four steps: one road, not four tiles. */}
        <span
          aria-hidden
          className="absolute left-12 right-12 top-12 hidden border-t-2 border-dashed border-accent/50 lg:block"
        />
        {STEPS.map(({ spot: Spot, title, body }, index) => (
          <li key={title} className="group relative flex flex-col gap-3">
            <span className="relative w-max rounded-full bg-background p-1 transition-transform duration-travel ease-spring group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
              <Spot />
              <span className="absolute right-0 top-0 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background ring-4 ring-background">
                {index + 1}
              </span>
            </span>
            <h3 className="mt-1 text-lg font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <p className="text-sm text-muted-foreground">
        No phone calls from search to arrival.{" "}
        <Link href="/how-it-works#escrow" className="font-semibold text-foreground underline underline-offset-4">
          How escrow works
        </Link>
      </p>
    </section>
  );
}
