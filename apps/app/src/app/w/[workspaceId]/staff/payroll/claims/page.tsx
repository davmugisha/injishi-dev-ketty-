import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · reimbursements and leave paid out (058-payroll AC-PY9). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="claims" />
    </AppShell>
  );
}
