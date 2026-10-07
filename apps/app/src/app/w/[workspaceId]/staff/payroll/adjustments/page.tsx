import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · corrections to months already paid (058-payroll AC-PY16). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="adjustments" />
    </AppShell>
  );
}
