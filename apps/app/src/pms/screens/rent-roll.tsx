"use client";

/**
 * Rent roll (F-R05) — paid / due / overdue across active tenancies. Rent is a
 * tenancy payment: it never produces a tax invoice (the Residence invariant,
 * blueprint §4). Deposits stay held until move-out review.
 *
 * **On real data** (ADR-012 step 5), and it is the screen that proves AC-14:
 * `Record payment` sends an `Idempotency-Key`, so a retry on a patchy office
 * connection records the money once. A rent payment recorded twice tells a
 * tenant they owe nothing when they do, and nothing on the screen would show it.
 *
 * One row per tenancy, showing its NEWEST rent period. The read returns every
 * period a lease has ever had; a rent roll is a "where does each tenancy stand
 * today" list, not a ledger, and the ledger is its own screen.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceHref } from "../lib/workspace-href";
import { usePms } from "../store";
import type { OperatorRentCharge } from "@injishi/contracts";
import type { RentState } from "../data/types";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useDeposits, useRecordRent, useRentRoll } from "../data/ops";
import { dshortIso, fmt } from "../lib/format";
import { ActionButton, Badge, Chip, EmptyState, LoadFailed, Skeleton, StatCard } from "../components/ui";
import { ConfirmAction } from "../components/confirm-action";

type Filter = "all" | RentState;

const RANK: Record<RentState, number> = { overdue: 0, due: 1, paid: 2 };

/** One tenancy's line on the roll, from either source. */
interface RollRow {
  key: string;
  leaseId: string;
  unit: string;
  tenant: string;
  subtitle: string;
  rentRwf: number;
  depositRwf: number;
  pay: RentState;
  payLine: string;
  /** The month this line is about. Absent on a demo row. */
  periodMonth?: string;
  /** What is still owed for that month, which is what a payment records. */
  outstandingRwf: number;
  source: "live" | "demo";
}

const COLS =
  "minmax(64px,.7fr) minmax(150px,1.4fr) minmax(110px,1fr) minmax(110px,1.1fr) minmax(100px,1fr) auto";

