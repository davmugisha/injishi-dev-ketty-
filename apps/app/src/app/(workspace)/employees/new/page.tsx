import type { NewEmployeeForm } from "@injishi/data/fixtures/people";
import { NewEmployeeView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { readContributions } from "@/server/mutations/payroll";

export const metadata: Metadata = { title: "HR · New employee" };

/** People › Employees › New employee: a person put on file with their login, in one sitting. */
export default async function NewEmployeePage({
  searchParams,
}: {
  /** A hire from Talent opens the form with the candidate's details. */
  searchParams: Promise<{
    name?: string;
    phone?: string;
    email?: string;
    wage?: string;
    start?: string;
    candidate?: string;
  }>;
}) {
  await requirePersona("Employees");
  const [form] = await getCollection<NewEmployeeForm>("people.newEmployeeForm");
  if (!form) notFound();
  // The business's PAYE and RSSB rules, for the take-home preview beside the salary; none without pay access.
  const rules = await readContributions(await requestContext()).catch(() => null);
  const prefill = await searchParams;
  return (
    <HrMount off={await hrFeaturesOff()}>
      <NewEmployeeView form={form} rules={rules} prefill={prefill} />
    </HrMount>
  );
}
