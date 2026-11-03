import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { RentalsTodoView } from "@/features/rentals/RentalsTodoView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { landlordScope, rentalsSummary } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentalsTodo.pageTitle };

/** What needs the landlord now, each with its next step. */
export default async function RentalsTodoPage() {
  await requirePersona("RentalsTodo");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="To do" />;
  const summary = await rentalsSummary();
  return <RentalsTodoView items={summary.attention} />;
}

export const dynamic = "force-dynamic";
