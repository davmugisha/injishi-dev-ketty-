"use client";

/**
 * Leases (F-R03) — the tenancy pipeline as a board.
 *
 * **On real data** (ADR-035, D-f wave 1). Reads `GET /api/v1/ops/leases` and
 * commands `POST /ops/leases/:id/advance` behind `lease.advance`. The demo store
 * is gone from this screen (D-i).
 *
 * Every tenancy moves left to right and nothing skips a step (blueprint §6.7).
 * The button names the state it is moving TO rather than saying "next", because
 * `AdvanceLeaseRequest` requires that: a blind "next" is how a double click ends
 * a lease that was only meant to be activated, and the server would have no way
 * to tell the second call from a legitimate second step.
 *
 * **TWO THINGS FROM THE DEMO THAT DO NOT SURVIVE CONTACT WITH THE DATA.**
 *
 * "Draft a lease" was a primary button that raised a toast. There is no create
 * route — `/ops/leases` serves a read, an advance and a rent charge, and nothing
 * else — so the button was a promise the app could not keep. It is gone, and
 * drafting is recorded as owed in ADR-035.
 *
 * The rent badge on an active card is gone too. `OperatorLease` carries no
 * payment state, and it should not: rent is a charge per month on the rent roll,
 * which is its own screen and already live. A lease card that said "Overdue"
 * would have been reading a second, staler copy of that fact.
 */

import { Button } from "@injishi/ui";
import type { LeaseStatus, OperatorLease } from "@injishi/contracts";
import Link from "next/link";
import { Badge, LoadFailed, Skeleton } from "../components/ui";
import { ConfirmAction } from "../components/confirm-action";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAdvanceLease, useLeases } from "../data/ops";
import { fmt } from "../lib/format";
import { useWorkspaceHref } from "../lib/workspace-href";
import { usePms } from "../store";

/**
 * The five columns of the pipeline.
 *
 * `cancelled` is the sixth `LeaseStatus` and is deliberately off the board: it
 * is not a stage of a tenancy, it is a tenancy that never happened.
 */
const COLUMNS: { key: LeaseStatus; label: string; empty: string }[] = [
  { key: "draft", label: "Draft", empty: "No drafts." },
  { key: "pending_signature", label: "Awaiting signature", empty: "Nothing waiting." },
  { key: "active", label: "Active", empty: "No active leases." },
  { key: "ending", label: "Ending", empty: "Nothing ending soon." },
  { key: "ended", label: "Ended", empty: "None yet." },
];

/** Where a card goes next, named explicitly, and what the button says. */
const NEXT: Partial<Record<LeaseStatus, { to: LeaseStatus; label: string }>> = {
  draft: { to: "pending_signature", label: "Send for signature" },
  pending_signature: { to: "active", label: "Mark signed — activate" },
  active: { to: "ending", label: "Start move-out" },
  ending: { to: "ended", label: "End the lease" },
};

/**
 * What the tenancy IS once the step has landed, in the tenant's terms.
 *
 * Not an echo of the button. "Kagame — mark signed, activate" told an operator
 * what they had just pressed, which they know; what they cannot see from the
 * board is that the tenancy is now live and rent starts being raised against
 * it.
 */
const ARRIVED: Record<string, (tenant: string) => string> = {
  pending_signature: (t) => `${t}'s lease is out for signature. It goes active once both sides sign.`,
  active: (t) => `${t}'s tenancy is active. Rent is raised against it from now on.`,
  ending: (t) => `${t} is on notice. The deposit goes to review when the tenancy ends.`,
  ended: (t) => `${t}'s tenancy has ended. Their deposit is waiting on the Move-outs board.`,
};

/** A date the operator can act on, or a dash. Never an invented one. */
function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

