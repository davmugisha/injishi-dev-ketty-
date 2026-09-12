"use client";

import { Badge, Button } from "@injishi/ui";
import { BadgeCheck, Key, Scale } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useAdminUi, useStubAction } from "@/lib/store";
import type {
  FailedCharge,
  LedgerEntry,
  ReconRun,
  StuckPayout,
} from "@/lib/types";

/**
 * One list on this screen, in the three states a read can end in.
 *
 * The three are kept apart deliberately and none of them may be merged. A list
 * with no rows is a true statement about the platform — no payout has been held
 * — while a failed read says nothing at all about the platform and must not be
 * dressed up as one. Collapsing them is how "the API is down" comes to read as
 * "everything is fine", which on a money screen is the worst available lie.
 */
export type FinancePanel<T> =
  | { state: "rows"; rows: T[]; total: number }
  | { state: "empty" }
  | { state: "failed"; heading: string; message: string; next: ReactNode };

type Tab = "ledger" | "stuck" | "recon";

/** The row count a tab badge can honestly show, or null when we could not ask. */
function totalOf(panel: FinancePanel<unknown>): number | null {
  return panel.state === "rows" ? panel.total : null;
}

/**
 * The block a failed read gets.
 *
 * Dashed rather than tinted: this is an absence of information, not a finding,
 * and a red panel here would read as a discovered problem with the money.
 */
function Failed({
  heading,
  message,
  next,
}: {
  heading: string;
  message: string;
  /** The one move worth offering, built on the server. Often nothing. */
  next: ReactNode;
}) {
  return (
    <div className="mt-3 animate-arrive rounded-card border border-dashed border-border p-6">
      <p className="text-sm font-semibold">{heading}</p>
      <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
        {message}
      </p>
      {next}
    </div>
  );
}

/** The block an empty-but-successful read gets: a fact, in the section's words. */
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 rounded-card border border-dashed border-border p-6">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

/**
 * F-A06 financial oversight — admin observes and unblocks, never handles.
 *
 * A client component ONLY for the tab state and the override dialog. Every
 * figure below was read on the server and arrives already mapped: this file
 * formats nothing, and in particular it never turns an amount into text, which
 * happens in `lib/present/format.ts` so that two screens cannot write one figure
 * two ways.
 *
 * Each of the four lists carries its own outcome rather than sharing one. They
 * are four separate reads, and one of them failing says nothing about the other
 * three — a ledger that answered should still be on screen when payouts did not.
 */
