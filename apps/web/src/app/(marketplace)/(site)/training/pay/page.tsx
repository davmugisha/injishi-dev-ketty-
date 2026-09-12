import type { Metadata } from "next";
import Link from "next/link";
import { MtnMark } from "@/components/icons/marks";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import { TRAINING_COURSE } from "@/data/training";
import { formatRwf } from "@/lib/money";
import { CopyButton } from "./copy-button";
import { PaymentPanel } from "./payment-panel";

/**
 * `/training/pay` — the MTN MoMo notice, and the place a learner says they paid.
 *
 * Split the same way `/training/enroll` is: everything a stranger and a
 * returning learner see identically — the amount, the USSD code, the five
 * steps — is server-rendered, and the one thing that depends on
 * `localStorage` (who you are, and how far the fee has got) is the client
 * island at the bottom. A page that read the store during render would send
 * markup for "unpaid" and repaint it as "confirmed" on hydration.
 *
 * THE AMOUNT AND THE CODE COME FROM `TRAINING_COURSE`, and this is the screen
 * where that matters most. `momoCode` is one literal in `data/training.ts`
 * because a USSD string assembled from parts is a string nobody can read off a
 * projector, and `feeRwf` goes through `formatRwf` so the fee is grouped the
 * same way here as on every other price in the app.
 *
 * THE STEPS ARE THE REAL MoMo PAY FLOW, in the order a Rwandan handset asks
 * them: dial, amount, merchant name, PIN, SMS. They are written out rather than
 * summarised as "pay with MoMo" because the person this page is for has paid a
 * shop this way a hundred times and has never paid a website, and the thing
 * they need to recognise is that it is the same five presses.
 */
export const metadata: Metadata = {
  title: "Pay the course fee",
  description: `Pay the ${formatRwf(TRAINING_COURSE.feeRwf)} Injishi Software Training fee with MTN MoMo Pay on ${TRAINING_COURSE.momoCode}, then enter the transaction reference to open the lessons.`,
};

/** The MoMo Pay flow, as the handset asks for it. */
const USSD_STEPS: { title: string; body: string }[] = [
  {
    title: `Dial ${TRAINING_COURSE.momoCode}`,
    body: "On the MTN line you enrolled with. It is the ordinary MoMo Pay menu — the same one you use in a shop.",
  },
  {
    title: `Enter the amount: ${formatRwf(TRAINING_COURSE.feeRwf)}`,
    body: "Type the figures only, with no spaces and no commas, when the menu asks for the amount.",
  },
  {
    title: "Check the name on the screen",
    body: "The handset shows who you are about to pay before it takes anything. If the name is not the one you expect, cancel and start again.",
  },
  {
    title: "Enter your MoMo PIN",
    body: "Nobody from Injishi will ever ask you for this PIN, on the phone or in a message.",
  },
  {
    title: "Keep the SMS",
    body: "MTN sends a confirmation with a transaction ID in it, a long number such as 18293746501. That is the reference to enter below.",
  },
];

export default function TrainingPayPage() {
  return (
    <div className="flex flex-col items-center">
      <PageHero
        title="Pay the course fee"
        trail={[
          { label: "Home", href: "/" },
          { label: "Training", href: "/training" },
          { label: "Pay" },
        ]}
        image={{
          stem: "kigali-city-street-01",
          alt: "A street in central Kigali on a working morning",
        }}
        lede={`${formatRwf(TRAINING_COURSE.feeRwf)}, once, by MTN MoMo Pay. The lessons open as soon as the fee is settled.`}
      />

      <section className="section-y container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* The notice. Amount and code first and biggest: this is the one
              screen where a person is holding a handset in the other hand. */}
          <div className="flex flex-col gap-8">
            <SectionHeading
              as="h2"
              lead="Pay by "
              emphasis="MTN MoMo"
              lede="One payment, from the MTN line you enrolled with. Pay from that number and the reference lines up with your enrolment on its own."
            />

            <div className="flex flex-col gap-6 rounded-card border border-border bg-secondary p-6 lg:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xs uppercase tracking-widest text-page-fg-70">
                    Amount to pay
                  </span>
                  <span className="text-3xl font-bold text-page-fg lg:text-display-sm">
                    {formatRwf(TRAINING_COURSE.feeRwf)}
                  </span>
                </div>
                {/* The digits alone, not the formatted string: the MoMo menu
                    takes `25000` and rejects `RWF 25,000`, so a copy button
                    that handed over the display string would paste something
                    the handset refuses. */}
                <CopyButton
                  value={String(TRAINING_COURSE.feeRwf)}
                  label="Copy the amount to pay"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-background p-4">
                <MtnMark className="size-12 shrink-0" />
                <div className="flex min-w-0 grow flex-col gap-1">
                  <span className="text-2xs uppercase tracking-widest text-page-fg-70">
                    MTN MoMo Pay code
                  </span>
                  {/* `break-all` rather than a smaller step: the string is
                      sixteen characters of punctuation and it has to stay
                      readable at arm's length on a phone. */}
                  <code className="break-all text-2xl font-bold tracking-wide text-page-fg">
                    {TRAINING_COURSE.momoCode}
                  </code>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2">
                  <CopyButton
                    value={TRAINING_COURSE.momoCode}
                    label="Copy the MTN MoMo Pay code"
                  />
                  {/* `#` has to be percent-encoded or the handset receives the
                      string truncated at the hash, which dials `*182*8*1*123456`
                      and lands on a menu that means nothing. Reading it off the
                      fixture rather than writing the encoded literal keeps the
                      code defined in exactly one place. */}
                  <a
                    href={`tel:${TRAINING_COURSE.momoCode.replace("#", "%23")}`}
                    className="text-2xs uppercase tracking-widest text-page-fg-70 underline underline-offset-[4px]"
                  >
                    Dial on this phone
                  </a>
                </div>
              </div>

              <ol className="m-0 flex list-none flex-col gap-5 p-0">
                {USSD_STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm text-page-fg-70"
                    >
                      {index + 1}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-base font-bold text-page-fg">
                        {step.title}
                      </span>
                      <span className="text-sm text-page-fg-70">
                        {step.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="max-w-read text-sm text-page-fg-70">
              Paying from a different number is not a problem, but it does mean
              somebody has to match the two by hand. If you paid from a second
              line, say so in the reference box below — write the number beside
              the transaction ID.
            </p>
          </div>

          <PaymentPanel />
        </div>

        {/* The same statement `/training` and `/training/enroll` carry. It is
            most load-bearing here: this is the screen that shows an amount and
            a payment code, and it is the screen a stakeholder is most likely to
            read as a live transaction. */}
        <p className="mt-12 max-w-read rounded-card border border-border p-4 text-sm text-page-fg-70">
          <b className="text-page-fg">This is a demonstration build.</b> No
          payment is taken and no money moves. The code above is a placeholder
          merchant code — dialling it pays Injishi nothing — and the fee, the
          reference and the confirmation on this screen are held in this browser
          only. See{" "}
          <Link href="/training" className="underline underline-offset-[4px]">
            the course page
          </Link>{" "}
          for what the module actually covers.
        </p>
      </section>
    </div>
  );
}
