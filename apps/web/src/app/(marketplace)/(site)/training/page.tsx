import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button } from "@injishi/web-ui";
import {
  TRAINING_CREDENTIAL_WORDING,
  type TrainingPublicCourse,
  type TrainingPublicSession,
} from "@injishi/contracts";
import { SectionHeading } from "@/components/shared/section-heading";
import { fetchTrainingCourses, hasAnySession } from "@/data/training-api";
import { formatSessionWhen } from "@/lib/training-format";
import { formatRwf } from "@/lib/money";

/**
 * `/training` — the published courses and the dates you can attend (ADR-049).
 *
 * WHAT THIS PAGE USED TO BE, so nobody rebuilds it. It sold a SELF-PACED online
 * course: a fixture curriculum in `data/training.ts`, lessons and marked
 * questions under `/training/learn`, a pass mark of 70, a MoMo code you dialled
 * on `/training/pay`, and a certificate issued by `localStorage` for scoring
 * well. None of that existed on a server and none of it survives. ADR-049
 * replaced the whole idea: training is a LIVE, in person session, attendance is
 * the only thing that earns a certificate, and there is no online session of
 * any kind.
 *
 * A Server Component reading the public API with no cookie (AC-1). A stranger
 * has to be able to read this page and find a date near them before they have
 * an account, which is the entire funnel.
 *
 * `dynamic = "force-dynamic"` because sessions get published, rescheduled and
 * cancelled, and a cached page showing a cancelled session sends somebody on a
 * bus to a hall nobody will open. The cost is one API call per view; the
 * alternative is wasted journeys.
 *
 * IT SAYS THE FEE IS NOT COLLECTED. Every session carries a price and nothing
 * in this build takes payment, so the page states that in words
 * (`TRAINING_CREDENTIAL_WORDING.feeNotice`). A price on a public page that
 * nobody is asked to pay is otherwise read as a price already paid, and
 * somebody would turn up believing they had settled it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Injishi training",
  description:
    "Short, in person training for Rwandan hosts: what a listing promises, how to price a room, how bookings and payouts work, and what RRA expects. Attend a session and you get a certificate anyone can check.",
};

/** Who the sessions are written for, in the words they would use themselves. */
const AUDIENCE = [
  {
    title: "Owners putting a place online for the first time",
    body: "You have four rooms in Musanze, or a guesthouse in Rubavu, and you have taken bookings by phone and WhatsApp for years. Nothing assumes you have used a booking platform before.",
  },
  {
    title: "Receptionists and managers who run the desk",
    body: "You are the person who will actually keep the calendar, answer the guest and issue the receipt. The session is run for the desk, not for head office.",
  },
  {
    title: "Anyone about to register a business with us",
    body: "Registration asks for a TIN, a UPI and documents. A trainer will walk you through what RRA expects of a small accommodation business and why we ask before you list.",
  },
];

/** What actually happens, start to finish. Four steps, no assessment. */
const STEPS = [
  {
    title: "Pick a date near you",
    body: "Sessions run at venues around the country and at our office in Kigali. Every date below shows the district and the province it is in.",
  },
  {
    title: "Register online",
    body: "Your name, phone and the business you work for. You sign in with a code sent to your e-mail, so there is no password to remember.",
  },
  {
    title: "Turn up and take part",
    body: "A trainer runs the session in person and marks who attended. That mark is the only thing that issues a certificate.",
  },
  {
    title: "Get a certificate anyone can check",
    body: "A PDF, e-mailed to you and kept on your account. It carries a QR code: anyone you show it to can scan it and see it is genuine.",
  },
];

