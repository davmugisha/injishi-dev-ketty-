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
  PayRunState,
  PayRunStep,
  PayRunTotal,
} from "@injishi/data/fixtures/payroll";
import { PayRunView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.PayRun.pageTitle };

const STAGES: PayRunStage[] = ["review", "submitted", "confirmed"];

export default async function PayRunPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePersona("PayRun");
  const [state, rates, lines, steps, exceptions, rules, totals, settlements, files, outputs, history] =
    await Promise.all([
      getCollection<PayRunState>("payroll.payRunState"),
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
  const board = state[0];
  if (!snapshot || !board) notFound();
  const { stage } = await searchParams;
  // A live run says where it stands; the sample board's stage is picked by the address.
  const initialStage = board.live ? board.stage : (STAGES.find((s) => s === stage) ?? "submitted");
  return (
    <HrMount off={await hrFeaturesOff()}>
      <PayRunView
        initialStage={initialStage}
        key={`${board.runId ?? "none"}:${initialStage}`}
        data={{
          state: board,
          rates: snapshot,
          lines,
          steps,
          exceptions,
          rules,
          totals,
          settlements,
          files,
          outputs,
          history,
        }}
      />
    </HrMount>
  );
}
