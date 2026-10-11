import { AppShell } from "@/pms/components/app-shell";
import { PsfMembership } from "@/pms/screens/psf-membership";

export default function Page() {
  return (
    <AppShell title="PSF membership">
      <PsfMembership />
    </AppShell>
  );
}