export function Leases() {
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useLeases(workspaceId);
  const advance = useAdvanceLease(workspaceId);

  const mayAdvance = can("lease.advance");
  const denied = mayAdvance ? undefined : reasonFor("lease.advance");

  function move(lease: OperatorLease, to: LeaseStatus) {
    const tenant = lease.tenantName ?? "This tenant";
    advance.mutate(
      { leaseId: lease.id, to },
      {
        onSuccess: () => toast(ARRIVED[to]?.(tenant) ?? `${tenant}'s lease has moved on.`, "ok"),
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div
        className="pms-enter"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={200} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not an empty portfolio. A landlord told they have no
       leases will not go looking for the one that is ending on Friday. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your leases. Every tenancy is still on file — this is on our
        side, not an empty portfolio.
      </LoadFailed>
    );
  }

  const leases = query.data?.leases ?? [];

  return (
    <div className="pms-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Every tenancy moves left to right — nothing skips a step.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 10,
          alignItems: "start",
        }}
      >
        {COLUMNS.map((col) => {
          const cards = leases.filter((l) => l.status === col.key);
          return (
            <div
              key={col.key}
              style={{
                background: "var(--field)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-surface)",
                padding: 10,
                minHeight: 200,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "2px 4px 8px" }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--muted2)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}
                </span>
                <span className="pms-num" style={{ fontSize: 11, color: "var(--faint)" }}>
                  {cards.length}
                </span>
              </div>

              {cards.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--line2)",
                    borderRadius: 10,
                    padding: "12px 10px",
                    fontSize: 11,
                    color: "var(--faint)",
                  }}
                >
                  {col.empty}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((l) => {
                  const next = NEXT[l.status];
                  // THIS card's wait. `advance.isPending` alone relabelled
                  // every card on the board "Saving…", so a landlord watching
                  // one lease move saw the whole portfolio freeze.
                  const busy = advance.isPending && advance.variables?.leaseId === l.id;
                  const signed = [
                    l.landlordSignedAt ? "landlord signed" : null,
                    l.tenantSignedAt ? "tenant signed" : null,
                  ].filter(Boolean);
                  return (
                    <div
                      key={l.id}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--card-bd)",
                        borderRadius: 12,
                        padding: "11px 12px",
                        opacity: l.status === "ended" ? 0.72 : 1,
                      }}
                    >
                      {/* Index into the record, never the only view of it
                          (ADR-018, AC-9). */}
                      <Link
                        href={href(`/leases/${l.id}`)}
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--foreground)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textDecoration: "none",
                        }}
                      >
                        {l.tenantName ?? "Unnamed tenant"}
                      </Link>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {[l.unitLabel, l.monthlyRentRwf != null ? `${fmt(l.monthlyRentRwf)} / mo` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div
                        className="pms-num"
                        style={{ marginTop: 6, fontSize: 11, color: "var(--faint)", whiteSpace: "nowrap" }}
                      >
                        {`${day(l.startDate)} → ${day(l.endDate)}`}
                      </div>

                      {/* Signatures are what gate going active, so the card
                          says where they stand rather than making the operator
                          open the record to find out. */}
                      {l.status === "pending_signature" && (
                        <div style={{ marginTop: 7 }}>
                          <Badge intent={signed.length === 2 ? "ok" : "warn"}>
                            {signed.length === 0 ? "No signatures yet" : signed.join(" · ")}
                          </Badge>
                        </div>
                      )}

                      {next &&
                        (next.to === "ended" ? (
                          /* Ending a tenancy is the one step on this board that
                             nothing here undoes: the deposit goes to review and
                             the unit comes back on the market. It asks once, in
                             place — no dialog, because the rest of the board
                             stays one press. */
                          <ConfirmAction
                            className="mt-2.5 w-full"
                            fullWidth
                            onConfirm={() => move(l, next.to)}
                            confirmLabel="Yes, end the tenancy"
                            deniedReason={denied}
                            pending={busy}
                          >
                            {busy ? "Ending the lease" : next.label}
                          </ConfirmAction>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => !denied && !busy && move(l, next.to)}
                            aria-disabled={denied ? true : undefined}
                            title={denied}
                            pending={busy}
                            style={{
                              marginTop: 9,
                              width: "100%",
                              minHeight: 34,
                              border: "1px solid var(--card-bd)",
                              background: "var(--panel)",
                              color: "var(--foreground)",
                              borderRadius: 9,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: denied ? "not-allowed" : "pointer",
                              opacity: denied ? 0.5 : 1,
                            }}
                          >
                            {next.label}
                          </Button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
