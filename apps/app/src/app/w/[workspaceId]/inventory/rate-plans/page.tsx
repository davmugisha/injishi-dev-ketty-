import { AppShell } from "@/pms/components/app-shell";
import { Inventory } from "@/pms/screens/inventory";

/**
 * Inventory · the rate-plans lens.
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so it is something one
 * person can send another. A merge that hid its parts behind page state
 * would have traded four addresses for none.
 */
export default function Page() {
  return (
    <AppShell title="Inventory">
      <Inventory lens="rate-plans" />
    </AppShell>
  );
}
