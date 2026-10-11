import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the leave lens (ADR-058): the queue of requests, with the dashboard above it (058-leave AC-LV13). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="leave" />
    </AppShell>
  );
}
