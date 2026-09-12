import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
} from "@injishi/ui";
import { MtnMark } from "@/components/icons/marks";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  TRAINING_COURSE,
  TRAINING_MINUTES,
  TRAINING_PASS_MARK,
  TRAINING_QUESTION_COUNT,
} from "@/data/training";
import { formatRwf } from "@/lib/money";

/**
 * `/training` — the page that sells the course.
 *
 * A Server Component with no client island at all, which is deliberate. The
 * only thing this page could usefully read from `lib/training-store.ts` is
 * whether the visitor has already enrolled, and a marketing page that renders
 * differently after mount flickers on every load for the sake of one line.
 * Enrolment state belongs on `/training/enroll` and on the lesson screens,
 * which is where the store is read.
 *
 * Everything on the page comes from `data/training.ts` — the lesson list, the
 * fee, the MoMo code, the totals. Nothing is retyped here, so the curriculum
 * cannot drift between the page that sells it and the pages that teach it.
 *
 * THERE IS DELIBERATELY NO `layout.tsx` BESIDE THIS FILE. One was written, to
 * carry a `%s | Injishi Software Training` title template for the four routes
 * under `/training`. It was removed because it broke `pnpm typecheck` across
 * the whole app for a cosmetic gain: `tsconfig.json` feeds SEVEN generated
 * `.next…/types` directories into one program, each declaring its own
 * `LayoutRoutes` union and its own global `LayoutConfig`, so the first new
 * layout route added after the last build makes the fresh union and the stale
 * one disagree and every layout in the app fails to validate. The marketplace
 * root's `%s | Injishi` template already titles these pages correctly, so the
 * section gains nothing worth that.
 */
export const metadata: Metadata = {
  title: "Injishi Software Training",
  description:
    "A paid short course for Rwandan hosts: what a listing promises, how to price a room, how availability and bookings work, how you get paid, and what RRA expects. Ends in a digital certificate.",
};

const MODULE = TRAINING_COURSE.modules[0];

/** Who the course was written for, in the words they would use themselves. */
const AUDIENCE = [
  {
    title: "Owners putting a place online for the first time",
    body: "You have four rooms in Musanze, or a guesthouse in Rubavu, and you have taken bookings by phone and WhatsApp for years. Nothing here assumes you have used a booking platform before.",
  },
  {
    title: "Receptionists and managers who run the desk",
    body: "You are the person who will actually keep the calendar, answer the guest and issue the receipt. The course is written for the desk, not for head office.",
  },
  {
    title: "Anyone about to register a business with us",
    body: "Registration asks for a TIN, a UPI and documents. The last lesson covers what RRA expects of a small accommodation business and why we ask before you list.",
  },
];

/** The four steps, stated plainly enough to be read as a promise. */
const STEPS = [
  {
    title: "Enrol",
    body: "Your name, e-mail, phone and national ID. It takes about a minute and you can do it from a phone.",
  },
  {
    title: `Pay ${formatRwf(TRAINING_COURSE.feeRwf)} by MoMo`,
    body: `Dial ${TRAINING_COURSE.momoCode} on the MTN line you enrolled with, then tell us the reference. The course opens as soon as the fee is settled.`,
  },
  {
    title: "Work through the lessons",
    body: `${MODULE.lessons.length} lessons and ${TRAINING_QUESTION_COUNT} marked questions, about ${TRAINING_MINUTES} minutes of reading in total. Stop and come back; the course remembers where you were.`,
  },
  {
    title: "Collect your certificate",
    body: `Score ${TRAINING_PASS_MARK} or more across the questions and your certificate is issued and sent to the e-mail address you enrolled with.`,
  },
];

