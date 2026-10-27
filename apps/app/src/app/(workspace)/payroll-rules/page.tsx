import { screens } from "@injishi/data";
import type { RuleGovernanceStep, RuleSet } from "@injishi/data/fixtures/payroll";
import { PayrollRulesView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.PayrollRules.pageTitle };

export default async function PayrollRulesPage() {
  const persona = await requirePersona("PayrollRules");
  const [sets, governance] = await Promise.all([
    getCollection<RuleSet>("payroll.ruleSets"),
    getCollection<RuleGovernanceStep>("payroll.ruleGovernance"),
  ]);
  return (
    <HrMount>
      <PayrollRulesView persona={persona} sets={sets} governance={governance} />
    </HrMount>
  );
}
