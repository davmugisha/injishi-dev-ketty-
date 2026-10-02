import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the payroll lens (ADR-058): one run per month. */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" />
    </AppShell>
  );
}
