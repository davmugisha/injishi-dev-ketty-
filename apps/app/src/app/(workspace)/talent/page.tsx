import { screens } from "@injishi/data";
import type {
  Candidate,
  Interview,
  OnboardingTask,
  ReviewCycleMetric,
  ReviewDepartment,
  Vacancy,
} from "@injishi/data/fixtures/payroll";
import type { Metadata } from "next";
import { TalentView } from "@/features/payroll/TalentView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Talent.pageTitle };

export default async function TalentPage() {
  await requirePersona("Talent");
  const [vacancies, candidates, interviews, onboarding, cycle, departments] = await Promise.all([
    getCollection<Vacancy>("payroll.vacancies"),
    getCollection<Candidate>("payroll.candidates"),
    getCollection<Interview>("payroll.interviews"),
    getCollection<OnboardingTask>("payroll.onboardingTasks"),
    getCollection<ReviewCycleMetric>("payroll.reviewCycle"),
    getCollection<ReviewDepartment>("payroll.reviewDepartments"),
  ]);
  return <TalentView data={{ vacancies, candidates, interviews, onboarding, cycle, departments }} />;
}
