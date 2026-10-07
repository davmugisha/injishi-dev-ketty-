import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the kiosks lens (058-time AC-TM10). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="kiosks" />
    </AppShell>
  );
}
