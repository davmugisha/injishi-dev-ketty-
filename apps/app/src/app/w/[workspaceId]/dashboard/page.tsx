import { AppShell } from "@/pms/components/app-shell";
import { Today } from "@/pms/screens/today";

/**
 * Dashboard, the home of the owner, the manager and the desk (ADR-069 D-f).
 *
 * Was Today: "Dashboard" is what every PMS calls the home screen, and "Today"
 * stays as its default period (the Navigation board's renames). Until the homes
 * framework draws the owner and operations dashboards, it is today's movements,
 * the screen Today has always been. `/today` still opens it, under this door.
 */
export default function Page() {
  return (
    <AppShell title="Dashboard">
      <Today />
    </AppShell>
  );
}
