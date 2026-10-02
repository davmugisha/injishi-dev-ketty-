import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the attendance lens (ADR-058): today's sheet, worked at the desk. */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="attendance" />
    </AppShell>
  );
}
