import { AppShell } from "@/pms/components/app-shell";
import { Units } from "@/pms/screens/landlord/units";

export default function Page() {
  return (
    <AppShell title="Units & rents">
      <Units />
    </AppShell>
  );
}
