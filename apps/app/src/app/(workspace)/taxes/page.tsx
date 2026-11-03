import { kigaliToday, taxYearProblem } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { TaxesView } from "@/features/taxes/TaxesView";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { taxYear } from "@/server/rentals/faults";

export const metadata: Metadata = { title: screens.Taxes.pageTitle };

/** Taxes: the year is the URL's (`?year=`), this year when left out. */
export default async function TaxesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePersona("Taxes");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Taxes" />;
  const params = await searchParams;
  const today = kigaliToday();
  const asked = Number.parseInt(params.year ?? "", 10);
  const year = Number.isInteger(asked) && !taxYearProblem(asked, today) ? asked : Number(today.slice(0, 4));
  const view = await taxYear(year);
  return <TaxesView view={view} today={today} canManage={can(scope, "tax.manage")} />;
}

export const dynamic = "force-dynamic";
