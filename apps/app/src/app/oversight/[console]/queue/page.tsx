import { ConsoleShell } from "@/pms/oversight/components/console-shell";
import { OfficerQueue } from "@/pms/oversight/screens/officer-queue";

export default function Page() {
  return (
    <ConsoleShell title="Queue">
      <OfficerQueue />
    </ConsoleShell>
  );
}
