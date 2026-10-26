import { screens } from "@injishi/data";
import type {
  Adapter,
  DeadLetter,
  ErrorGroup,
  HealthPanel,
  Incident,
  Pipeline,
  QueueStat,
  SchedulerRun,
  Sweep,
} from "@injishi/data/fixtures/admin";
import type { Metadata } from "next";
import { AdminHealthView } from "@/features/admin/AdminHealthView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AdminHealth.pageTitle };

export default async function AdminHealthPage() {
  await requirePersona("AdminHealth");
  const [incidents, adapters, deadLetters, queues, schedulers, sweeps, panels, errors, pipelines] = await Promise.all([
    getCollection<Incident>("admin.incidents"),
    getCollection<Adapter>("admin.adapters"),
    getCollection<DeadLetter>("admin.deadLetters"),
    getCollection<QueueStat>("admin.queues"),
    getCollection<SchedulerRun>("admin.schedulers"),
    getCollection<Sweep>("admin.sweeps"),
    getCollection<HealthPanel>("admin.healthPanels"),
    getCollection<ErrorGroup>("admin.errorGroups"),
    getCollection<Pipeline>("admin.pipelines"),
  ]);
  return (
    <AdminHealthView
      data={{ incidents, adapters, deadLetters, queues, schedulers, sweeps, panels, errors, pipelines }}
    />
  );
}
