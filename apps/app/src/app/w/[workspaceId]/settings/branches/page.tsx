import { AppShell } from "@/pms/components/app-shell";
import { Settings } from "@/pms/screens/settings";

/**
 * Settings · the branches lens (ADR-054). Its own route segment, like every
 * lens, so the address can be sent to someone.
 */
export default function Page() {
  return (
    <AppShell title="Settings">
      <Settings lens="branches" />
    </AppShell>
  );
}
