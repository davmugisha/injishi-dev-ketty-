import { screens } from "@injishi/data";
import type { RuleGovernanceStep, RuleSet } from "@injishi/data/fixtures/payroll";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { PayrollRulesView } from "@/features/payroll/PayrollRulesView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.PayrollRules.pageTitle };

export default async function PayrollRulesPage() {
  const persona = await requirePersona("PayrollRules");
  const [sets, governance] = await Promise.all([
    getCollection<RuleSet>("payroll.ruleSets"),
    getCollection<RuleGovernanceStep>("payroll.ruleGovernance"),
  ]);
  return <PayrollRulesView persona={persona} sets={sets} governance={governance} />;
}
