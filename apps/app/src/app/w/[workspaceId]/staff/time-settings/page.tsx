import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the time settings lens (058-time AC-TM4, AC-TM12). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="time-settings" />
    </AppShell>
  );
}
