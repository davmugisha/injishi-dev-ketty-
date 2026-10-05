import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · Payroll · the automatic draft day and the RSSB employer number (058-payroll AC-PY14). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="payroll" section="settings" />
    </AppShell>
  );
}
