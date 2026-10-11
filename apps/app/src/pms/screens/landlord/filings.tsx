"use client";

/**
 * Filings — the rental income declaration, and F-R10's fifteen day clock.
 *
 * **On real data** (2026-09-21). This lens was a `Placeholder` carrying a "Next
 * design pass" badge, so the one screen a landlord opens at filing season was
 * the one screen with nothing on it. It answers the two questions the section
 * is named for, and it answers them from two reads rather than from a fixture:
 *
 *   **What did I collect?** `GET /ops/rent-roll` returns every period every
 *   lease has ever been charged, so the year's rental income is ADDED UP from
 *   the payments themselves rather than stored as a figure somebody typed. A
 *   lease never produces a tax invoice, so this summary IS the record.
 *
 *   **What has actually been filed?** `GET /ops/filings` returns one row per
 *   lease with the state of its contract filing beside it. Read from the lease
 *   outward, so a tenancy whose contract nothing filed is visible rather than
 *   absent — which is the row that matters.
 *
 * Two things it deliberately does NOT do.
 *
 * It does not compute or remit the tax. F-R10 §6 puts that out of scope, and a
 * figure captioned "tax due" that nobody checked is exactly the kind of number
 * a landlord acts on.
 *
 * It does not offer a download. The screen this replaces had a "Download
 * summary" button that raised a toast and produced no file, because there is no
 * export endpoint; a landlord could go looking in their Downloads folder at
 * filing season for a document that was never made. The button comes back when
 * a file does.
 */

import { BarList } from "@injishi/ui";
import {
  CONTRACT_FILING_WINDOW_DAYS,
  type OperatorContractFiling,
  type OperatorRentCharge,
} from "@injishi/contracts";
import Link from "next/link";
import { cn } from "@/lib/utils";

import {
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  StatCard,
  surfaceClass,
} from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useFilings, useRentRoll } from "../../data/ops";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { useWorkspaceHref } from "../../lib/workspace-href";

const COLS = "minmax(56px,.5fr) minmax(140px,1.2fr) minmax(200px,2fr) auto";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * When the annual rental income declaration for `year` falls due.
 *
 * The 31st of January following the year the rent came in. Derived from the
 * year rather than stored, so the screen cannot go on naming last year's
 * deadline once the year turns — which is what the fixture it replaces did.
 */
function declarationDue(year: number): string {
  return `31 January ${year + 1}`;
}

/** The same date, short enough for a stat card's one nowrap line. */
function declarationDueShort(year: number): string {
  return `31 Jan ${year + 1}`;
}

/** Whole days from now until `iso`, rounded towards the deadline. */
function daysUntil(iso: string, now: number): number {
  return Math.ceil((Date.parse(iso) - now) / 86_400_000);
}

