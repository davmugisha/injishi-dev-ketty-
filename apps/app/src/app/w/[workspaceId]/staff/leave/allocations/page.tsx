import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Leave · extra and compensatory days (ADR-058, 058-leave AC-LV13). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="leave" section="allocations" />
    </AppShell>
  );
}
