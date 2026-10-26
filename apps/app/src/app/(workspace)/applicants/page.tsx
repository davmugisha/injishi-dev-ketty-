import { screens } from "@injishi/data";
import type { Applicant, RegistrationInvitation, ScreeningCheck, Vacancy } from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { ApplicantsView } from "@/features/residence/ApplicantsView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { residenceBuilding } from "@/server/sources/residence";

export const metadata: Metadata = { title: screens.Applicants.pageTitle };

export default async function ApplicantsPage() {
  const persona = await requirePersona("Applicants");
  const [applicants, checks, invitations, vacancies] = await Promise.all([
    getCollection<Applicant>("residence.applicants"),
    getCollection<ScreeningCheck>("residence.screeningChecks"),
    getCollection<RegistrationInvitation>("residence.invitations"),
    getCollection<Vacancy>("residence.vacancies"),
  ]);
  const building = residenceBuilding(await requestContext());
  // The screening list is product configuration; its sample wording names the sample landlord, so it names none.
  const screening = checks.map((c) => ({
    ...c,
    label: c.label.replace(/ with Amahoro Residences$/, " with this business"),
  }));
  return (
    <ApplicantsView
      persona={persona}
      data={{ applicants, checks: screening, invitations, vacancies }}
      building={building}
    />
  );
}
