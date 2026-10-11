import { AppShell } from "@/pms/components/app-shell";
import { MyHr } from "@/pms/screens/my-hr";

/**
 * My HR · the tasks lens.
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so it is something one
 * person can send another. A merge that hid its parts behind page state
 * would have traded four addresses for none.
 */
export default function Page() {
  return (
    <AppShell title="My HR">
      <MyHr lens="tasks" />
    </AppShell>
  );
}
