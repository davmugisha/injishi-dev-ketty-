import { AppShell } from "@/pms/components/app-shell";
import { Staff } from "@/pms/screens/staff/staff";

/** Staff · the rotations lens (058-time AC-TM3). */
export default function Page() {
  return (
    <AppShell title="Staff">
      <Staff lens="rotations" />
    </AppShell>
  );
}
