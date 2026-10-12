import { AppShell } from "@/pms/components/app-shell";
import { MyWork } from "@/pms/screens/my-work/my-work";

/** My work · the person's own documents, handed in by themselves (ADR-058, 058-self-service). */
export default function Page() {
  return (
    <AppShell title="My work">
      <MyWork lens="documents" />
    </AppShell>
  );
}
