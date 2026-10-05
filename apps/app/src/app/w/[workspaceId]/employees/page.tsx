import { AppShell } from "@/pms/components/app-shell";
import { Employees } from "@/pms/screens/employees";

export default function Page() {
  return (
    <AppShell title="Employees">
      <Employees />
    </AppShell>
  );
}