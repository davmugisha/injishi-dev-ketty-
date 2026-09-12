import { AppShell } from "@/pms/components/app-shell";
import { Placeholder } from "@/pms/components/placeholder";

/**
 * ONE account screen for the operator app (ADR-018, AC-11).
 *
 * An account is a property of the PERSON, and a person has one, so it collapses
 * to one per app. `broker-account` and the per workspace account screens are
 * gone.
 */
export default function Page() {
  return (
    <AppShell title="Account">
      <Placeholder screenKey="account" />
    </AppShell>
  );
}
