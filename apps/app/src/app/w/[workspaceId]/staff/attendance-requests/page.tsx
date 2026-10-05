import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the attendance requests lens (058-time AC-TM6). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="attendance-requests" />
    </AppShell>
  );
}
