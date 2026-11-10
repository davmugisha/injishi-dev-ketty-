"use client";

import type { RentalsSetupView } from "@injishi/contracts";
import { PageContent } from "@injishi/ui";
import { useTranslations } from "next-intl";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { SetupChecklist } from "./SetupChecklist";

/** Setup: the first-run steps, each with its next action. It sits under Home's To do tab. */
export function SetupView({ setup }: { setup: RentalsSetupView }) {
  const t = useTranslations("rentalsSetup");
  return (
    <PageContent>
      <AreaHeader />
      <SetupChecklist setup={setup} title={t("title")} className="max-w-3xl" />
    </PageContent>
  );
}
