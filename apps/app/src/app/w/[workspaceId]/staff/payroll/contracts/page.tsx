import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · every contract and the pay terms it carries (058-payroll AC-PY15). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="contracts" />
    </AppShell>
  );
}
