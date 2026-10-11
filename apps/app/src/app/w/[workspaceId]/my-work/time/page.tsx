import { AppShell } from "@/pms/components/app-shell";
import { MyWork } from "@/pms/screens/my-work/my-work";

/** My work · the person's own clock ins and outs (ADR-058, 058-time AC-TM6, AC-TM13). */
export default function Page() {
  return (
    <AppShell title="My work">
      <MyWork lens="time" />
    </AppShell>
  );
}
