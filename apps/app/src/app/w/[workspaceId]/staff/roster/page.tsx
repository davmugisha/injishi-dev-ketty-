import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the roster lens (ADR-058). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="roster" />
    </AppShell>
  );
}
