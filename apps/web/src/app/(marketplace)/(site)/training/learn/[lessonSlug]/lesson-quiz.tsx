"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";
import { TRAINING_PASS_MARK, type TrainingQuestion } from "@/data/training";
import { completeLesson, recordQuizScore } from "@/lib/training-store";
import { useTrainingState } from "../use-training-state";

/** A, B, C, D — the label a learner reads back to you over the phone. */
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * The marked question set at the end of a lesson.
 *
 * THE ONE DESIGN DECISION HERE IS THAT IT MARKS IMMEDIATELY, question by
 * question, and shows the `why` on every answer — right or wrong. The obvious
 * alternative, and the one an exam would use, is to collect all the answers and
 * mark them at the end. It was rejected: this is teaching, not testing, and the
 * moment a learner is most able to take in why a listing is a promise is the
 * second after they have just answered that it is not. Deferring the
 * explanation to a results screen makes them re-read four questions to find out
 * which one they got wrong, and most people do not.
 *
 * The explanation is shown on a CORRECT answer too, for the reason a marked
 * paper cannot: a four-option question is right one time in four by accident,
 * and a learner who guessed has no way to tell their guess from their
 * knowledge unless somebody says why.
 *
 * An answered question does not accept a second answer — the option buttons go
 * `disabled`, and the state is keyed by question slug so it cannot be talked
 * out of that. Retaking is done deliberately, for the whole set, which is what
 * `recordQuizScore`'s keep-the-best rule is built around.
 *
 * NOTHING IS WRITTEN DURING A RENDER. `recordQuizScore` and `completeLesson`
 * are called from the click handler that answers the last question, so the
 * server render and the first client render agree on an empty answer sheet and
 * the marks arrive from the store's own effect.
 */
