import { ConsoleShell } from "@/pms/oversight/components/console-shell";
import { DecisionLog } from "@/pms/oversight/screens/decision-log";

export default function Page() {
  return (
    <ConsoleShell title="Decision log">
      <DecisionLog />
    </ConsoleShell>
  );
}
