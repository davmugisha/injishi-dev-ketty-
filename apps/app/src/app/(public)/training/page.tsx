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
  const learner = learners[0];
  return (
    <TrainingView
      links={demoLinks(persona, learner ? [learner.home, "Account"] : ["FrontDeskToday", "Account"])}
      data={{ courses, sessions, learners, enrolments, certificates }}
    />
  );
}
