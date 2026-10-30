import { screens } from "@injishi/data";
import type { Certificate, Course, CourseSession, Enrolment, Learner } from "@injishi/data/fixtures/public";
import type { Metadata } from "next";
import { demoLinks } from "@/features/public/links";
import { TrainingView } from "@/features/public/TrainingView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Training.pageTitle };

export default async function TrainingPage() {
  const persona = await requireScreen("Training");
  const [courses, sessions, learners, enrolments, certificates] = await Promise.all([
    getCollection<Course>("public.courses"),
    getCollection<CourseSession>("public.courseSessions"),
    getCollection<Learner>("public.learners"),
    getCollection<Enrolment>("public.enrolments"),
    getCollection<Certificate>("public.certificates"),
  ]);
  // The visitor is the person signed in, never the sample learner: the view shows that learner's record only to them.
  const visitor = persona
    ? { personaId: persona.id, name: persona.name, initials: persona.initials, home: persona.home }
    : null;
  return (
    <TrainingView
      links={demoLinks(persona, persona ? [persona.home, "Account"] : ["Account"])}
      data={{ courses, sessions, learners, enrolments, certificates }}
      visitor={visitor}
    />
  );
}
