import { screens } from "@injishi/data";
import type {
  FindingOption,
  FlaggedAnswer,
  RetentionSetting,
  TenantLimitOption,
  UsageAlert,
  UsageMonth,
} from "@injishi/data/fixtures/platformops";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AssistantUsageView } from "@/features/platformops/AssistantUsageView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AssistantUsage.pageTitle };

export default async function AssistantUsagePage() {
  await requirePersona("AssistantUsage");
  const [months, flags, findings, alerts, retention, limits] = await Promise.all([
    getCollection<UsageMonth>("platformops.usageMonths"),
    getCollection<FlaggedAnswer>("platformops.flaggedAnswers"),
    getCollection<FindingOption>("platformops.findings"),
    getCollection<UsageAlert>("platformops.usageAlerts"),
    getCollection<RetentionSetting>("platformops.retention"),
    getCollection<TenantLimitOption>("platformops.tenantLimits"),
  ]);
  return <AssistantUsageView data={{ months, flags, findings, alerts, retention, limits }} />;
}
