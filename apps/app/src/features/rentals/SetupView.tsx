"use client";

import { RENTALS_SETUP_STEP_LABEL, type RentalsSetupStep, type RentalsSetupView } from "@injishi/contracts";
import { PageContent, PageHeader, SectionCard } from "@injishi/ui";
import { SetupChecklist } from "./SetupChecklist";

const WHY: Record<RentalsSetupStep, string> = {
  location: "Contracts name it, and guest reports reach the village leader.",
  units: "Each lease is for one unit.",
  getting_paid: "Rent paid through Injishi is sent here.",
  lease_defaults: "Every new lease starts from these.",
  signatory: "The name on every contract you sign.",
};

/** Setup: the steps on the left, what each is for on the right. */
export function SetupView({ setup }: { setup: RentalsSetupView }) {
  return (
    <PageContent>
      <PageHeader
        title="Setup"
        description={
          setup.complete ? "Your business is ready for tenants." : "A few steps before your first tenant signs."
        }
      />
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <SetupChecklist setup={setup} title="Steps" className="lg:col-span-2" />
        <SectionCard title="Why each step">
          <ul className="flex flex-col gap-3">
            {setup.steps.map((s) => (
              <li key={s.step} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{RENTALS_SETUP_STEP_LABEL[s.step]}</span>
                <span className="text-sm text-muted">{WHY[s.step]}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </PageContent>
  );
}