const FAQ = [
  {
    question: "What does the course cost, and is there anything else to pay?",
    answer: `${formatRwf(TRAINING_COURSE.feeRwf)}, once. There is no monthly fee and no charge for the certificate. It is separate from the one-time business registration fee, which is set per accommodation type and paid on the registration wizard, not here.`,
  },
  {
    question: "How do I pay?",
    answer: `MTN MoMo Pay. Dial ${TRAINING_COURSE.momoCode} on your phone, pay the fee, and enter the reference on the payment screen. Pay from the number you enrolled with, so the two records match.`,
  },
  {
    question: "How long does it take?",
    answer: `About ${TRAINING_MINUTES} minutes of reading spread over ${MODULE.lessons.length} lessons, plus the questions at the end of each one. Most people do it across two or three sittings. There is no deadline and no cohort to keep up with.`,
  },
  {
    question: "What is the certificate, and how do I get it?",
    answer: `A digital certificate in your name, carrying its own serial number. It is issued once you have finished every lesson and scored at least ${TRAINING_PASS_MARK} across the questions, and it is delivered to the e-mail address you enrolled with.`,
  },
  {
    question: "Do I need to have registered a business first?",
    answer:
      "No. You can take the course before, during or after registration. Hosts who take it first tend to find the registration steps quicker, because the last lesson explains what the documents are for.",
  },
];