export default async function TrainingPage() {
  const result = await fetchTrainingCourses();
  const courses = result.status === "ok" ? result.data : [];
  const reachable = result.status === "ok";

  return (
    <>
      <section className="container pb-8 pt-28 lg:pt-36">
        <div className="max-w-read">
          <Badge variant="subtle">In person training</Badge>
          <h1 className="mt-4 text-3xl font-bold text-foreground md:text-display-md">
            Learn how to run your place on Injishi
          </h1>
          <p className="mt-4 text-muted-foreground">
            A short course, run in person by one of our trainers, for hosts and
            the people who work the front desk. Attend a session and you leave
            with a certificate that anybody can check by scanning it.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            There is no online version, and nothing you can read on this site
            earns a certificate. The credential records that you were in the
            room.
          </p>
        </div>
      </section>

      <section className="container py-8" id="dates">
        <SectionHeading
          lead="Dates you can "
          emphasis="register for"
          lede={
            reachable && hasAnySession(courses)
              ? "Every session below is open. Seat counts are a guide rather than a limit, and the page will tell you when a session is over its count."
              : undefined
          }
        />

        {!reachable ? (
          <Notice
            title="We could not load the dates just now"
            body="This is a problem at our end. Try again in a moment, or ask us and we will tell you when the next session runs."
          />
        ) : courses.length === 0 ? (
          <Notice
            title="No course is open for registration yet"
            body="Nothing is published at the moment. Check back, or ask us to tell you when the next session is set."
          />
        ) : (
          <div className="mt-8 grid gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        <p className="mt-6 max-w-read text-sm text-muted-foreground">
          {TRAINING_CREDENTIAL_WORDING.feeNotice}
        </p>
      </section>

      <section className="container py-12">
        <SectionHeading lead="How it" emphasis="works" />
        <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-card border border-border bg-card p-6"
            >
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </span>
              <h3 className="mt-2 font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container py-12 pb-20">
        <SectionHeading lead="Who it is" emphasis="for" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {AUDIENCE.map((who) => (
            <div
              key={who.title}
              className="rounded-card border border-border bg-card p-6"
            >
              <h3 className="font-semibold text-foreground">{who.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{who.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * One published course and its dates.
 *
 * A course with NO published session still renders, carrying a line saying so.
 * The API returns it deliberately: somebody looking for training should be able
 * to see the course exists and that no date is set, rather than see nothing and
 * conclude we do not run it.
 */
function CourseCard({ course }: { course: TrainingPublicCourse }) {
  return (
    <article className="rounded-card border border-border bg-card p-6 md:p-8">
      <h3 className="text-xl font-semibold text-foreground">{course.title}</h3>
      <p className="mt-2 max-w-read text-sm text-muted-foreground">
        {course.summary}
      </p>

      {course.sessions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No date is set for this course yet.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {course.sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * One date, with everything somebody needs to decide whether to go (AC-1).
 *
 * `seatsRemaining` IS ALLOWED TO BE NEGATIVE and the row says so plainly
 * (AC-5). Registration past the seat count succeeds, so hiding an
 * over-subscribed session, or clamping the number at zero, would keep the fact
 * from the one person it matters to: somebody about to travel to it.
 */
function SessionRow({ session }: { session: TrainingPublicSession }) {
  return (
    <li className="flex flex-col gap-4 rounded border border-border bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-foreground">
          {formatSessionWhen(session.startsAt)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.venue.name}, {session.venue.districtName}
          {session.venue.provinceName
            ? ` (${session.venue.provinceName})`
            : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRwf(session.feeRwf)}
          {" · "}
          {session.isOverSubscribed
            ? `Over its seat count of ${session.seatCount}`
            : `${session.seatsRemaining} of ${session.seatCount} seats left`}
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        {session.isOverSubscribed ? (
          <Badge variant="warning">Over its seat count</Badge>
        ) : null}
        <Button asChild>
          <Link href={`/training/enroll?session=${session.id}`}>
            Register for this date
          </Link>
        </Button>
      </div>
    </li>
  );
}

/** The two states that are not a list of dates, worded so neither reads as an error. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-card border border-border bg-card p-6">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-read text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/support">Ask us about training</Link>
      </Button>
    </div>
  );
}
