import { AppShell } from "@/pms/components/app-shell";
import { Placements } from "@/pms/screens/broker/placements";

export default function Page() {
  return (
    <AppShell title="Placements">
      <Placements />
    </AppShell>
  );
}
