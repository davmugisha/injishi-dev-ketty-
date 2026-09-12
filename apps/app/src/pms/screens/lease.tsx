"use client";

/**
 * One lease, at its own address (ADR-018, move 3, AC-8).
 *
 * **On real data** (ADR-035, D-f wave 2). Three reads it already had hooks for:
 * `GET /ops/leases` for the lease, `GET /ops/rent-roll` for its months and
 * `GET /ops/deposits` for its caution. The demo store is gone from this screen
 * (D-i). NO new endpoint was needed — the list screens had been live since wave
 * 1 and only this record was still reading `residence.leases`.
 *
 * **THE CAUTION LENS IS THE ONE THAT CHANGES.** The demo carried a boolean —
 * whether the deposit went back — so the lens had to say out loud that it did
 * not know the amount and offer "one month's rent" as a guess. `OperatorDeposit`
 * carries the real figure AND the settlement: what was refunded, what was
 * forfeited, and the reason. A landlord arguing about a deduction can now read
 * it here instead of being told the record does not have it.
 *
 * **The rent lens shows MONTHS, not a status word.** Rent is owed per period —
 * that is why `RecordRentRequest` demands a `periodMonth` — and a single "Due"
 * badge hid which month was in dispute, which is the fact the argument is
 * always about.
 *
 * **Seven lenses, and every lease has all seven.** `move-out` on a lease that
 * has not ended is not a missing page: it is where you go to see that nothing
 * has started, and it is a link a landlord sends a tenant.
 *
 * **Two lenses still have no server behind them and say so.** `filing` needs the
 * rental income declaration endpoint and `visitors` needs a visitor log; neither
 * table is read by anything yet. They state the gap rather than compute a number
 * from rent, because a declared figure that nobody filed is worse than a blank.
 */

import { notFound } from "next/navigation";

import type {
  CautionStatus,
  LeaseStatus,
  OperatorDeposit,
  OperatorLease,
  OperatorRentCharge,
} from "@injishi/contracts";
import { Facts } from "../components/facts";
import { ObjectPage } from "../components/object-page";
import { Badge, EmptyState, LoadFailed, SectionHeading, Skeleton, surfaceClass } from "../components/ui";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "../data/capability";
import { useDeposits, useLeases, useRentRoll } from "../data/ops";
import { fmt } from "../lib/format";
import { lensesFor } from "../lib/objects";

type Intent = "ok" | "warn" | "bad" | "info" | "neutral";

/**
 * The six `LeaseStatus` values, worded as the pipeline board words them.
 *
 * `cancelled` is here even though the board leaves it out: a board is a list of
 * stages to work through, but a RECORD must be able to open whatever it is.
 */
const STATE: Record<LeaseStatus, { label: string; intent: Intent }> = {
  draft: { label: "Draft", intent: "neutral" },
  pending_signature: { label: "Awaiting signature", intent: "warn" },
  active: { label: "Active", intent: "ok" },
  ending: { label: "Ending", intent: "warn" },
  ended: { label: "Ended", intent: "neutral" },
  cancelled: { label: "Cancelled", intent: "neutral" },
};

const RENT_INTENT: Record<string, Intent> = {
  paid: "ok",
  due: "warn",
  overdue: "bad",
};

const CAUTION_LABEL: Record<CautionStatus, { label: string; intent: Intent }> = {
  held: { label: "Held", intent: "info" },
  refunded: { label: "Returned", intent: "ok" },
  forfeited: { label: "Forfeited", intent: "warn" },
};

/** A date the operator can act on, or a dash. Never an invented one. */
function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

/** `RWF 250,000`, or a dash where the server holds no figure. */
function money(n: number | null): string {
  return n === null ? "—" : fmt(n);
}

