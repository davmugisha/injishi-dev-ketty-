import { AppShell } from "@/pms/components/app-shell";
import { Checklists } from "@/pms/screens/checklists";

export default function Page() {
  return (
    <AppShell title="Checklists">
      <Checklists />
    </AppShell>
  );
}
