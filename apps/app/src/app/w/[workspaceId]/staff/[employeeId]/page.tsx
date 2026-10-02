import { AppShell } from "@/pms/components/app-shell";
import { EmployeeFile } from "@/pms/screens/staff/employee-file";

/**
 * One staff file (ADR-058). The static lens segments beside it (`roster`,
 * `attendance`, `leave`, `payroll`) win over this dynamic one, so only an
 * employee id lands here.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <AppShell title="Staff file">
      <EmployeeFile employeeId={employeeId} />
    </AppShell>
  );
}
