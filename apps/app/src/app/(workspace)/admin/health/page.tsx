import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { SystemHealthView } from "@/features/admin/health/health-views";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { systemHealth } from "@/server/admin/health";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminHealth.pageTitle };

/** System health (2026-11-09, real records), read from the admin API when the page opens. */
export default async function AdminHealthPage() {
  await requirePersona("AdminHealth");
  try {
    return <SystemHealthView health={await systemHealth()} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
