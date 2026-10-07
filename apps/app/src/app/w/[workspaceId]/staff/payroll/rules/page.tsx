import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · the national rules each run reads, read only (058-payroll AC-PY15). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="rules" />
    </AppShell>
  );
}
