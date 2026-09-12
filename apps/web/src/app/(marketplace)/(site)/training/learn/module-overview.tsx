"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Badge, Button, Progress, Skeleton } from "@injishi/ui";
import {
  TRAINING_LESSONS,
  TRAINING_PASS_MARK,
  TRAINING_QUESTION_COUNT,
} from "@/data/training";
import { resetTraining } from "@/lib/training-store";
import { useTrainingState } from "./use-training-state";

/**
 * The module rail: where the learner is, what is left, and the one action that
 * carries them on.
 *
 * A client island rather than a whole client page. The lesson titles, minutes
 * and question counts are constants and are rendered on the server by
 * `page.tsx`; only the parts that depend on `localStorage` — the marks, the
 * ticks, the wording of the primary button — live here. That split is why a
 * reload paints the curriculum immediately and fills in the progress a frame
 * later, rather than showing an empty page until React mounts.
 */
export function ModuleOverview() {
  const { state, progress, ready } = useTrainingState();

  /**
   * The next lesson to actually open: the first one not finished, in course
   * order, rather than the one after the most recently finished. A learner who
   * skipped lesson two and did lesson three is sent back to two, which is what
   * "continue where you left off" has to mean when the mark averages every
   * quiz taken.
   */
  const nextUp =
    TRAINING_LESSONS.find((lesson) => !state.completed.includes(lesson.slug)) ??
    null;

  /**
   * Questions answered, derived from the lesson marks rather than counted.
   *
   * The store records ONE mark per lesson, written when the last question in
   * that lesson is answered, so a lesson with a mark is a lesson whose whole
   * question set was answered. Counting them this way keeps the number honest
   * without asking the store for a shape it does not have.
   */
  const answered = TRAINING_LESSONS.reduce(
    (total, lesson) =>
      total + (state.scores[lesson.slug] === undefined ? 0 : lesson.quiz.length),
    0,
  );

  const passing = progress.mark >= TRAINING_PASS_MARK;
  const finished = progress.allLessonsDone;

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-label="Your progress"
        className="rounded-card border border-border bg-secondary p-6 lg:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-2xs uppercase tracking-widest text-page-fg-70">
                Course progress
              </span>
              {ready ? (
                <span className="text-sm text-page-fg-70">
                  {progress.completed} of {progress.total} lessons
                </span>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
            </div>

            <Progress
              value={ready ? progress.percent : 0}
              aria-label="Lessons completed"
              indicatorClassName={
                finished ? "bg-success" : "bg-accent-brand"
              }
            />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat
                label="Lessons done"
                value={`${progress.completed} / ${progress.total}`}
                ready={ready}
              />
              <Stat
                label="Questions answered"
                value={`${answered} / ${TRAINING_QUESTION_COUNT}`}
                ready={ready}
              />
              <Stat
                label={`Mark · pass is ${TRAINING_PASS_MARK}%`}
                value={answered === 0 ? "Not marked yet" : `${progress.mark}%`}
                ready={ready}
                tone={passing && answered > 0 ? "good" : "neutral"}
              />
            </dl>
          </div>

          <div className="flex shrink-0 flex-col gap-3 lg:w-tile">
            {ready ? (
              <Button asChild size="lg">
                <Link
                  href={`/training/learn/${(nextUp ?? TRAINING_LESSONS[0]).slug}`}
                >
                  {nextUp === null
                    ? "Read the course again"
                    : progress.completed === 0
                      ? "Start the first lesson"
                      : `Continue: ${nextUp.title}`}
                </Link>
              </Button>
            ) : (
              <Skeleton className="h-12 w-full rounded-full" />
            )}
            <p className="text-sm text-page-fg-70">
              {ready && nextUp !== null && progress.completed > 0
                ? `Lesson ${TRAINING_LESSONS.indexOf(nextUp) + 1} of ${progress.total}. Your marks are kept in this browser, so you can stop and come back.`
                : "Your marks are kept in this browser, so you can stop and come back."}
            </p>
          </div>
        </div>

        {/* The certificate is offered only when the course has actually been
            passed, and the wording distinguishes the two ways of not being
            there yet — lessons outstanding, or a mark below the bar — because
            they need different things done about them. Payment is deliberately
            NOT repeated here: `CourseAccessNotice` above already says it, and a
            second copy of that sentence is a second place to keep it true. */}
        {ready && finished ? (
          <div className="mt-7 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            {passing ? (
              <>
                <div className="flex flex-col gap-1">
                  <b className="flex items-center gap-2 text-page-fg">
                    <Check aria-hidden className="size-4 text-success-text" />
                    Every lesson complete, at {progress.mark}%.
                  </b>
                  {/* "You have done everything the course asks", NOT "your
                      certificate is ready". Those are different claims and the
                      second one is not this panel's to make: issuing also needs
                      an enrolment and a settled fee, which the notice at the top
                      of the page is already tracking. The earlier wording
                      promised a certificate to a learner whose fee was still
                      unreconciled, three inches under a banner saying so. */}
                  <p className="text-sm text-page-fg-70">
                    That clears the {TRAINING_PASS_MARK}% pass mark, and it is
                    everything the course asks of you. The certificate is issued
                    in your name and sent to the address you enrolled with.
                  </p>
                </div>
                <Button asChild size="lg" className="shrink-0">
                  <Link href="/training/certificate">Collect your certificate</Link>
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <b className="flex items-center gap-2 text-page-fg">
                  <Lock aria-hidden className="size-4 text-page-fg-70" />
                  Every lesson is complete, but the mark is {progress.mark}%.
                </b>
                <p className="max-w-read text-sm text-page-fg-70">
                  The certificate is issued at {TRAINING_PASS_MARK}% or better.
                  Open any lesson below and take its questions again — the best
                  mark for each lesson is the one that counts, so a retake can
                  only move you up.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section aria-label="Lessons" className="flex flex-col gap-3">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {TRAINING_LESSONS.map((lesson, index) => {
            const mark = state.scores[lesson.slug];
            const done = state.completed.includes(lesson.slug);
            const isNext = ready && nextUp?.slug === lesson.slug;

            return (
              <li key={lesson.slug}>
                <Link
                  href={`/training/learn/${lesson.slug}`}
                  className="group flex items-start gap-4 rounded-card border border-border bg-background p-5 transition-colors hover:bg-secondary"
                >
                  <span
                    aria-hidden
                    className={
                      done
                        ? "flex size-9 shrink-0 items-center justify-center rounded-full border border-success-text text-success-text"
                        : "flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-sm text-page-fg-70"
                    }
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>

                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-page-fg group-hover:underline">
                        {lesson.title}
                      </h3>
                      {isNext && progress.completed > 0 ? (
                        <Badge variant="accent">Next up</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-page-fg-70">
                      {firstSentence(lesson.body[0])}
                    </p>
                    <p className="text-2xs uppercase tracking-widest text-page-fg-70">
                      {lesson.minutes} min read · {lesson.quiz.length} questions
                      {ready && mark !== undefined ? (
                        <>
                          {" · "}
                          <span
                            className={
                              mark >= TRAINING_PASS_MARK
                                ? "text-success-text"
                                : "text-page-fg"
                            }
                          >
                            best mark {mark}%
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <ResetControl disabled={!ready} />
    </div>
  );
}

function Stat({
  label,
  value,
  ready,
  tone = "neutral",
}: {
  label: string;
  value: string;
  ready: boolean;
  /**
   * `good` is the only tone with a colour. A mark BELOW the pass bar is
   * deliberately left in the ordinary foreground: `--warning` is a light amber
   * that reaches about 2.3:1 on the page ground, so colouring "58%" with it
   * would have made the one number a learner most needs to read the hardest one
   * on the panel. The copy beside it carries that meaning instead.
   */
  tone?: "neutral" | "good";
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-2xs uppercase tracking-widest text-page-fg-70">
        {label}
      </dt>
      <dd className="m-0">
        {ready ? (
          <b
            className={
              tone === "good" ? "text-xl text-success-text" : "text-xl text-page-fg"
            }
          >
            {value}
          </b>
        ) : (
          <Skeleton className="h-6 w-20" />
        )}
      </dd>
    </div>
  );
}

/**
 * Clear the demo.
 *
 * `resetTraining()` was written for exactly this — a presenter running the
 * course twice in one afternoon — and without a control it can only be reached
 * from the console, which is not a thing to do in front of a room. Two clicks,
 * because it destroys the enrolment and the certificate as well as the marks
 * and a stray click during a demo is expensive; and no `window.confirm`,
 * because a browser dialog on a shared screen looks like an error.
 */
function ResetControl({ disabled }: { disabled: boolean }) {
  const [arming, setArming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
      <p className="text-sm text-page-fg-70">
        Presenting this more than once? Clearing the demo puts the course back
        to its first run: the enrolment, the payment, every mark and any
        certificate go with it.
      </p>
      <div className="flex items-center gap-2">
        {arming ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                resetTraining();
                setArming(false);
              }}
            >
              Yes, clear everything
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setArming(false)}>
              Keep my progress
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setArming(true)}
          >
            Clear the demo
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The opening sentence of a lesson, used as its one-line summary.
 *
 * Deliberately the same technique — and the same reasoning — as the curriculum
 * list on `/training`: a hand-written blurb per lesson is a second description
 * that drifts from the lesson the day either is edited. The two pages disagree
 * about nothing because neither of them writes anything.
 */
function firstSentence(paragraph: string): string {
  const end = paragraph.indexOf(". ");
  return end === -1 ? paragraph : `${paragraph.slice(0, end)}.`;
}