function days(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

type Clock = {
  intent: "ok" | "info" | "warn" | "bad" | "neutral";
  badge: string;
  line: string;
};

/** What one filing's row says, and how loudly. */
function clockOf(f: OperatorContractFiling, now: number): Clock {
  if (f.status === "filed") {
    return {
      intent: "ok",
      badge: "Filed",
      line: f.dueBy
        ? `Filed inside the ${CONTRACT_FILING_WINDOW_DAYS} days — the deadline was ${dshortIso(f.dueBy.slice(0, 10))}.`
        : "The signed contract has been filed.",
    };
  }

  if (f.status === "failed") {
    return {
      intent: "bad",
      badge: "Refused",
      // The reason IS the row. F-R10 §6: a failure surfaces to the landlord
      // with ready-to-file copy as the fallback, never silently dropped.
      line:
        f.failureReason ??
        `Refused after ${f.attempts === 1 ? "one attempt" : `${f.attempts} attempts`}, with no reason recorded. Ask support what the tax administration returned.`,
    };
  }

  if (f.status === "pending") {
    const left = f.dueBy ? daysUntil(f.dueBy, now) : null;
    if (left === null) {
      return { intent: "info", badge: "Filing", line: "Queued to file." };
    }
    if (left === 0) {
      return {
        intent: "info",
        badge: "Filing",
        line: `Due today, on the last of the ${CONTRACT_FILING_WINDOW_DAYS} days. Injishi files this — there is nothing for you to do.`,
      };
    }
    return left > 0
      ? {
          intent: "info",
          badge: "Filing",
          line: `${days(left)} left of the ${CONTRACT_FILING_WINDOW_DAYS}. Injishi files this — there is nothing for you to do.`,
        }
      : {
          intent: "warn",
          badge: "Past due",
          line: `${days(-left)} past the ${CONTRACT_FILING_WINDOW_DAYS} day deadline, and still being retried.`,
        };
  }

  // No filing row at all. Whether that is a gap turns on the signature.
  if (f.signedAt) {
    return {
      intent: "warn",
      badge: "Not filed",
      line: `Signed ${dshortIso(f.signedAt.slice(0, 10))}, and nothing has been raised to file it.`,
    };
  }
  return {
    intent: "neutral",
    badge: "Not signed",
    line: "Nothing to file until both sides have signed.",
  };
}

/** The months of `year` that have happened, with what came in against each. */
function collectedByMonth(charges: readonly OperatorRentCharge[], year: number) {
  const byMonth = new Map<number, number>();
  for (const c of charges) {
    if (!c.periodMonth.startsWith(`${year}-`)) continue;
    const m = Number(c.periodMonth.slice(5, 7)) - 1;
    byMonth.set(m, (byMonth.get(m) ?? 0) + (c.paidAmountRwf ?? 0));
  }
  // Only as far as the year has run. A bar for next November reads as a year
  // that collapsed, when in fact it has not arrived.
  const last = Math.max(-1, ...byMonth.keys());
  return Array.from({ length: last + 1 }, (_, m) => {
    const value = byMonth.get(m) ?? 0;
    return { key: MONTHS[m], label: MONTHS[m], value, display: fmt(value) };
  });
}

export function Filings() {
  const workspaceId = useWorkspaceId();
  const href = useWorkspaceHref();
  const { can, reasonFor } = useCapability();

  const mayReadMoney = can("money.view") || can("rent.record");
  const mayReadFilings = can("money.view") || can("lease.advance");
  // A null workspace disables the read, so somebody without the permission
  // never spends a round trip to be told what the array already said.
  const rent = useRentRoll(mayReadMoney ? workspaceId : null);
  const filings = useFilings(mayReadFilings ? workspaceId : null);

  if (!mayReadMoney && !mayReadFilings) {
    return <EmptyState>{reasonFor("money.view")}</EmptyState>;
  }

  // Only wait on a read this caller is actually making. A disabled query stays
  // `pending` for ever, so waiting on one the permissions refuse would leave the
  // screen on skeletons and never move.
  if ((mayReadMoney && rent.isPending) || (mayReadFilings && filings.isPending)) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={72} delay={i * 70} />
        ))}
      </div>
    );
  }

  const now = Date.now();
  const year = Number(todayIso().slice(0, 4));
  const charges = rent.data?.charges ?? [];
  const months = collectedByMonth(charges, year);
  const collected = months.reduce((s, m) => s + m.value, 0);
  const contributing = new Set(
    charges
      .filter((c) => c.periodMonth.startsWith(`${year}-`) && (c.paidAmountRwf ?? 0) > 0)
      .map((c) => c.leaseId),
  ).size;

  const hasRent = mayReadMoney && !rent.isError;
  const rows = filings.data?.filings ?? [];
  const needsYou = rows.filter((f) => f.status === "failed" || f.status === null).length;
  const standIn = rows.some((f) => f.adapterMode === "mock");

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {/* The two figures that come from the rent roll appear only when the
              rent roll answered. A zero above a refusal, or above "we couldn't
              load this", is the screen answering a question it has just said it
              cannot answer. The deadline comes from the calendar, so it is
              always true. */}
          {hasRent && (
            <>
              <StatCard n={fmt(collected)} label={`Rent collected · ${year} to date`} />
              <StatCard n={String(contributing)} label="Tenancies contributing" />
            </>
          )}
          <StatCard n={declarationDueShort(year)} label="Declaration due" />
        </div>

        {!mayReadMoney ? (
          /* Not "no rent collected this year": an empty array from a read that
             never happened is a refusal, and it must be worded as one. */
          <EmptyState>{reasonFor("money.view")}</EmptyState>
        ) : rent.isError ? (
          /* Unreachable is not a year with no rent in it. A landlord shown a
             zero would go looking for money that is not missing. */
          <LoadFailed onRetry={() => void rent.refetch()} retrying={rent.isFetching}>
            We couldn&apos;t load the rent roll, so the year&apos;s total isn&apos;t shown
            here. Every payment is still recorded — this is on our side, not an empty
            year.
          </LoadFailed>
        ) : months.length === 0 ? (
          <EmptyState>
            No rent has been collected in {year} yet. Every payment recorded on the rent
            roll is added up here, month by month, in the shape the declaration asks for.
          </EmptyState>
        ) : (
          <>
            <SectionHeading>
              Rent collected — {year}, month by month
            </SectionHeading>
            <div className={cn(surfaceClass, "overflow-hidden")}>
              <BarList
                className="px-[18px] py-4"
                aria-label={`Rent collected each month of ${year}`}
                rows={months}
              />
              <div className="flex items-center justify-between gap-3 border-t border-line2 bg-field px-[18px] py-3 text-sm font-bold text-foreground">
                <span>Rental income, {year} to date</span>
                <span className="pms-num whitespace-nowrap">{fmt(collected)}</span>
              </div>
            </div>
            <p className="text-2xs text-muted-foreground">
              Rent is a tenancy payment, so none of this produced a tax invoice — this
              summary is the record. Injishi keeps it current so the declaration due{" "}
              {declarationDue(year)} is a read rather than a reconstruction. It does not
              work the tax out or pay it for you, and every payment behind the figure is
              on the Rent roll.
            </p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading n={rows.length}>
          Contract filings — the {CONTRACT_FILING_WINDOW_DAYS} day clock
          {needsYou > 0 ? ` · ${needsYou} need you` : ""}
        </SectionHeading>

        {!mayReadFilings ? (
          <EmptyState>{reasonFor("lease.advance")}</EmptyState>
        ) : filings.isError ? (
          <LoadFailed onRetry={() => void filings.refetch()} retrying={filings.isFetching}>
            We couldn&apos;t load the filing status of your contracts. Nothing has been
            withdrawn — this is on our side.
          </LoadFailed>
        ) : rows.length === 0 ? (
          <EmptyState>
            No tenancies yet. On signing, Injishi files the contract with the tax
            administration within {CONTRACT_FILING_WINDOW_DAYS} days, and each one&apos;s
            progress is listed here.
          </EmptyState>
        ) : (
          <>
            <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
              <div className="min-w-[680px]">
                {rows.map((f, i) => {
                  const clock = clockOf(f, now);
                  return (
                    <div
                      key={f.leaseId}
                      className={cn(
                        "grid items-center gap-2.5 px-[18px] py-2.5",
                        i === 0 ? "border-t border-transparent" : "border-t border-line",
                      )}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <span className="pms-num text-sm font-bold text-ink">
                        {f.unitLabel ?? "—"}
                      </span>
                      <Link
                        href={href(`/leases/${f.leaseId}/contract`)}
                        className="truncate text-sm font-semibold text-foreground no-underline"
                      >
                        {f.tenantName ?? "Tenant"}
                      </Link>
                      <span className="text-2xs text-muted-foreground">{clock.line}</span>
                      <span className="flex justify-end">
                        <Badge intent={clock.intent}>{clock.badge}</Badge>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {standIn && (
              /* A row says "Filed". Nothing in this repository can file a
                 contract with the RRA — there is no channel and no adapter
                 (F-R10 §11, open question O-4) — so the screen says which of
                 the two it is rather than letting a green badge imply a
                 receipt. */
              <p className="text-2xs text-muted-foreground">
                Filing runs through a stand-in today: Injishi has no live connection to
                the tax administration yet, so a contract marked filed here is
                Injishi&apos;s own record and not a receipt from the RRA.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
