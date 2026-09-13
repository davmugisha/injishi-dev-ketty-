import { AppShell } from "@/pms/components/app-shell";
import { Setup } from "@/pms/screens/setup";

/**
 * Setup: the checklist an approved business lands on (2026-09-13). The approval
 * mail and the registration pipeline both link here.
 */
export default function Page() {
  return (
    <AppShell title="Set up your property">
      <Setup />
    </AppShell>
  );
}
