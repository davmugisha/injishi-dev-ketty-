import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · loans and salary advances (058-payroll AC-PY8). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="loans" />
    </AppShell>
  );
}