export function FinanceTabs({
  ledger,
  ledgerShown,
  payouts,
  failedCharges,
  recon,
}: {
  ledger: FinancePanel<LedgerEntry>;
  /** "Showing N of M", pre-formatted upstream; null when the read failed. */
  ledgerShown: string | null;
  payouts: FinancePanel<StuckPayout>;
  failedCharges: FinancePanel<FailedCharge>;
  recon: FinancePanel<ReconRun>;
}) {
  const [tab, setTab] = useState<Tab>("ledger");
  const openOverride = useAdminUi((s) => s.openOverride);
  const stubAction = useStubAction();

  const tabClass = (key: Tab) =>
    `tab-btn ${tab === key ? "bg-primary text-primary-foreground" : ""}`;

  const payoutTotal = totalOf(payouts);
  const chargeTotal = totalOf(failedCharges);
  const stuckCount =
    payoutTotal === null && chargeTotal === null
      ? null
      : (payoutTotal ?? 0) + (chargeTotal ?? 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Finance views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ledger"}
            className={tabClass("ledger")}
            onClick={() => setTab("ledger")}
          >
            Ledger
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "stuck"}
            className={tabClass("stuck")}
            onClick={() => setTab("stuck")}
          >
            Stuck money{" "}
            {/* No number at all when a read failed. A "0" there would be this
                screen asserting that nothing is stuck, which is precisely what
                it does not know. */}
            {stuckCount === null ? null : (
              <span className="money">{stuckCount}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "recon"}
            className={tabClass("recon")}
            onClick={() => setTab("recon")}
          >
            Reconciliation
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Zero manual money handling — admin observes and unblocks. Every ledger
          row names the adapter mode it was written under.
        </p>
      </div>

      {/* Ledger */}
      {tab === "ledger" && (
        <section className="mt-6" aria-label="Money ledger">
          {ledger.state === "failed" ? (
            <Failed heading={ledger.heading} message={ledger.message} next={ledger.next} />
          ) : ledger.state === "empty" ? (
            <Empty
              title="No money has moved yet"
              body="The ledger is written as bookings are captured, payouts settle and fees are charged. Nothing has been posted on this platform so far."
            />
          ) : (
            <>
              <div className="scrollbar overflow-x-auto rounded-card border border-border bg-field">
                <table className="w-full min-w-[52rem] text-sm">
                  <caption className="sr-only">
                    Ledger across all money primitives, each row signed by its
                    direction
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="p-4">Entry</th>
                      <th className="p-4">Primitive</th>
                      <th className="p-4">Account</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Adapter</th>
                      <th className="p-4">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.rows.map((entry) => (
                      <tr key={entry.id}>
                        <td className="money p-4 text-xs">{entry.id}</td>
                        <td className="p-4">
                          <Badge variant="accent">{entry.primitive}</Badge>
                        </td>
                        <td className="p-4">{entry.counterparty}</td>
                        <td className="money p-4 font-semibold">
                          {entry.amount}
                        </td>
                        <td className="p-4">
                          {/* The mode the row was WRITTEN under, per row —
                              never a banner over the table. Mock money beside
                              live money with one label above both is the single
                              most expensive thing this console could get wrong. */}
                          <Badge variant={entry.state.intent}>
                            {entry.state.text}
                          </Badge>
                        </td>
                        <td className="money p-4 text-xs">{entry.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {ledgerShown}. Prices and refund tiers are{" "}
                <span className="font-semibold text-foreground">
                  locked at booking time
                </span>{" "}
                (business rule 8) — never recomputed. Finance reads
                platform-wide; per-workspace scoping holds in the data.
              </p>
            </>
          )}
        </section>
      )}

      {/* Stuck money */}
      {tab === "stuck" && (
        <section className="mt-6" aria-label="Stuck-money queues">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Payouts{" "}
            {payoutTotal === null ? null : (
              <Badge variant="warning">{payoutTotal}</Badge>
            )}
          </h2>
          {payouts.state === "failed" ? (
            <Failed heading={payouts.heading} message={payouts.message} next={payouts.next} />
          ) : payouts.state === "empty" ? (
            <Empty
              title="No payout has been raised"
              body="A payout row exists once money is owed to a workspace. Nothing is owed, held or in flight on this platform."
            />
          ) : (
            <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
              {payouts.rows.map((payout) => (
                <div key={payout.ref} className="queue-row flex-wrap">
                  <span className="money w-20 shrink-0 truncate text-xs font-bold">
                    {payout.ref}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate text-sm font-semibold">
                      {payout.title}
                    </span>
                    <span
                      className={`block text-xs ${
                        payout.detailTone === "warning"
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      {payout.detail}
                    </span>
                  </span>
                  {payout.action.kind === "override" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="shrink-0"
                      onClick={openOverride}
                    >
                      <BadgeCheck className="h-4 w-4" aria-hidden /> Review
                      override
                    </Button>
                  )}
                  {payout.action.kind === "status" && (
                    <Badge
                      variant={payout.action.intent}
                      className="shrink-0"
                    >
                      <Key className="size-3" aria-hidden />
                      {payout.action.text}
                    </Badge>
                  )}
                  {payout.action.kind === "stub" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={stubAction(payout.action.stub)}
                    >
                      {payout.action.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Failed charges
          </h2>
          {failedCharges.state === "failed" ? (
            <Failed
              heading={failedCharges.heading}
              message={failedCharges.message}
              next={failedCharges.next}
            />
          ) : failedCharges.state === "empty" ? (
            <Empty
              title="No charge has failed"
              body="Every subscription invoice the platform has raised was collected. This list only ever holds invoices that came back failed."
            />
          ) : (
            <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
              {failedCharges.rows.map((charge, index) => (
                <div
                  key={`${charge.title}-${charge.detail}-${index}`}
                  className="queue-row flex-wrap"
                >
                  <span className="min-w-0 grow">
                    <span className="block truncate text-sm font-semibold">
                      {charge.title}
                    </span>
                    <span
                      className={`block text-xs ${
                        charge.detailTone === "warning"
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      {charge.detail}
                    </span>
                  </span>
                  <Badge variant={charge.badge.intent} className="shrink-0">
                    {charge.badge.text}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A manual money action is the exception path: reason-coded,{" "}
            <span className="font-semibold text-foreground">
              dual-authorized
            </span>{" "}
            (Finance initiates, Super Admin approves), idempotent, written to
            both the money audit trail and the ledger.
          </p>
        </section>
      )}

      {/* Reconciliation */}
      {tab === "recon" && (
        <section className="mt-6" aria-label="Reconciliation">
          <div className="rounded-card border border-dashed border-border p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Scale className="h-4 w-4" aria-hidden /> Ledger vs provider
            </h2>
            <p className="mt-2 max-w-read text-sm text-muted-foreground">
              Reconciliation is the check that says the ledger and the payment
              provider agree. Against a mocked adapter it runs in rehearsal mode
              — the process is proven before real money flows — and every run
              below names the mode it ran under through its discrepancy count.
              Discrepancies are flagged, never auto-cleared.
            </p>
          </div>
          {recon.state === "failed" ? (
            <Failed heading={recon.heading} message={recon.message} next={recon.next} />
          ) : recon.state === "empty" ? (
            <Empty
              title="No reconciliation has run"
              body="A run is recorded each time the ledger is compared against the provider's settlement records. None has been performed on this platform."
            />
          ) : (
            <div className="mt-4 scrollbar overflow-x-auto rounded-card border border-border bg-field">
              <table className="w-full min-w-[44rem] text-sm">
                <caption className="sr-only">Reconciliation runs</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">Run</th>
                    <th className="p-4">Window</th>
                    <th className="p-4">Entries</th>
                    <th className="p-4">Matched</th>
                    <th className="p-4">Discrepancies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recon.rows.map((run) => (
                    <tr key={run.id}>
                      <td className="money p-4 text-xs">{run.id}</td>
                      <td className="money p-4 text-xs">{run.window}</td>
                      <td className="money p-4">{run.entries}</td>
                      <td className="p-4">
                        <Badge variant={run.matched.intent}>
                          {run.matched.text}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={run.discrepancies.intent}>
                          {run.discrepancies.text}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
