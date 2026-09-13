"use client";

import type { AdminTrainingCourse } from "@injishi/contracts";
import { Badge, Button, Checkbox, Input, Label, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCourse,
  editCourse,
  setCoursePublished,
} from "@/lib/actions/training";
import { useAdminUi } from "@/lib/store";

import { OutcomeNotice, type Notice } from "../outcome-notice";

/**
 * The course list and its writes (ADR-049 AC-30).
 *
 * `canManage` is `training.course.manage`, resolved on the server. Without it
 * the list is read-only.
 *
 * THE SLUG IS ASKED FOR ONCE, at creation, and never offered for editing: the
 * API takes no slug on an edit, because it is the public handle a printed link
 * points at and a corrected title must not move it.
 *
 * "BUMP THE VERSION" IS A DELIBERATE TICK, never implied by saving. The version
 * is printed on every certificate issued from then on and means "the syllabus
 * they sat through", so the form asks which kind of edit this is instead of
 * guessing: a typo fix leaves it unticked.
 *
 * UNPUBLISHING CANCELS NOTHING. It takes the course and every session under it
 * off the public page; registrations stand. The button says "Unpublish", and
 * the answer says the rest.
 */
export function CourseDirectory({
  courses,
  total,
  canManage,
}: {
  courses: AdminTrainingCourse[];
  total: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useAdminUi((state) => state.toast);
  const [form, setForm] = useState<"closed" | "new" | AdminTrainingCourse>("closed");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  const published = courses.filter((course) => course.isPublished).length;
  const counts = `${courses.length.toLocaleString("en-RW")} loaded, ${published.toLocaleString(
    "en-RW",
  )} published${total > courses.length ? `, ${total.toLocaleString("en-RW")} in total` : ""}`;

  function report(message: string, tone: Notice["tone"]) {
    setNotice({ message, tone });
    toast(message, tone);
  }

  function togglePublished(course: AdminTrainingCourse) {
    startTransition(async () => {
      const out = await setCoursePublished(course.id, !course.isPublished);
      report(out.message, out.tone);
      if (out.ok) router.refresh();
    });
  }

  return (
    <section className="mt-6" aria-label="Training courses">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{counts}</p>
        {canManage && form === "closed" ? (
          <Button size="sm" onClick={() => setForm("new")}>
            Create a course
          </Button>
        ) : null}
      </div>

      <OutcomeNotice notice={notice} />

      {canManage && form !== "closed" ? (
        <CourseForm
          key={form === "new" ? "new" : form.id}
          course={form === "new" ? null : form}
          onCancel={() => setForm("closed")}
          onDone={(message, tone, ok) => {
            report(message, tone);
            if (ok) {
              setForm("closed");
              router.refresh();
            }
          }}
        />
      ) : null}

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No course exists yet. A session can&apos;t be drafted until one does.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Course</Th>
                <Th>Version</Th>
                <Th>Sessions</Th>
                <Th>Standing</Th>
                {canManage ? <Th>Manage</Th> : null}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-border" data-course={course.id}>
                  <Td>
                    <span className="font-medium">{course.title}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      /{course.slug}
                    </span>
                    <span className="mt-1 block max-w-read text-xs text-muted-foreground">
                      {course.summary}
                    </span>
                  </Td>
                  <Td>
                    <span className="money">v{course.version}</span>
                  </Td>
                  <Td>
                    <span className="money">
                      {course.sessionCount.toLocaleString("en-RW")}
                    </span>
                  </Td>
                  <Td>
                    {course.isPublished ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="subtle">Draft</Badge>
                    )}
                  </Td>
                  {canManage ? (
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setForm(course)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={course.isPublished ? "ghost" : "primary"}
                          onClick={() => togglePublished(course)}
                          disabled={pending}
                        >
                          {course.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Create a course (slug, title, summary) or edit one (title, summary, bump). */
function CourseForm({
  course,
  onCancel,
  onDone,
}: {
  course: AdminTrainingCourse | null;
  onCancel: () => void;
  onDone: (message: string, tone: Notice["tone"], ok: boolean) => void;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState(course?.title ?? "");
  const [summary, setSummary] = useState(course?.summary ?? "");
  const [bumpVersion, setBumpVersion] = useState(false);
  const [pending, startTransition] = useTransition();
  const idPrefix = course ? `course-${course.id}` : "course-new";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const out = course
        ? await editCourse(course.id, { title, summary, bumpVersion })
        : await createCourse({ slug, title, summary });
      onDone(out.message, out.tone, out.ok);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label={course ? `Edit ${course.title}` : "Create a course"}
      className="mt-4 rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">
        {course ? `Edit ${course.title}` : "Create a course"}
      </p>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        {course
          ? `Currently version ${course.version}. Certificates already issued keep the title and version they were issued with.`
          : "It starts as a draft at version 1, off the public page until it is published."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {course ? null : (
          <div>
            <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
            <Input
              id={`${idPrefix}-slug`}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="hosting-basics"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lower case words joined by single hyphens"
              required
              minLength={2}
              maxLength={80}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The public address. It can&apos;t be changed later.
            </p>
          </div>
        )}
        <div className={course ? "sm:col-span-2" : undefined}>
          <Label htmlFor={`${idPrefix}-title`}>Title</Label>
          <Input
            id={`${idPrefix}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${idPrefix}-summary`}>Summary</Label>
          <Textarea
            id={`${idPrefix}-summary`}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            required
            minLength={2}
            maxLength={2000}
          />
        </div>
        {course ? (
          <div className="sm:col-span-2">
            <Checkbox isSelected={bumpVersion} onChange={setBumpVersion}>
              <span className="text-sm">
                Bump the version to {course.version + 1}: the syllabus itself
                changed, not just its wording
              </span>
            </Checkbox>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm" pending={pending}>
          {pending ? "Saving…" : course ? "Save the course" : "Create the course"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}
