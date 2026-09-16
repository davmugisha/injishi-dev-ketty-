import { AppShell } from "@/pms/components/app-shell";
import { People } from "@/pms/screens/people";

/**
 * Team & Departments · the roles lens (ADR-055).
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so it is something one
 * person can send another — which matters more here than on most: "look at
 * what the receptionist can do" is a sentence with a link in it.
 */
export default function Page() {
  return (
    <AppShell title="Team & Departments">
      <People lens="roles" />
    </AppShell>
  );
}
