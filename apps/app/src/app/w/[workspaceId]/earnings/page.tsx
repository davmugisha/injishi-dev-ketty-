import { AppShell } from "@/pms/components/app-shell";
import { Earnings } from "@/pms/screens/broker/earnings";

export default function Page() {
  return (
    <AppShell title="Earnings">
      <Earnings />
    </AppShell>
  );
}
