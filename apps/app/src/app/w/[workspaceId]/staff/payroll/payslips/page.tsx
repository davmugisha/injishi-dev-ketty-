import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · every payslip across runs, with its paid status (058-payroll AC-PY10, AC-PY11). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="payslips" />
    </AppShell>
  );
}
