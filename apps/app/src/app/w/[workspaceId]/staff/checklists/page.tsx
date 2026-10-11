import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · joining and leaving checklists (ADR-058). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="checklists" />
    </AppShell>
  );
}
