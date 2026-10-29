import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { SetupView } from "@/features/rentals/SetupView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { landlordScope, rentalsSetup } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentalsSetup.pageTitle };

/** A new landlord's steps, each opening where it is done. */
export default async function RentalsSetupPage() {
  await requirePersona("RentalsSetup");
  if (!(await landlordScope())) return <NoRentalsBusiness title="Setup" />;
  return <SetupView setup={await rentalsSetup()} />;
}

export const dynamic = "force-dynamic";
