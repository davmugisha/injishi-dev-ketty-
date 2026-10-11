import { AppShell } from "@/pms/components/app-shell";
import { EmployeeFile } from "@/pms/screens/staff/employee-file";

/**
 * One staff file, its Profile tab (ADR-058, 058-people-file AC-PF13). The
 * static lens segments beside it (`roster`, `attendance`, `leave`, `payroll`,
 * `org-chart`, `documents`, `discipline`, `policies`, `announcements`,
 * `configuration`) win over this dynamic one, so only an employee id lands
 * here. Each other tab is a segment under it.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <AppShell title="Staff file">
      <EmployeeFile employeeId={employeeId} lens="profile" />
    </AppShell>
  );
}
