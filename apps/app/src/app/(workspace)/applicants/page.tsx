import { screens } from "@injishi/data";
import type { Applicant, RegistrationInvitation, ScreeningCheck, Vacancy } from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { ApplicantsView } from "@/features/residence/ApplicantsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Applicants.pageTitle };

export default async function ApplicantsPage() {
  const persona = await requirePersona("Applicants");
  const [applicants, checks, invitations, vacancies] = await Promise.all([
    getCollection<Applicant>("residence.applicants"),
    getCollection<ScreeningCheck>("residence.screeningChecks"),
    getCollection<RegistrationInvitation>("residence.invitations"),
    getCollection<Vacancy>("residence.vacancies"),
  ]);
  return <ApplicantsView persona={persona} data={{ applicants, checks, invitations, vacancies }} />;
}
