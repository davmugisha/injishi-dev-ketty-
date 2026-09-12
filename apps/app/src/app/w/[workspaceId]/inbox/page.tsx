import { AppShell } from "@/pms/components/app-shell";
import { Inbox } from "@/pms/screens/inbox";

/**
 * The operator inbox (ADR-018, AC-11).
 *
 * One route, not one per workspace kind. `messages` and `tenant-messages` are
 * gone; which threads you see follows the workspace in the address.
 */
export default function Page() {
  return (
    <AppShell title="Inbox">
      <Inbox />
    </AppShell>
  );
}
