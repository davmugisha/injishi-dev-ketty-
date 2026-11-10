import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { AssistantUsageReportView } from "@/features/admin/health/health-views";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { assistantUsage } from "@/server/admin/health";
import { one, type Search } from "@/server/admin/list";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AssistantUsage.pageTitle };

/** The assistant's usage for one month (`?month=YYYY-MM`, this month by default), from the admin API. */
export default async function AssistantUsagePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AssistantUsage");
  const month = one((await searchParams).month);
  try {
    return (
      <AssistantUsageReportView
        report={await assistantUsage(month && /^\d{4}-\d{2}$/.test(month) ? month : undefined)}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
