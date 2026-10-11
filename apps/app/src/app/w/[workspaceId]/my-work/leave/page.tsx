import { AppShell } from "@/pms/components/app-shell";
import { MyWork } from "@/pms/screens/my-work/my-work";

/** My work · the person's own leave (ADR-058, 058-self-service AC-SS6). */
export default function Page() {
  return (
    <AppShell title="My work">
      <MyWork lens="leave" />
    </AppShell>
  );
}
