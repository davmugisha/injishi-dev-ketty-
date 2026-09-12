import { AppShell } from "@/pms/components/app-shell";
import { MoveOuts } from "@/pms/screens/landlord/move-outs";

export default function Page() {
  return (
    <AppShell title="Move-outs & deposits">
      <MoveOuts />
    </AppShell>
  );
}
