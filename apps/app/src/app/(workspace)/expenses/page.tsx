import { expenseYearProblem, kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { ExpensesView } from "@/features/expenses/ExpensesView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, rentalProperties, rentalUnits } from "@/server/rentals/client";
import { expenseList } from "@/server/rentals/faults";

export const metadata: Metadata = { title: screens.Expenses.pageTitle };

/** Expenses: the year is the URL's (`?year=`). */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePersona("Expenses");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Expenses" />;
  const params = await searchParams;
  const today = kigaliToday();
  const asked = Number.parseInt(params.year ?? "", 10);
  const year = Number.isInteger(asked) && !expenseYearProblem(asked, today) ? asked : Number(today.slice(0, 4));
  const [list, properties, units] = await Promise.all([expenseList(year), rentalProperties(), rentalUnits()]);
  return (
    <ExpensesView
      list={list}
      today={today}
      properties={properties.properties.map((p) => ({ id: p.id, name: p.name }))}
      units={units.units
        .filter((u) => u.state !== "retired")
        .map((u) => ({ id: u.id, label: `Unit ${u.label}`, propertyId: u.propertyId }))}
      canManage={can(scope, "expense.manage")}
    />
  );
}

export const dynamic = "force-dynamic";
