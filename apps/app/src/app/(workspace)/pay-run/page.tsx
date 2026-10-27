import { screens } from "@injishi/data";
import type {
  FinalSettlement,
  PayLine,
  PaymentFile,
  PayRates,
  PayRunException,
  PayRunHistory,
  PayRunOutput,
  PayRunRule,
  PayRunStage,
  PayRunStep,
  PayRunTotal,
} from "@injishi/data/fixtures/payroll";
import { PayRunView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.PayRun.pageTitle };

const STAGES: PayRunStage[] = ["review", "submitted", "confirmed"];

export default async function PayRunPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePersona("PayRun");
  const [rates, lines, steps, exceptions, rules, totals, settlements, files, outputs, history] = await Promise.all([
    getCollection<PayRates>("payroll.payRates"),
    getCollection<PayLine>("payroll.payLines"),
    getCollection<PayRunStep>("payroll.payRunSteps"),
    getCollection<PayRunException>("payroll.payRunExceptions"),
    getCollection<PayRunRule>("payroll.payRunRules"),
    getCollection<PayRunTotal>("payroll.payRunTotals"),
    getCollection<FinalSettlement>("payroll.finalSettlements"),
    getCollection<PaymentFile>("payroll.paymentFiles"),
    getCollection<PayRunOutput>("payroll.payRunOutputs"),
    getCollection<PayRunHistory>("payroll.payRunHistory"),
  ]);
  const snapshot = rates[0];
  if (!snapshot) notFound();
  const { stage } = await searchParams;
  const initialStage = STAGES.find((s) => s === stage) ?? "submitted";
  return (
    <HrMount>
      <PayRunView
        key={initialStage}
        initialStage={initialStage}
        data={{
          rates: snapshot,
          lines,
          steps,
          exceptions,
          rules,
          totals,
          settlement: settlements[0] ?? null,
          files,
          outputs,
          history,
        }}
      />
    </HrMount>
  );
}
