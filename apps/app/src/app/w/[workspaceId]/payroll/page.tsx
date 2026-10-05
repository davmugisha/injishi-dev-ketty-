import { AppShell } from "@/pms/components/app-shell";
import { Payroll } from "@/pms/screens/payroll";

/**
 * Payroll · HR module (first pass — no ADR yet, pending team review).
 *
 * A lens is its own route segment, mirroring people/page.tsx.
 */
export default function Page() {
  return (
    <AppShell title="Payroll">
      <Payroll />
    </AppShell>
  );
}