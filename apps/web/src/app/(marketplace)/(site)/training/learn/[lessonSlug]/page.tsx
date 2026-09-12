import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@injishi/ui";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import {
  TRAINING_COURSE,
  TRAINING_LESSONS,
  findTrainingLesson,
  nextTrainingLesson,
} from "@/data/training";
import { CourseAccessNotice } from "../course-access-notice";
import { LessonQuiz } from "./lesson-quiz";

const MODULE = TRAINING_COURSE.modules[0];

/**
 * Seven lessons, all authored in `data/training.ts`, so every one of them is
 * known at build time and none of them needs a request to render. The same
 * pattern as `property/[slug]`, which pre-renders all thirty properties.
 */
export function generateStaticParams() {
  return TRAINING_LESSONS.map((lesson) => ({ lessonSlug: lesson.slug }));
}

/**
 * `params` is a Promise on Next 15 and has to be awaited even here, where the
 * value is a single string.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonSlug: string }>;
}): Promise<Metadata> {
  const { lessonSlug } = await params;
  const lesson = findTrainingLesson(lessonSlug);
  if (!lesson) return { title: "Lesson not found" };

  return {
    title: lesson.title,
    // The lesson's own opening sentence rather than a description written for
    // the tag: a hand-written one is a second summary that drifts from the
    // lesson the day either is edited.
    description: firstSentence(lesson.body[0]),
  };
}

export default async function TrainingLessonPage({
  params,
}: {
  params: Promise<{ lessonSlug: string }>;
}) {
  const { lessonSlug } = await params;
  const lesson = findTrainingLesson(lessonSlug);
  if (!lesson) notFound();

  const index = TRAINING_LESSONS.findIndex((entry) => entry.slug === lesson.slug);
  const previous = index > 0 ? TRAINING_LESSONS[index - 1] : null;
  const next = nextTrainingLesson(lesson.slug);

  return (
    <div className="page-y">
      {/* The whole lesson is one CENTRED column at `max-w-read` — 42rem, the
          named reading measure — rather than the full 1320px `container`. Two
          decisions in one line, and both were tested on screen. A 1320px line
          of this body copy is about 180 characters and the eye loses the start
          of the next line past roughly 90, so the measure has to win over
          filling the column. And once it is that narrow it has to be centred:
          left-aligned, a 672px column on a 1440px screen reads as a page whose
          right half failed to load. */}
      <div className="container">
        <div className="mx-auto flex max-w-read flex-col gap-10">
          <header className="flex flex-col gap-4">
            <Breadcrumbs
              trail={[
                { label: "Home", href: "/" },
                { label: "Training", href: "/training" },
                { label: MODULE.title, href: "/training/learn" },
                { label: lesson.title },
              ]}
            />

            <p className="text-2xs uppercase tracking-widest text-page-fg-70">
              Lesson {index + 1} of {TRAINING_LESSONS.length} ·{" "}
              {lesson.minutes} min read · {lesson.quiz.length} marked questions
            </p>

            <h1 className="text-2xl font-bold leading-[1.2] text-page-fg lg:text-display-sm">
              {lesson.title}
            </h1>
          </header>

          <CourseAccessNotice />

          {/* The prose. `gap-6` between paragraphs rather than a tighter step:
              these are four to six long paragraphs and the paragraph break is the
              only structure the lesson has, so it has to be visible at a glance
              or the whole lesson reads as one block. The first paragraph is set a
              step larger and in the full foreground — it is the lesson's thesis
              in every one of the seven, and it earns the emphasis. */}
          <article className="flex flex-col gap-6">
            {lesson.body.map((paragraph, position) => (
              <p
                key={paragraph.slice(0, 48)}
                className={
                  position === 0
                    ? "text-lg leading-relaxed text-page-fg md:text-xl"
                    : "text-base leading-relaxed text-page-fg-70 md:text-lg"
                }
              >
                {paragraph}
              </p>
            ))}
          </article>

          <LessonQuiz
            lessonSlug={lesson.slug}
            lessonTitle={lesson.title}
            questions={lesson.quiz}
            nextLesson={next ? { slug: next.slug, title: next.title } : null}
          />

          <nav
            aria-label="Lesson navigation"
            className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"
          >
            {previous ? (
              <Button asChild variant="outline">
                <Link href={`/training/learn/${previous.slug}`}>
                  <ArrowLeft aria-hidden className="size-4" />
                  Previous: {previous.title}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/training/learn">
                  <ArrowLeft aria-hidden className="size-4" />
                  Back to the module
                </Link>
              </Button>
            )}

            {next ? (
              <Button asChild>
                <Link href={`/training/learn/${next.slug}`}>
                  Next: {next.title}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/training/learn">
                  Finish at the module overview
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
            )}
          </nav>

          {previous ? (
            <div>
              <Button asChild variant="link" size="sm">
                <Link href="/training/learn">All {TRAINING_LESSONS.length} lessons</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The lesson's opening sentence. Same helper, same reasoning, as `/training`. */
function firstSentence(paragraph: string): string {
  const end = paragraph.indexOf(". ");
  return end === -1 ? paragraph : `${paragraph.slice(0, end)}.`;
}
