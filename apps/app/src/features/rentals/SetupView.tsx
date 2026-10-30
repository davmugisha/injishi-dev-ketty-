"use client";

import type { RentalsSetupView } from "@injishi/contracts";
import { PageContent } from "@injishi/ui";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { SetupChecklist } from "./SetupChecklist";

/** Setup: the first-run steps, each with its next action. It sits under Home's To do tab. */
export function SetupView({ setup }: { setup: RentalsSetupView }) {
  return (
    <PageContent>
      <AreaHeader />
      <SetupChecklist setup={setup} title="Setup" className="max-w-3xl" />
    </PageContent>
  );
}
