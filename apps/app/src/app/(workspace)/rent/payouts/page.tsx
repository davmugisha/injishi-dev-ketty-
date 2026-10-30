import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PayoutsView } from "@/features/rentals/PayoutsView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, rentPayouts } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentPayouts.pageTitle };

/** The rent Injishi sent on to the business, payout by payout. */
export default async function RentPayoutsPage() {
  await requirePersona("RentPayouts");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Payouts" />;
  const list = await rentPayouts();
  return <PayoutsView list={list} canRetry={can(scope, "payout.manage")} />;
}

export const dynamic = "force-dynamic";
