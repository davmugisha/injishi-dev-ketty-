import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the announcements lens (ADR-058, 058-people-file). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="announcements" />
    </AppShell>
  );
}
