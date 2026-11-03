import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { TaxFilingsView } from "@/features/taxes/TaxFilingsView";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { leaseFilings } from "@/server/rentals/faults";

export const metadata: Metadata = { title: screens.TaxFilings.pageTitle };

/** Lease copies owed to RRA: every copy still owed, and the ones filed. */
export default async function TaxFilingsPage() {
  await requirePersona("TaxFilings");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="RRA filings" />;
  const filings = await leaseFilings();
  return (
    <TaxFilingsView
      filings={[...filings.items].sort((a, b) =>
        a.status === b.status ? a.dueOn.localeCompare(b.dueOn) : a.status === "pending" ? -1 : 1,
      )}
      canManage={can(scope, "tax.manage")}
    />
  );
}

export const dynamic = "force-dynamic";
