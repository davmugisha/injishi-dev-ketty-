import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · allowances, deductions and pay structures (058-payroll AC-PY5). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="components" />
    </AppShell>
  );
}
