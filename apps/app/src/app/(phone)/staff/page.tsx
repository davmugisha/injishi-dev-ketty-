import { screens } from "@injishi/data";
import type { HousekeepingDone, HousekeepingTask } from "@injishi/data/fixtures/platform";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { StaffTodayView } from "@/features/platform/StaffTodayView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.StaffToday.pageTitle };

export default async function StaffTodayPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  const persona = await requirePersona("StaffToday");
  const [tasks, done] = await Promise.all([
    getCollection<HousekeepingTask>("platform.housekeepingTasks"),
    getCollection<HousekeepingDone>("platform.housekeepingDone"),
  ]);
  const { offline } = await searchParams;
  return <StaffTodayView persona={persona} tasks={tasks} done={done} offline={offline === "1"} />;
}
