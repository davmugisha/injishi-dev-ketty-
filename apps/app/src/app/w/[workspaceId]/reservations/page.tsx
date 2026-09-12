import { AppShell } from "@/pms/components/app-shell";
import { Reservations } from "@/pms/screens/reservations";

export default function Page() {
  return (
    <AppShell title="Reservations">
      <Reservations />
    </AppShell>
  );
}
