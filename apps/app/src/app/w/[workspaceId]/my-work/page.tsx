import { AppShell } from "@/pms/components/app-shell";
import { MyWork } from "@/pms/screens/my-work/my-work";

/**
 * My work · today (ADR-058, 058-self-service).
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so "clock in here" is a
 * link one person can send another.
 */
export default function Page() {
  return (
    <AppShell title="My work">
      <MyWork lens="today" />
    </AppShell>
  );
}
