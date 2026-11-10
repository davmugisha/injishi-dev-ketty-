import { screens } from "@injishi/data";
import type { RuleGovernanceStep, RuleSet } from "@injishi/data/fixtures/payroll";
import { PayrollRulesView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.PayrollRules.pageTitle };

export default async function PayrollRulesPage() {
  await requirePersona("PayrollRules");
  const [sets, governance] = await Promise.all([
    getCollection<RuleSet>("payroll.ruleSets"),
    getCollection<RuleGovernanceStep>("payroll.ruleGovernance"),
  ]);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <PayrollRulesView sets={sets} governance={governance} />
    </HrMount>
  );
}
