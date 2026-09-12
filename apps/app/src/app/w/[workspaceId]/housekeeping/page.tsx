import { AppShell } from "@/pms/components/app-shell";
import { Cleaning } from "@/pms/screens/cleaning";

/**
 * Housekeeping (ADR-018, AC-13).
 *
 * Was `cleaning`, which named the task rather than the department that owns it.
 * The screen is unchanged; only the word and the address moved.
 */
export default function Page() {
  return (
    <AppShell title="Housekeeping">
      <Cleaning />
    </AppShell>
  );
}