export default function TrainingPage() {
  return (
    <div className="flex flex-col items-center">
      <PageHero
        title="Injishi Software Training"
        trail={[{ label: "Home", href: "/" }, { label: "Training" }]}
        image={{
          stem: "rwanda-kigali-hero",
          alt: "Kigali skyline at dusk",
        }}
        lede="A short paid course for Rwandan hosts, on the things that decide whether a room sells and whether the money reaches you cleanly."
      />

      {/* The offer, before anything else. A course page that makes a reader
          scroll to find the price is a course page people leave. */}
      <section className="section-y container">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">One module</Badge>
              <Badge variant="outline">{MODULE.lessons.length} lessons</Badge>
              <Badge variant="outline">Certificate by e-mail</Badge>
            </div>

            <SectionHeading
              as="h2"
              lead="Learn to run "
              emphasis="Accommodation and Booking"
            />

            <p className="max-w-read text-page-fg-70">{MODULE.summary}</p>

            <p className="max-w-read text-page-fg-70">
              It is written for someone who has never used a booking platform
              and has run a guesthouse for years — plain language, Rwandan
              examples, and one marked question set per lesson so you find out
              what you missed while it still matters.
            </p>

            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Stat label="Lessons" value={String(MODULE.lessons.length)} />
              <Stat label="Reading" value={`${TRAINING_MINUTES} min`} />
              <Stat
                label="Questions"
                value={String(TRAINING_QUESTION_COUNT)}
              />
              <Stat label="Pass mark" value={`${TRAINING_PASS_MARK}%`} />
            </dl>
          </div>

          {/* The price card. It carries the fee, the payment method and the
              call to action in one block, because those three are the decision
              and splitting them across the page splits the decision. */}
          <aside className="h-fit rounded-card border border-border bg-secondary p-6 lg:p-8">
            <p className="text-2xs uppercase tracking-widest text-page-fg-70">
              One-time course fee
            </p>
            <p className="mt-1 text-3xl font-bold text-page-fg">
              {formatRwf(TRAINING_COURSE.feeRwf)}
            </p>
            <p className="mt-2 text-sm text-page-fg-70">
              Paid once. Includes every lesson, every question set and the
              certificate.
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

            <ul className="mt-6 flex list-none flex-col gap-2.5 p-0 text-sm text-page-fg-70">
              {[
                "Enrol in about a minute, from a phone",
                "Start immediately once the fee is settled",
                "No deadline — stop and come back",
                "Certificate in your name, sent by e-mail",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-brand"
                  />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-3">
              <Button asChild size="lg">
                <Link href="/training/enroll">Enrol for the course</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#curriculum">See the full curriculum</Link>
              </Button>
            </div>
          </aside>
        </div>
      </section>

      {/* The curriculum, read straight off the fixture the lessons render from.
          Every lesson opens with its own first sentence rather than a blurb
          written for this page, so the promise here is literally the lesson. */}
      <section
        id="curriculum"
        className="section-y-loose w-full scroll-mt-28 bg-secondary"
      >
        <div className="container">
          <SectionHeading
            lead="The module: "
            emphasis={MODULE.title}
            lede={`${MODULE.lessons.length} lessons, in the order a host meets them.`}
            className="mb-10"
          />

          <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {MODULE.lessons.map((lesson, index) => (
              <li
                key={lesson.slug}
                className="flex gap-4 rounded-card border border-border bg-background p-5"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-sm text-page-fg-70"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold text-page-fg">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-page-fg-70">
                    {firstSentence(lesson.body[0])}
                  </p>
                  <p className="text-2xs uppercase tracking-widest text-page-fg-70">
                    {lesson.minutes} min read · {lesson.quiz.length} questions
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-y container">
        <SectionHeading
          lead="Who it is "
          emphasis="for"
          className="mb-10"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {AUDIENCE.map((entry) => (
            <div
              key={entry.title}
              className="flex flex-col gap-2 rounded-card border border-border p-6"
            >
              <h3 className="text-lg font-bold text-page-fg">{entry.title}</h3>
              <p className="text-sm text-page-fg-70">{entry.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-y-loose w-full bg-secondary">
        <div className="container">
          <SectionHeading
            lead="How it "
            emphasis="works"
            lede="Four steps, from paying the fee to holding the certificate."
            className="mb-10"
          />

          <ol className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2.5">
                <span className="text-2xs uppercase tracking-widest text-page-fg-70">
                  Step {index + 1}
                </span>
                <h3 className="text-lg font-bold text-page-fg">{step.title}</h3>
                <p className="text-sm text-page-fg-70">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/training/enroll">
                Enrol for {formatRwf(TRAINING_COURSE.feeRwf)}
              </Link>
            </Button>
            <p className="text-sm text-page-fg-70">
              Pay by MoMo on{" "}
              <code className="font-bold text-page-fg">
                {TRAINING_COURSE.momoCode}
              </code>
            </p>
          </div>
        </div>
      </section>

      <section className="section-y container">
        <SectionHeading
          lead="Frequently Asked "
          emphasis="Questions"
          className="mb-8"
        />

        <Accordion type="single" collapsible defaultValue={FAQ[0]?.question}>
          {FAQ.map((entry) => (
            <AccordionItem key={entry.question} value={entry.question}>
              <AccordionTrigger className="text-page-fg">
                {entry.question}
              </AccordionTrigger>
              <AccordionContent className="text-page-fg-70">
                {entry.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Said out loud, on the page, because the alternative is a room full
            of stakeholders believing a payment was taken. `data/training.ts`
            carries the same statement for anyone reading the code. */}
        <p className="mt-10 max-w-read rounded-card border border-border p-4 text-sm text-page-fg-70">
          <b className="text-page-fg">This is a demonstration build.</b> The
          course content is real and written to be useful, but no fee is
          collected: the MoMo code shown is a placeholder merchant code, and the
          enrolment, payment and certificate you can walk through are held in
          this browser only.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-2xs uppercase tracking-widest text-page-fg-70">
        {label}
      </dt>
      <dd className="m-0 text-xl font-bold text-page-fg">{value}</dd>
    </div>
  );
}

/**
 * The opening sentence of a lesson, used as its summary on this page.
 *
 * Taking the whole first paragraph would set four lines of body copy in a card
 * built for two, and writing a separate blurb per lesson would create a second
 * description that drifts from the lesson the day either is edited. The regex
 * is deliberately simple: these are authored strings in one file, not arbitrary
 * input, and every one of them ends its first sentence with a full stop.
 */
function firstSentence(paragraph: string): string {
  const end = paragraph.indexOf(". ");
  return end === -1 ? paragraph : `${paragraph.slice(0, end)}.`;
}
