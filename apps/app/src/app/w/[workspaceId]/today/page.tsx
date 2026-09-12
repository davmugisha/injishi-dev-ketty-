import { AppShell } from "@/pms/components/app-shell";
import { Today } from "@/pms/screens/today";

export default function Page() {
  return (
    <AppShell title="Today">
      <Today />
    </AppShell>
  );
}
