import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the shift requests lens (058-time AC-TM5). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="shift-requests" />
    </AppShell>
  );
}
