import { AppShell } from "@/pms/components/app-shell";
import { EmployeeFile } from "@/pms/screens/staff/employee-file";

/** One staff file · Leave (058-people-file AC-PF13). */
export default async function Page({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <AppShell title="Staff file">
      <EmployeeFile employeeId={employeeId} lens="leave" />
    </AppShell>
  );
}
