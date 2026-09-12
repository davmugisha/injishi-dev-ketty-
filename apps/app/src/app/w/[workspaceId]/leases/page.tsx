import { AppShell } from "@/pms/components/app-shell";
import { Leases } from "@/pms/screens/leases";

export default function Page() {
  return (
    <AppShell title="Leases">
      <Leases />
    </AppShell>
  );
}
