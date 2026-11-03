import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { RentView } from "@/features/rentals/RentView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { landlordScope, rentalsMoney } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentPayments.pageTitle };

/** Every rent and deposit charge with what was paid on it. */
export default async function RentPage() {
  await requirePersona("RentPayments");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Rent" />;
  const money = await rentalsMoney();
  return <RentView charges={money.charges} today={money.today} />;
}

export const dynamic = "force-dynamic";
