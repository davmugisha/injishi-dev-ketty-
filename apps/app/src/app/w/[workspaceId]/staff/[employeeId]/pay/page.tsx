import { AppShell } from "@/pms/components/app-shell";
import { EmployeeFile } from "@/pms/screens/staff/employee-file";

/** One staff file · Pay accounts (058-people-file AC-PF13). */
export default async function Page({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <AppShell title="Staff file">
      <EmployeeFile employeeId={employeeId} lens="pay" />
    </AppShell>
  );
}
