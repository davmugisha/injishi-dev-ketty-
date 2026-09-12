import { AppShell } from "@/pms/components/app-shell";
import { DirectoryListing } from "@/pms/screens/landlord/directory-listing";

/**
 * Listing (ADR-018, AC-13).
 *
 * Was `directory`, the same word the broker workspace uses for the OPPOSITE
 * job: this one publishes your units, theirs browses everyone else's. One word
 * naming two opposite directions is a live source of misunderstanding, not a
 * tidiness complaint.
 */
export default function Page() {
  return (
    <AppShell title="Listing">
      <DirectoryListing />
    </AppShell>
  );
}