export function RentRoll() {
  const { state, dispatch, toast, toastError } = usePms();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const P = state.db.residence;
  const [filter, setFilter] = useState<Filter>("all");

  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const rentRoll = useRentRoll(workspaceId);
  const deposits = useDeposits(workspaceId);
  const recordRent = useRecordRent(workspaceId);

  const live = workspaceId !== null;
  const denied = can("rent.record") ? undefined : reasonFor("rent.record");

  const heldByLease = new Map(
    (deposits.data?.deposits ?? [])
      .filter((d) => d.status === "held")
      .map((d) => [d.leaseId, d.amountRwf ?? 0]),
  );

  const rows: RollRow[] = live
    ? newestPerLease(rentRoll.data?.charges ?? []).map((c) =>
        fromServer(c, heldByLease.get(c.leaseId) ?? 0),
      )
    : fromDemoStore(P);

  const paid = rows.filter((r) => r.pay === "paid");
  const overdue = rows.filter((r) => r.pay === "overdue");
  const collected = paid.reduce((a, r) => a + r.rentRwf, 0);
  const expected = rows.reduce((a, r) => a + r.rentRwf, 0);
  const depositsHeld = rows.reduce((a, r) => a + r.depositRwf, 0);

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "paid", label: "Paid", n: paid.length },
    { key: "due", label: "Due", n: rows.filter((r) => r.pay === "due").length },
    { key: "overdue", label: "Overdue", n: overdue.length },
  ];

  const list = rows
    .filter((r) => filter === "all" || r.pay === filter)
    .sort((a, b) => RANK[a.pay] - RANK[b.pay]);

  function record(row: RollRow) {
    if (row.source === "demo") {
      dispatch({ type: "recordRent", id: row.leaseId });
      return;
    }
    recordRent.mutate(
      {
        leaseId: row.leaseId,
        periodMonth: row.periodMonth as string,
        amountRwf: row.outstandingRwf,
      },
      {
        onSuccess: (charge) =>
          toast(
            `${fmt(row.outstandingRwf)} recorded. ${row.unit} is paid up for ${dshortIso(charge.periodMonth)}.`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  if (live && rentRoll.isPending) {
    return (
      <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={54} delay={i * 70} />
        ))}
      </div>
    );
  }

  if (live && rentRoll.isError) {
    /* AC-13: a failed read is not "nobody owes anything". A landlord told the
       roll is empty stops chasing rent that is genuinely overdue. */
    return (
      <LoadFailed onRetry={() => void rentRoll.refetch()} retrying={rentRoll.isFetching}>
        We couldn&apos;t load your rent roll. Nothing has been written off — this is on
        our side, not an empty book.
      </LoadFailed>
    );
  }

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <Chip key={c.key} label={c.label} n={c.n} active={filter === c.key} onClick={() => setFilter(c.key)} />
        ))}
        <span style={{ flex: 1 }} />
        {/* The month, only when a row actually names one. It used to fall back
            to "July 2026", a month typed into the source: on the demo store,
            and on a live roll with no charges raised yet, the screen stated a
            period nothing on it was about. */}
        <span style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
          {[live && rows[0]?.periodMonth ? dshortIso(rows[0].periodMonth) : null, "Africa/Kigali"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <StatCard n={fmt(collected)} label={`Collected of ${fmt(expected)} expected`} />
        <StatCard n={String(overdue.length)} label="Overdue tenancies — chase these first" />
        <StatCard n={fmt(depositsHeld)} label="Deposits held — returned at move-out" />
      </div>

      {list.length === 0 ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>No tenancies in this view.</EmptyState>
      ) : (
        <div style={{ border: "1px solid var(--panel-bd)", background: "var(--card)", borderRadius: "var(--radius-surface)", overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "11px 18px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted2)", borderBottom: "1px solid var(--line)" }}>
              <span>Unit</span>
              <span>Tenant</span>
              <span style={{ textAlign: "right" }}>Rent / month</span>
              <span>This month</span>
              <span style={{ textAlign: "right" }}>Deposit held</span>
              <span />
            </div>
            {list.map((r, i) => (
              <div key={r.key} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center", padding: "10px 18px", borderTop: `1px solid ${i === 0 ? "transparent" : "var(--line)"}` }}>
                <span className="pms-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap" }}>{r.unit}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.tenant}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{r.subtitle}</span>
                </span>
                <span className="pms-num" style={{ fontSize: 13, color: "var(--ink2)", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(r.rentRwf)}</span>
                <span>
                  <Badge intent={r.pay === "paid" ? "ok" : r.pay === "due" ? "info" : "bad"}>{r.payLine}</Badge>
                </span>
                <span className="pms-num" style={{ fontSize: 13, color: "var(--ink2)", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(r.depositRwf)}</span>
                <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {r.pay === "paid" ? (
                    <ActionButton onClick={() => router.push(href(`/leases/${r.leaseId}`))} style={{ minWidth: 118 }}>View lease</ActionButton>
                  ) : (
                    <>
                      {/* "Remind" used to toast "Reminder sent by SMS" and send
                          nothing at all — no SMS adapter is wired to this
                          screen — so a landlord could believe a tenant had been
                          chased for weeks. It says what is true instead, and
                          the lease is one press away for chasing by hand. */}
                      <ActionButton
                        onClick={() =>
                          r.pay === "overdue"
                            ? toast(
                                `SMS reminders aren't connected yet — nothing was sent to ${r.tenant}. Their number is on the lease.`,
                                "neutral",
                              )
                            : router.push(href(`/leases/${r.leaseId}`))
                        }
                      >
                        {r.pay === "overdue" ? "Remind" : "View lease"}
                      </ActionButton>
                      {/* Money, and a second press records a second month's
                          rent against a tenant who has paid one. It asks. */}
                      <ConfirmAction
                        variant="primary"
                        tone="primary"
                        onConfirm={() => record(r)}
                        confirmLabel={`Yes, record ${fmt(r.outstandingRwf)}`}
                        deniedReason={denied}
                        pending={recordRent.isPending && recordRent.variables?.leaseId === r.leaseId}
                        style={{ minWidth: 118 }}
                      >
                        {recordRent.isPending && recordRent.variables?.leaseId === r.leaseId
                          ? "Recording"
                          : "Record payment"}
                      </ConfirmAction>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--muted)" }}>Rent is a tenancy payment — it never produces a tax invoice. Deposits stay held until move-out review.</p>
    </div>
  );
}

/**
 * The newest rent period for each lease.
 *
 * The read returns every period a lease has ever had, newest first, so
 * first-one-wins gives the line a rent roll is actually about. Showing every
 * period would turn a twelve tenancy building into a hundred row list where the
 * overdue one is impossible to find.
 */
function newestPerLease(charges: OperatorRentCharge[]): OperatorRentCharge[] {
  const seen = new Set<string>();
  const out: OperatorRentCharge[] = [];
  for (const c of charges) {
    if (seen.has(c.leaseId)) continue;
    seen.add(c.leaseId);
    out.push(c);
  }
  return out;
}

function fromServer(c: OperatorRentCharge, depositRwf: number): RollRow {
  const owed = c.amountRwf ?? 0;
  const paidSoFar = c.paidAmountRwf ?? 0;
  const outstanding = Math.max(0, owed - paidSoFar);

  // `overdue` is the row's own status, set by whatever raised the charge. It is
  // never recomputed here from a due date: two places deciding what "overdue"
  // means is how a screen and a reminder job start disagreeing.
  const pay: RentState = c.status;
  const payLine =
    pay === "paid"
      ? `Paid ${c.paidAt ? dshortIso(c.paidAt.slice(0, 10)) : ""}`.trim()
      : paidSoFar > 0
        ? `${fmt(outstanding)} still owed`
        : pay === "overdue"
          ? `Overdue since ${c.dueDate ? dshortIso(c.dueDate) : "the due date"}`
          : `Due ${c.dueDate ? dshortIso(c.dueDate) : ""}`.trim();

  return {
    key: c.id,
    leaseId: c.leaseId,
    unit: c.unitLabel ?? "—",
    tenant: c.tenantName ?? "Tenant",
    subtitle: dshortIso(c.periodMonth),
    rentRwf: owed,
    depositRwf,
    pay,
    payLine,
    periodMonth: c.periodMonth,
    outstandingRwf: outstanding,
    source: "live",
  };
}

/** The demo store's tenancies, unchanged in behaviour from before. */
function fromDemoStore(P: ReturnType<typeof usePms>["state"]["db"]["residence"]): RollRow[] {
  return P.leases
    .filter((l) => l.st === "active" || l.st === "ending")
    .map((l) => ({
      key: l.id,
      leaseId: l.id,
      unit: l.unit,
      tenant: l.tenant,
      subtitle: P.units.find((x) => x.id === l.unit)?.type ?? "",
      rentRwf: l.rent,
      depositRwf: l.rent,
      pay: (l.pay ?? "due") as RentState,
      payLine: l.payLine ?? "",
      outstandingRwf: l.rent,
      source: "demo" as const,
    }));
}
