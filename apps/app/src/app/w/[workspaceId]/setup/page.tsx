import { AppShell } from "@/pms/components/app-shell";
import { Setup } from "@/pms/screens/setup";

/**
 * Set-up: the owner's guided path from approval to a published listing
 * (Onboarding board, 2026-10-07). The approval mail, the registration pipeline
 * and the "Finish setting up" banner on Today all link here; `?step=` opens one
 * step and `?view=publish` the preview. Gated by the shell like every route: a
 * grant without `listing.manage` has no Setup in its nav and is refused here.
 */
export default function Page() {
  return (
    <AppShell title="Set up your property">
      <Setup />
    </AppShell>
  );
}
