import { screens } from "@injishi/data";
import type {
  AcquisitionChannel,
  BusinessType,
  ProcessStep,
  RegistrationApplication,
  RegistrationDocument,
  RegistrationField,
  RegistrationStep,
  TinCheck,
} from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterView } from "@/features/shared/RegisterView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Register.pageTitle };

const TIN: TinCheck[] = ["matched", "verifying", "not_verified"];

/** Public: business registration (KYB), resumed from the saved draft. `?tin=` shows each TIN-check result. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ tin?: string }> }) {
  await requireScreen("Register");
  const [applications, types, steps, documents, channels, classFields, geoFields, fees, claim, after] =
    await Promise.all([
      getCollection<RegistrationApplication>("shared.registrationApplications"),
      getCollection<BusinessType>("shared.businessTypes"),
      getCollection<RegistrationStep>("shared.registrationSteps"),
      getCollection<RegistrationDocument>("shared.registrationDocuments"),
      getCollection<AcquisitionChannel>("shared.acquisitionChannels"),
      getCollection<RegistrationField>("shared.registrationClassFields"),
      getCollection<RegistrationField>("shared.registrationGeoFields"),
      getCollection<ProcessStep>("shared.registrationFeeSchedule"),
      getCollection<ProcessStep>("shared.registrationClaimSteps"),
      getCollection<ProcessStep>("shared.registrationAfterSteps"),
    ]);
  const application = applications[0];
  if (!application || !types.length || !steps.length) notFound();
  const { tin } = await searchParams;
  const tinCheck = TIN.find((t) => t === tin) ?? "matched";
  return (
    <RegisterView
      key={tinCheck}
      tin={tinCheck}
      data={{ application, types, steps, documents, channels, classFields, geoFields, fees, claim, after }}
    />
  );
}
