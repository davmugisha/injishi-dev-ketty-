import { AppShell } from "@/pms/components/app-shell";
import { Settings } from "@/pms/screens/settings";

/**
 * Settings · the policies lens.
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so it is something one
 * person can send another. A merge that hid its parts behind page state
 * would have traded four addresses for none.
 */
export default function Page() {
  return (
    <AppShell title="Settings">
      <Settings lens="policies" />
    </AppShell>
  );
}