/** `Sep 2026` from the first-of-month date the server sends. */
function month(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function LeaseRecord({ id, lens }: { id: string; lens: string }) {
  const workspaceId = useWorkspaceId();
  const leases = useLeases(workspaceId);

  if (leases.isPending) return <Skeleton height={320} />;

  if (leases.isError) {
    /* An unreachable API is not a lease that was never signed. A 404 here would
       tell a landlord their tenancy does not exist. */
    return (
      <LoadFailed onRetry={() => void leases.refetch()} retrying={leases.isFetching}>
        We couldn&apos;t load this lease. The tenancy is on file — this is on our side, not
        a missing agreement.
      </LoadFailed>
    );
  }

  const lease = (leases.data?.leases ?? []).find((l) => l.id === id);
  // Only once the list has really answered. A 404 while the read is in flight
  // would refuse a lease that is about to arrive.
  if (!lease) notFound();

  const subtitle = [
    lease.unitLabel ?? "No unit",
    lease.monthlyRentRwf === null ? null : `${fmt(lease.monthlyRentRwf)} per month`,
    lease.startDate || lease.endDate ? `${day(lease.startDate)} to ${day(lease.endDate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ObjectPage
      title={lease.tenantName ?? "Unnamed tenant"}
      subtitle={subtitle}
      status={STATE[lease.status]}
      lenses={lensesFor(workspaceId, "leases", id)}
      active={lens}
    >
      <LensBody lens={lens} lease={lease} workspaceId={workspaceId} />
    </ObjectPage>
  );
}

function LensBody({
  lens,
  lease,
  workspaceId,
}: {
  lens: string;
  lease: OperatorLease;
  workspaceId: string | null;
}) {
  switch (lens) {
    case "contract":
      return <Contract lease={lease} />;
    case "rent":
      return <Rent lease={lease} workspaceId={workspaceId} />;
    case "caution":
      return <Caution lease={lease} workspaceId={workspaceId} />;
    case "filing":
      return (
        <EmptyState>
          Rental income declarations aren&apos;t part of Injishi yet. When they are, what
          you declared for this unit and when the next filing is due will be here — we
          won&apos;t work a figure out from the rent, because that would read as filed when
          nothing was.
        </EmptyState>
      );
    case "move-out":
      return <MoveOut lease={lease} workspaceId={workspaceId} />;
    case "visitors":
      return (
        <EmptyState>
          No visitor log on this tenancy yet. Keeping one is a residence requirement, and
          Injishi can&apos;t record visits for you yet — each visit will be listed here
          once it can.
        </EmptyState>
      );
    default:
      return <Contract lease={lease} overview />;
  }
}

function Contract({ lease, overview = false }: { lease: OperatorLease; overview?: boolean }) {
  /*
   * BOTH SIGNATURES ARE SHOWN, not a single "signed" word. Going active is
   * gated on the pair, so which one is missing is the only useful fact when a
   * lease is stuck at Awaiting signature.
   */
  const signed = [lease.landlordSignedAt, lease.tenantSignedAt].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <Facts
        items={[
          { label: "Tenant", value: lease.tenantName ?? "Not recorded" },
          { label: "Unit", value: lease.unitLabel ?? "Not recorded", numeric: true },
          { label: "Starts", value: day(lease.startDate), numeric: true },
          { label: "Ends", value: day(lease.endDate), numeric: true },
          { label: "Rent", value: `${money(lease.monthlyRentRwf)} per month`, numeric: true },
          { label: "Caution agreed", value: money(lease.cautionRwf), numeric: true },
          { label: "State", value: STATE[lease.status].label },
          ...(overview ? [{ label: "Reference", value: lease.id, numeric: true }] : []),
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge intent={signed === 2 ? "ok" : "warn"}>
          {signed} of 2 signatures
        </Badge>
        <span className="text-2xs text-muted-foreground">
          Landlord {lease.landlordSignedAt ? day(lease.landlordSignedAt) : "not signed"} ·
          Tenant {lease.tenantSignedAt ? day(lease.tenantSignedAt) : "not signed"}
        </span>
      </div>
    </div>
  );
}

const RENT_COLS = "minmax(110px,1fr) minmax(110px,1fr) minmax(110px,1fr) auto";

function Rent({ lease, workspaceId }: { lease: OperatorLease; workspaceId: string | null }) {
  const query = useRentRoll(workspaceId);

  if (query.isPending) return <Skeleton height={200} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load the rent for this lease. Nothing has been written off — this
        is on our side, not a lease with nothing owed.
      </LoadFailed>
    );
  }

  /*
   * Filtered from the WORKSPACE rent roll rather than fetched per lease. The
   * whole roll is one read the Rent roll screen already makes, so opening a
   * record costs nothing extra and the two screens cannot disagree.
   */
  const months = (query.data?.charges ?? [])
    .filter((c) => c.leaseId === lease.id)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

  if (months.length === 0) {
    return (
      <EmptyState>
        No rent has been charged on this lease yet. Months appear here once they are
        raised.
      </EmptyState>
    );
  }

  const outstanding = months
    .filter((c) => c.status !== "paid")
    .reduce((sum, c) => sum + ((c.amountRwf ?? 0) - (c.paidAmountRwf ?? 0)), 0);

  return (
    <div className="flex flex-col gap-3">
      <Facts
        items={[
          { label: "Monthly rent", value: money(lease.monthlyRentRwf), numeric: true },
          { label: "Months raised", value: String(months.length), numeric: true },
          { label: "Outstanding", value: fmt(outstanding), numeric: true },
        ]}
      />

      <SectionHeading n={months.length}>Months</SectionHeading>
      <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
        <div className="min-w-[520px]">
          {months.map((c: OperatorRentCharge, i) => (
            <div
              key={c.id}
              className={cn(
                "grid items-center gap-2.5 px-[18px] py-3",
                i === 0 ? "border-t border-transparent" : "border-t border-line",
              )}
              style={{ gridTemplateColumns: RENT_COLS }}
            >
              <span className="text-sm font-semibold text-ink">{month(c.periodMonth)}</span>
              <span className="text-sm text-ink">{money(c.amountRwf)}</span>
              <span className="text-2xs text-muted-foreground">
                {/* Zero reads as nothing paid, not as "RWF 0 paid". The server
                    defaults the column to 0 rather than null, so both mean the
                    same thing to a tenant. */}
                {c.paidAmountRwf ? `${fmt(c.paidAmountRwf)} paid` : "Nothing paid"}
              </span>
              <span className="flex justify-end">
                <Badge intent={RENT_INTENT[c.status] ?? "neutral"}>{c.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The one deposit on this lease, or null while none is held. */
function depositFor(
  deposits: OperatorDeposit[] | undefined,
  leaseId: string,
): OperatorDeposit | null {
  return (deposits ?? []).find((d) => d.leaseId === leaseId) ?? null;
}

function Caution({ lease, workspaceId }: { lease: OperatorLease; workspaceId: string | null }) {
  const query = useDeposits(workspaceId);

  if (query.isPending) return <Skeleton height={180} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load the deposit. It is still held — this is on our side, not a
        lease with no caution.
      </LoadFailed>
    );
  }

  const deposit = depositFor(query.data?.deposits, lease.id);

  if (deposit === null) {
    return (
      <EmptyState>
        No caution is held on this lease. The agreed figure is{" "}
        {money(lease.cautionRwf)}; it appears here once it is taken.
      </EmptyState>
    );
  }

  const state = CAUTION_LABEL[deposit.status];

  return (
    <div className="flex flex-col gap-3">
      <Facts
        items={[
          { label: "Held", value: money(deposit.amountRwf), numeric: true },
          { label: "Taken", value: day(deposit.heldAt), numeric: true },
          { label: "State", value: state.label },
          { label: "Agreed on the lease", value: money(lease.cautionRwf), numeric: true },
        ]}
      />

      {deposit.settlement === null ? (
        <EmptyState>
          Nothing has been settled. When the tenant moves out, what goes back and what
          is kept is recorded here with the reason.
        </EmptyState>
      ) : (
        <>
          <SectionHeading>Settlement</SectionHeading>
          <Facts
            items={[
              { label: "Returned", value: money(deposit.settlement.refundedRwf), numeric: true },
              { label: "Kept", value: money(deposit.settlement.forfeitedRwf), numeric: true },
              { label: "Settled", value: day(deposit.settlement.settledAt), numeric: true },
              { label: "Reason", value: deposit.settlement.reason ?? "None recorded" },
            ]}
          />
        </>
      )}
    </div>
  );
}

function MoveOut({ lease, workspaceId }: { lease: OperatorLease; workspaceId: string | null }) {
  const query = useDeposits(workspaceId);
  const moving = lease.status === "ending" || lease.status === "ended";

  if (!moving) {
    return (
      <EmptyState>
        Nothing to do. {lease.tenantName ?? "This tenant"} is not moving out. When notice
        is given this fills with the end date, the deposit and what was settled.
      </EmptyState>
    );
  }

  const deposit = query.isSuccess ? depositFor(query.data?.deposits, lease.id) : null;

  return (
    <div className="flex flex-col gap-3">
      <Facts
        items={[
          { label: "Lease ends", value: day(lease.endDate), numeric: true },
          { label: "Stage", value: STATE[lease.status].label },
          {
            label: "Deposit",
            /* "None held" used to cover three different answers: still asking,
               could not ask, and genuinely nothing held. Telling a landlord no
               deposit is held on a tenancy that is ending is how money stays
               with the wrong person. */
            value: query.isPending
              ? "Checking…"
              : query.isError
                ? "Couldn't be read just now"
                : deposit === null
                  ? "None held"
                  : CAUTION_LABEL[deposit.status].label,
          },
        ]}
      />
      {/* The return itself is a money command with its own permission and its
          own Idempotency-Key (D-h); it lives on Move-outs, not here. */}
      <EmptyState>
        Returning the deposit is done on the Move-outs board, where the deduction and
        the amount are entered together.
      </EmptyState>
    </div>
  );
}
