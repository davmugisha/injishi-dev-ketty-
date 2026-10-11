import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the late and monthly lens (058-time AC-TM13). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="time-insights" />
    </AppShell>
  );
}
