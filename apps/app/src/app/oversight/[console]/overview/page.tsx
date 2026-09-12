import { ConsoleShell } from "@/pms/oversight/components/console-shell";
import { DistrictOverview } from "@/pms/oversight/screens/district-overview";

export default function Page() {
  return (
    <ConsoleShell title="District overview">
      <DistrictOverview />
    </ConsoleShell>
  );
}
