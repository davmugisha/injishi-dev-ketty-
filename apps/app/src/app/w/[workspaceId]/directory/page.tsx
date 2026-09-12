import { AppShell } from "@/pms/components/app-shell";
import { Directory } from "@/pms/screens/broker/directory";

/**
 * Directory, the broker's (ADR-018, AC-13).
 *
 * It no longer has to ask which workspace is looking. The landlord's screen that
 * shared this word is `listing` now, so `directory` means one thing.
 */
export default function Page() {
  return (
    <AppShell title="Directory">
      <Directory />
    </AppShell>
  );
}
