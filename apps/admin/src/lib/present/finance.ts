import type {
  AdminFailedCharge,
  AdminInvoice,
  AdminLedgerRow,
  AdminPayout,
  AdminReconRun,
} from "@injishi/contracts";

import type {
  BadgeIntent,
  FailedCharge,
  LedgerEntry,
  ReconRun,
  SectionRow,
  StuckPayout,
} from "@/lib/types";

import { EMPTY, count, date, dateTime, detail, humanise, money } from "./format";

/**
 * Finance (F-A06) — money, as words.
 *
 * One rule sits above every mapping in this file: **mock money must never look
 * like live money.** Every ledger row carries the `adapterMode` it was written
 * under, and this is where that becomes visible. A finance screen that renders
 * a mock capture identically to a real one is the single most expensive thing
 * this console could get wrong, and it would be invisible until somebody
 * reconciled a bank statement against it.
 */

/**
 * The mode badge.
 *
 * `mock` is amber — not neutral, not grey. Neutral is what a reader's eye
 * skips, and this is the one thing on a money row they must not skip.
 */
function modeBadge(mode: "mock" | "live"): {
  text: string;
  intent: BadgeIntent;
} {
  return mode === "mock"
    ? { text: "mock", intent: "warning" }
    : { text: "live", intent: "default" };
}

/* ---------- Ledger ---------- */

/**
 * One double-entry row.
 *
 * The amount is signed by `direction`, because a ledger printed without signs
 * is a list of numbers that cannot be added up.
 *
 * `counterparty` is the ACCOUNT CODE, and the column is named for something
 * richer than the API sends. `AdminLedgerRow` carries `accountCode` and a memo,
 * not a party name — resolving a code to "Kacyiru Villas" would need a join the
 * response does not contain, and guessing at it on a money screen is how a
 * transfer gets attributed to the wrong business.
 */
export function presentLedgerEntry(row: AdminLedgerRow): LedgerEntry {
  const signed = row.direction === "debit" ? -row.amountRwf : row.amountRwf;
  return {
    id: row.id,
    primitive: humanise(row.kind),
    counterparty: detail(row.accountCode, row.memo),
    amount: money(signed, row.currency),
    state: modeBadge(row.adapterMode),
    when: dateTime(row.occurredAt),
  };
}

/* ---------- Payouts ---------- */

/**
 * Payout state, and the one that means somebody is not being paid.
 *
 * `held` is red because money that should have moved has not, and a landlord is
 * waiting on it. `queued` and `scheduled` are in-flight and blue: nothing is
 * wrong, it simply has not happened yet. Collapsing `held` into "pending" is
 * how a stuck payout sits for a week without anybody seeing it.
 */
const PAYOUT_INTENT: Readonly<Record<AdminPayout["status"], BadgeIntent>> = {
  scheduled: "accent",
  queued: "accent",
  paid: "success",
  held: "danger",
};

export function presentPayout(payout: AdminPayout): StuckPayout {
  return {
    ref: payout.id,
    title: money(payout.amountRwf, payout.currency),
    detail: detail(
      humanise(payout.status),
      payout.failureReason,
      payout.settledAt
        ? `settled ${date(payout.settledAt)}`
        : `created ${date(payout.createdAt)}`,
    ),
    ...(payout.status === "held" ? { detailTone: "warning" as const } : {}),
    action: payoutAction(payout),
  };
}

/**
 * What can be done about a payout.
 *
 * The manual override is offered only for a `held` payout, because that is the
 * only state where a human decision is what unblocks it. A settled payout gets
 * a badge instead of a button: there is nothing left to decide, and an override
 * control beside completed money is an invitation to move it twice.
 */
function payoutAction(payout: AdminPayout): StuckPayout["action"] {
  if (payout.status === "held") return { kind: "override" };
  return {
    kind: "status",
    text: humanise(payout.status),
    intent: PAYOUT_INTENT[payout.status],
  };
}

/* ---------- Failed charges ---------- */

/**
 * A subscription invoice that would not charge.
 *
 * Always red. Every row on this list is by definition a failure — the endpoint
 * selects `status = failed` — so there is no second colour to choose between,
 * and a neutral row here would be a row somebody skips.
 */
export function presentFailedCharge(charge: AdminFailedCharge): FailedCharge {
  return {
    title: charge.orgName,
    detail: detail(
      humanise(charge.invoiceKind),
      money(charge.amountRwf, charge.currency),
      `attempted ${date(charge.createdAt)}`,
    ),
    detailTone: "warning",
    badge: { text: humanise(charge.status), intent: "danger" },
  };
}

/* ---------- Reconciliation ---------- */

/**
 * One reconciliation run.
 *
 * Two badges rather than one, because "matched" and "discrepancies" answer
 * different questions and a single percentage hides the second. A run with a
 * single discrepancy is red: reconciliation is the check that says the ledger
 * and the processor agree, so any disagreement at all is the finding.
 */
export function presentReconRun(run: AdminReconRun): ReconRun {
  const clean = run.discrepancyCount === 0;
  return {
    id: run.id,
    window: run.windowStart
      ? `${date(run.windowStart)} – ${date(run.windowEnd)}`
      : `ran ${dateTime(run.ranAt)}`,
    entries: run.entryCount,
    matched: {
      text: `${count(run.matchedCount)} of ${count(run.entryCount)}`,
      intent: run.matchedCount === run.entryCount ? "success" : "warning",
    },
    discrepancies: {
      text: clean ? "none" : count(run.discrepancyCount),
      intent: clean ? "success" : "danger",
    },
  };
}

/* ---------- Invoices ---------- */

/**
 * An invoice, for the business detail screen's money tab.
 *
 * `pending` is neutral, not amber: an invoice raised today and not yet paid is
 * the normal state of an invoice, and colouring it as a problem would make
 * every healthy subscription look overdue. Only `failed` is a finding.
 */
const INVOICE_INTENT: Readonly<Record<AdminInvoice["status"], BadgeIntent>> = {
  pending: "default",
  paid: "success",
  failed: "danger",
};

export function presentInvoice(invoice: AdminInvoice): SectionRow {
  return {
    ref: invoice.id,
    subject: money(invoice.amountRwf, invoice.currency),
    context: detail(
      humanise(invoice.invoiceKind),
      invoice.periodStart
        ? `${date(invoice.periodStart)} – ${date(invoice.periodEnd)}`
        : null,
      `raised ${date(invoice.createdAt)}`,
    ),
    state: invoice.status,
    intent: INVOICE_INTENT[invoice.status],
  };
}

/** The registration fee, which is either paid, outstanding, or was never raised. */
export function presentRegistrationFee(
  invoice: AdminInvoice | null,
): { label: string; value: string; note: string; intent: BadgeIntent } {
  if (!invoice) {
    // No invoice is not the same as an unpaid one. D23 makes the fee settling
    // the only exit from `pending_payment`, so a business with no fee row has
    // not entered the pipeline rather than having fallen behind in it.
    return {
      label: "Registration fee",
      value: EMPTY,
      note: "never raised",
      intent: "default",
    };
  }
  return {
    label: "Registration fee",
    value: money(invoice.amountRwf, invoice.currency),
    note: `${invoice.status} · raised ${date(invoice.createdAt)}`,
    intent: INVOICE_INTENT[invoice.status],
  };
}
