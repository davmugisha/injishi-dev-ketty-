import { AppShell } from "@/pms/components/app-shell";
import { RoomStatus } from "@/pms/screens/room-status";

export default function Page() {
  return (
    <AppShell title="Room status">
      <RoomStatus />
    </AppShell>
  );
}
