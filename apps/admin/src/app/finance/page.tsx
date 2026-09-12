import {
  listFailedCharges,
  listLedger,
  listPayouts,
  listReconRuns,
} from "@/lib/api/finance";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import {
  apiFailureMessage,
  failureHeading,
  type ApiResult,
} from "@/lib/api/server";
import { count } from "@/lib/present/format";
import {
  presentFailedCharge,
  presentLedgerEntry,
  presentPayout,
  presentReconRun,
} from "@/lib/present/finance";
import { FinanceTabs, type FinancePanel } from "./finance-tabs";

export const metadata = { title: "Finance" };

/** The permission all four finance routes declare. */
const PERMISSION = "admin.finance.view";

/** A paged list response, in the only shape this page needs from one. */
interface Listed<S> {
  items: S[];
  meta: { total: number };
}

/**
 * Turn one read into one panel.
 *
 * The empty branch is separate from the failed branch here, at the point where
 * the difference is still known. Deciding it further down — in the client
 * component, from an empty array — would lose it: a failed read and an empty
 * table both arrive as "no rows", and only one of them means the platform has
 * nothing.
 */
function panelOf<S, T>(
  result: ApiResult<Listed<S>>,
  map: (row: S) => T,
): FinancePanel<T> {
  if (!result.ok) {
    return {
      state: "failed",
      heading: failureHeading(result.reason, PERMISSION),
      message: apiFailureMessage(result.reason),
      // Rendered on the server and handed down: the tabs are a client
      // component, and the detour urls are built from the request.
      next: <FailureNextStep reason={result.reason} />,
    };
  }
  if (result.data.items.length === 0) return { state: "empty" };
  return {
    state: "rows",
    rows: result.data.items.map(map),
    total: result.data.meta.total,
  };
}

/**
 * Finance (F-A06) — four reads, four independent outcomes.
 *
 * The four routes are requested TOGETHER rather than one per tab. They are
 * independent GETs and awaiting them in sequence would make the slowest one the
 * cost of the screen; more to the point, a tab that fetches when it is opened
 * cannot be server-rendered at all, and this console reads on the server so an
 * unauthorised caller never receives the markup.
 *
 * Each result keeps its own state. A held payout the platform cannot report is
 * not a reason to hide a ledger that answered.
 */
export default async function Page() {
  const [ledger, payouts, failedCharges, recon] = await Promise.all([
    listLedger(),
    listPayouts(),
    listFailedCharges(),
    listReconRuns(),
  ]);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <FinanceTabs
        ledger={panelOf(ledger, presentLedgerEntry)}
        ledgerShown={
          ledger.ok
            ? `Showing ${count(ledger.data.items.length)} of ${count(ledger.data.meta.total)} entries`
            : null
        }
        payouts={panelOf(payouts, presentPayout)}
        failedCharges={panelOf(failedCharges, presentFailedCharge)}
        recon={panelOf(recon, presentReconRun)}
      />
    </div>
  );
}
