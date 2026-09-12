import type { Metadata } from "next";
import { Badge } from "@injishi/ui";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  TRAINING_COURSE,
  TRAINING_MINUTES,
  TRAINING_PASS_MARK,
  TRAINING_QUESTION_COUNT,
} from "@/data/training";
import { CourseAccessNotice } from "./course-access-notice";
import { ModuleOverview } from "./module-overview";

/**
 * `/training/learn` — the module a learner comes back to.
 *
 * THIS PAGE DELIBERATELY DOES NOT OPEN WITH `PageHero`, and that is the one
 * layout decision worth writing down. `/training` does, because it is read once
 * by somebody deciding whether to pay, and a full-height photograph is what
 * makes that case. This page is read every time somebody sits down to do the
 * next lesson, and a `min-h-dvh` hero would put "continue where you left off" a
 * scroll below the fold on every one of those visits. `page-y` plus
 * `Breadcrumbs` is the pattern the app already uses for a working screen —
 * Support is built exactly this way — so this is the existing vocabulary rather
 * than a new one.
 *
 * A Server Component with two client islands. The curriculum is a constant and
 * renders here; only the marks and the ticks need `localStorage`, and those
 * live in `module-overview.tsx` and `course-access-notice.tsx`.
 */
export const metadata: Metadata = {
  title: "Accommodation and Booking",
  description:
    "Work through the Accommodation and Booking module lesson by lesson: what a listing promises, pricing, the calendar, confirmed bookings, payouts, cancellations and RRA compliance. Each lesson ends in a marked question set.",
};

const MODULE = TRAINING_COURSE.modules[0];

export default function TrainingLearnPage() {
  return (
    <div className="page-y">
      {/* Capped at `max-w-page` (70rem) inside the 1320px column, and centred.
          The panels below are full-width blocks and the prose above them is a
          reading measure, so at the full column the page opened with 600px of
          empty gutter beside the summary and none beside the progress rail —
          two different left-to-right rhythms on one screen. */}
      <div className="container">
        <div className="mx-auto flex max-w-page flex-col gap-8">
          <div className="flex flex-col gap-5 border-b border-border pb-8">
            <Breadcrumbs
              trail={[
                { label: "Home", href: "/" },
                { label: "Training", href: "/training" },
                { label: MODULE.title },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">Module 1 of 1</Badge>
              <Badge variant="outline">{MODULE.lessons.length} lessons</Badge>
              <Badge variant="outline">{TRAINING_MINUTES} min of reading</Badge>
              <Badge variant="outline">
                {TRAINING_QUESTION_COUNT} marked questions
              </Badge>
            </div>

            <SectionHeading as="h1" lead="Accommodation and " emphasis="Booking" />

            <p className="max-w-read text-page-fg-70">{MODULE.summary}</p>

            <p className="max-w-read text-page-fg-70">
              Work through the lessons in order. Each one ends in a short set of
              marked questions, and every answer is explained — including the
              ones you get right — so a question you guessed does not stay
              guessed. The best mark you have ever scored on a lesson is the one
              that counts towards the {TRAINING_PASS_MARK}% you need for the
              certificate, so taking a set again can only help you.
            </p>
          </div>

          <CourseAccessNotice />

          <ModuleOverview />

          {/* The same statement `/training` carries, for the same reason: a room
              watching somebody complete a course and collect a certificate will
              otherwise assume a fee was taken and an examiner signed something.
              `data/training.ts` says it again for anyone reading the code. */}
          <p className="max-w-read rounded-card border border-border p-4 text-sm text-page-fg-70">
            <b className="text-page-fg">This is a demonstration build.</b> The
            lessons are written to be genuinely useful to a Rwandan host, but
            they have not been reviewed by RRA or by a lawyer and must not be
            quoted as guidance. No fee is collected, and the enrolment, marks
            and certificate you can walk through are held in this browser only.
          </p>
        </div>
      </div>
    </div>
  );
}
