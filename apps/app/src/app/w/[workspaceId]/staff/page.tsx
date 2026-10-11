import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/**
 * Staff · the employees lens (ADR-058).
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so "look at the roster" is
 * a link one person can send another.
 */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="employees" />
    </AppShell>
  );
}
