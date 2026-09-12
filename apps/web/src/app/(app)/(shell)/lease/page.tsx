import { EmptyPanel } from "@/components/app/empty-panel";

export const metadata = { title: "My lease" };

/**
 * The tenant's own side of a lease (ADR-018, move 4, AC-10).
 *
 * The same record the landlord opens in the operator app, read from the other
 * end: what you pay, when, and what the contract says. One lease, two views,
 * never two records.
 *
 * The landlord side is live on fixtures in `apps/app`; nothing serves the tenant
 * side yet, so this says so.
 */
export default function Page() {
  return (
    <EmptyPanel icon="file-text" title="No lease on this account">
      When a landlord registers you as their tenant, your lease opens here: the
      contract, the rent you owe and when, your deposit, and the move out when it
      comes.
    </EmptyPanel>
  );
}
