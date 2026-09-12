import type { Metadata } from "next";
import Link from "next/link";
import { MtnMark } from "@/components/icons/marks";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import { TRAINING_COURSE, TRAINING_LESSONS, TRAINING_MINUTES } from "@/data/training";
import { formatRwf } from "@/lib/money";
import type { TrainingEnrolment } from "@/lib/training-store";
import { EnrolForm } from "./enrol-form";

/**
 * `/training/enroll` — the four questions the course asks before it takes money.
 *
 * The page is a Server Component and the form is the one client island on it,
 * for the reason `/training` gives at length: `lib/training-store.ts` reads
 * `localStorage`, which does not exist on the server, so anything that renders
 * from it has to render after mount or the first client paint disagrees with
 * the markup that was sent. Everything on this page that is NOT the form —
 * the hero, the fee, the MoMo code, the reasons each question is asked — is
 * the same for a stranger and for somebody who enrolled last week, so it is
 * server-rendered and never flickers.
 *
 * THE FEE AND THE USSD CODE ARE READ FROM `TRAINING_COURSE`, never typed here.
 * They appear on four screens now (landing, this one, the payment notice and
 * the FAQ), and a fee retyped on the fourth screen is a fee that disagrees with
 * the other three the day it changes.
 *
 * No `layout.tsx` was added beside this file. `/training/page.tsx` records why
 * in full: a new layout route makes the seven generated `.next…/types`
 * directories that `tsconfig.json` feeds into one program disagree about the
 * `LayoutRoutes` union, and every layout in the app then fails to validate. The
 * marketplace root's `%s | Injishi` template titles this page correctly anyway.
 */
export const metadata: Metadata = {
  title: "Enrol in the training",
  description: `Register for the Injishi Software Training: your name, e-mail, phone and National ID. The fee is ${formatRwf(TRAINING_COURSE.feeRwf)}, paid by MTN MoMo on the next screen.`,
};

/**
 * The four fields the enrolment stores, and the reason each one is asked.
 *
 * Typed against `TrainingEnrolment`'s own keys rather than against a list of
 * strings, so a field renamed in the store breaks this page at compile time
 * instead of leaving a paragraph on screen explaining a question nobody is
 * asked any more. `field` is also the anchor: `EnrolForm` gives every control
 * that same id, so each row here is a link that puts the caret in the field it
 * is talking about.
 *
 * `enrolledAt` is omitted because the store stamps it — see `setEnrolment` —
 * and a form that asked a person what time it is would be a form asking a
 * question it can answer itself.
 */
const WHY_WE_ASK: {
  field: keyof Omit<TrainingEnrolment, "enrolledAt">;
  label: string;
  why: string;
}[] = [
  {
    field: "fullName",
    label: "Full name",
    why: "The certificate is printed with exactly what you type here, so give the name on your National ID rather than the short one everybody calls you.",
  },
  {
    field: "email",
    label: "E-mail address",
    why: "Where the certificate is sent the moment you pass. Use an address you will still be able to open in a year, not one you share with the desk.",
  },
  {
    field: "phone",
    label: "Phone number",
    why: "Pay the fee from this line. When the MoMo reference and the enrolment name the same number, nobody has to go hunting for your payment.",
  },
  {
    field: "nationalId",
    label: "National ID",
    why: "A certificate naming only an e-mail address proves nothing about who sat the course. The ID is what ties it to a person.",
  },
];

/** What happens after the form, in the order it happens. */
const NEXT_STEPS = [
  {
    title: "Pay the fee by MoMo",
    body: `${formatRwf(TRAINING_COURSE.feeRwf)} on ${TRAINING_COURSE.momoCode}, then enter the reference from the MTN message.`,
  },
  {
    title: "Work through the lessons",
    body: `${TRAINING_LESSONS.length} lessons, about ${TRAINING_MINUTES} minutes of reading, with marked questions at the end of each one.`,
  },
  {
    title: "Collect the certificate",
    body: "Issued in your name and sent to the address above as soon as you pass.",
  },
];

export default function TrainingEnrolPage() {
  return (
    <div className="flex flex-col items-center">
      <PageHero
        title="Enrol in the training"
        trail={[
          { label: "Home", href: "/" },
          { label: "Training", href: "/training" },
          { label: "Enrol" },
        ]}
        image={{
          stem: "kigali-convention-centre-02",
          alt: "The Kigali Convention Centre lit at night",
        }}
        lede="Four questions, about a minute. The fee is paid on the next screen and the lessons open as soon as it is settled."
      />

      <section className="section-y container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <SectionHeading
              as="h2"
              lead="Your "
              emphasis="details"
              lede="Give these the way they appear on your documents. They are what the certificate is printed from, and they cannot be corrected once it has been issued."
            />

            <EnrolForm />
          </div>

          <aside className="flex h-fit flex-col gap-8">
            {/* The fee, on the screen that asks for the details, because a
                person who reaches the payment notice and meets the price for
                the first time is a person who abandons the payment notice. */}
            <div className="rounded-card border border-border bg-secondary p-6 lg:p-8">
              <p className="text-2xs uppercase tracking-widest text-page-fg-70">
                One-time course fee
              </p>
              <p className="mt-1 text-3xl font-bold text-page-fg">
                {formatRwf(TRAINING_COURSE.feeRwf)}
              </p>
              <p className="mt-2 text-sm text-page-fg-70">
                Paid once, on the next screen. Nothing is charged while you fill
                this in.
              </p>

              <div className="mt-6 flex items-center gap-3 rounded-card border border-border bg-background p-3">
                <MtnMark className="size-10 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-2xs uppercase tracking-widest text-page-fg-70">
                    MTN MoMo Pay
                  </span>
                  <code className="text-base font-bold tracking-wide text-page-fg">
                    {TRAINING_COURSE.momoCode}
                  </code>
                </div>
              </div>

              <ol className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
                {NEXT_STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs text-page-fg-70"
                    >
                      {index + 1}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-page-fg">
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

            <div className="rounded-card border border-border p-6 lg:p-8">
              <h2 className="text-lg font-bold text-page-fg">
                Why we ask for each of these
              </h2>
              <dl className="m-0 mt-4 flex flex-col gap-4">
                {WHY_WE_ASK.map((entry) => (
                  <div key={entry.field} className="flex flex-col gap-1">
                    <dt className="text-sm font-bold text-page-fg">
                      {/* An ordinary anchor rather than a `Link`: this is a
                          same-page jump to a form control, and the router has
                          nothing to do with it. */}
                      <a
                        href={`#${entry.field}`}
                        className="underline underline-offset-[4px]"
                      >
                        {entry.label}
                      </a>
                    </dt>
                    <dd className="m-0 text-sm text-page-fg-70">{entry.why}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>

        {/* Said out loud, on the page, because the alternative is a room full
            of stakeholders believing a payment was taken. `/training` and
            `data/training.ts` carry the same statement. */}
        <p className="mt-12 max-w-read rounded-card border border-border p-4 text-sm text-page-fg-70">
          <b className="text-page-fg">This is a demonstration build.</b> No fee
          is collected and no account is created: the MoMo code shown is a
          placeholder merchant code, and the enrolment you are about to make is
          held in this browser only. Read{" "}
          <Link href="/training" className="underline underline-offset-[4px]">
            the course page
          </Link>{" "}
          if you have not seen what the module covers.
        </p>
      </section>
    </div>
  );
}