export function LessonQuiz({
  lessonSlug,
  lessonTitle,
  questions,
  nextLesson,
}: {
  lessonSlug: string;
  lessonTitle: string;
  questions: TrainingQuestion[];
  nextLesson: { slug: string; title: string } | null;
}) {
  const { state, ready, refresh } = useTrainingState();
  /** Question slug to the option index this learner picked, this sitting. */
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const correctCount = questions.filter(
    (question) => answers[question.slug] === question.correct,
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);

  const bestMark = state.scores[lessonSlug];
  const alreadyDone = state.completed.includes(lessonSlug);

  function choose(question: TrainingQuestion, option: number) {
    if (answers[question.slug] !== undefined) return;

    const next = { ...answers, [question.slug]: option };
    setAnswers(next);

    if (Object.keys(next).length !== questions.length) return;

    const marked = questions.filter(
      (entry) => next[entry.slug] === entry.correct,
    ).length;
    recordQuizScore(lessonSlug, (marked / questions.length) * 100);
    completeLesson(lessonSlug);
    // Belt and braces for a browser that refuses storage; see `useTrainingState`.
    refresh();
  }

  return (
    <section aria-label={`Questions on ${lessonTitle}`} className="flex flex-col gap-6">
      <SectionHeading
        lead="Check "
        emphasis="yourself"
        lede={`${questions.length} marked questions on this lesson. Every answer is explained, so a question you guessed does not stay guessed.`}
      />

      {ready && alreadyDone && answeredCount === 0 ? (
        <p className="flex items-center gap-2 rounded-card border border-success-text bg-success/10 p-4 text-sm text-page-fg">
          <Check aria-hidden className="size-4 shrink-0 text-success-text" />
          You have finished this lesson already — your best mark is {bestMark}%.
          Taking the questions again can only raise it.
        </p>
      ) : null}

      <ol className="m-0 flex list-none flex-col gap-8 p-0">
        {questions.map((question, position) => {
          const chosen = answers[question.slug];
          const answered = chosen !== undefined;
          const right = chosen === question.correct;
          const promptId = `question-${question.slug}`;

          return (
            <li key={question.slug} className="flex flex-col gap-3">
              <p className="text-2xs uppercase tracking-widest text-page-fg-70">
                Question {position + 1} of {questions.length}
              </p>
              <p id={promptId} className="text-base font-bold text-page-fg md:text-lg">
                {question.prompt}
              </p>

              <div
                role="group"
                aria-labelledby={promptId}
                className="flex flex-col gap-2"
              >
                {question.options.map((option, index) => {
                  const isCorrect = index === question.correct;
                  const picked = chosen === index;

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={answered}
                      aria-pressed={picked}
                      onClick={() => choose(question, index)}
                      className={optionClass(answered, isCorrect, picked)}
                    >
                      <span
                        aria-hidden
                        className={markerClass(answered, isCorrect, picked)}
                      >
                        {answered && isCorrect ? (
                          <Check className="size-4" />
                        ) : answered && picked ? (
                          <X className="size-4" />
                        ) : (
                          LETTERS[index]
                        )}
                      </span>
                      <span className="pt-1">{option}</span>
                    </button>
                  );
                })}
              </div>

              {answered ? (
                <div className="flex flex-col gap-1.5 rounded-card border border-border bg-secondary p-4">
                  <b
                    className={
                      right
                        ? "text-sm text-success-text"
                        : "text-sm text-danger"
                    }
                  >
                    {right
                      ? "Correct."
                      : `Not quite — the answer is “${question.options[question.correct]}”.`}
                  </b>
                  <p className="text-sm text-page-fg-70">{question.why}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {allAnswered ? (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-secondary p-6">
          <div className="flex flex-col gap-1">
            <b className="text-xl text-page-fg">
              {correctCount} of {questions.length} right — {score}% on this
              lesson.
            </b>
            <p className="max-w-read text-sm text-page-fg-70">
              {score >= TRAINING_PASS_MARK
                ? `That is above the ${TRAINING_PASS_MARK}% the course asks for. The lesson is marked complete and the mark is kept in this browser.`
                : `The course asks for ${TRAINING_PASS_MARK}% across every lesson. Re-read the paragraphs behind the ones you missed and take the set again — only your best mark for a lesson counts, so a second attempt cannot cost you anything.`}
              {ready && bestMark !== undefined && bestMark > score
                ? ` Your best mark on this lesson is still ${bestMark}%, and that is the one the course is using.`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setAnswers({})}>
              Take these questions again
            </Button>
            {nextLesson ? (
              <Button asChild>
                <Link href={`/training/learn/${nextLesson.slug}`}>
                  Next: {nextLesson.title}
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/training/learn">Back to the module</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-page-fg-70">
          {answeredCount === 0
            ? "Pick an answer and it is marked straight away."
            : `${questions.length - answeredCount} question${
                questions.length - answeredCount === 1 ? "" : "s"
              } left in this set.`}
        </p>
      )}
    </section>
  );
}

/**
 * The option's own styling, as one function rather than four ternaries inline.
 *
 * Colour is never the only signal: the correct option also gains a tick and the
 * wrong pick a cross. Red and green at 4.5:1 still read as the same grey to a
 * red-green colour-blind learner, and this is a marked answer — the one place
 * on the screen where getting the status wrong changes what somebody believes
 * they know.
 */
function optionClass(answered: boolean, isCorrect: boolean, picked: boolean) {
  const base =
    "flex w-full items-start gap-3 rounded-card border p-4 text-left text-sm transition-colors md:text-base";

  if (!answered) {
    return `${base} border-border bg-background text-page-fg hover:border-accent-brand hover:bg-secondary`;
  }
  if (isCorrect) return `${base} border-success-text bg-success/10 text-page-fg`;
  if (picked) return `${base} border-danger bg-danger/10 text-page-fg`;
  return `${base} border-border bg-background text-page-fg-70`;
}

function markerClass(answered: boolean, isCorrect: boolean, picked: boolean) {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-full border text-2xs font-bold";

  if (answered && isCorrect) {
    return `${base} border-success-text text-success-text`;
  }
  if (answered && picked) return `${base} border-danger text-danger`;
  return `${base} border-border text-page-fg-70`;
}
