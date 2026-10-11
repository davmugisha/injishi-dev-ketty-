import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · what needs somebody today, across files, time, leave and pay (ADR-058). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="overview" />
    </AppShell>
  );
}
