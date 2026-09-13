"use client";

/**
 * Live orders (F-P07a) — the room service, spa and laundry board.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/service-orders`
 * and commands `POST /ops/service-orders/:id/advance` behind `order.advance`.
 * The demo store is gone from this screen (D-i).
 *
 * **REACHING `delivered` POSTS THE FOLIO CHARGE**, on the server, in the same
 * transaction as the status change — so the bill can never disagree with the
 * board. The demo said the same thing in a comment and did it in a reducer; the
 * difference is that this one survives a refresh, and the guest is actually
 * billed.
 *
 * **The department filter now reads the ORDERS, not a fixture.** It used to
 * offer `P.departments` filtered down to two hardcoded English names, which is
 * the same class of bug D-a fixed in the nav. Every order carries its own
 * `departmentName`, resolved server side from the items — an item knows its
 * department, so a club sandwich cannot be routed to Engineering.
 */

import { Button } from "@injishi/ui";
import type { OperatorServiceOrder, ServiceOrderStatus } from "@injishi/contracts";
import { useState } from "react";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAdvanceServiceOrder, useMarkOrderPaidCash, useServiceOrders } from "../data/ops";
import { fmt } from "../lib/format";
import { usePms } from "../store";

/**
 * The five columns of the board, and where the other statuses land.
 *
 * `completed` sits with `delivered` because to a desk they are the same
 * answer. `cancelled`, `rejected` and `payment_failed` are off the board: an
 * order that was refused, or whose money never came, is not a stage of
 * preparing it, and leaving it in a column would have somebody try to deliver it.
 *
 * **Awaiting payment comes first** (ADR-050 D-n). A pay now order does not
 * reach the kitchen until its money settles: by mobile money on its own, or in
 * cash, which somebody at the counter marks here.
 */
const COLUMNS: {
  key: string;
  label: string;
  holds: ServiceOrderStatus[];
  empty: string;
}[] = [
  {
    key: "unpaid",
    label: "Awaiting payment",
    holds: ["pending_payment"],
    empty: "Nothing waiting to be paid. A walk in order that pays at the counter waits here.",
  },
  {
    key: "new",
    label: "New",
    holds: ["submitted"],
    empty: "No new orders. Guests order from the app in their room.",
  },
  {
    key: "prep",
    label: "Preparing",
    holds: ["acknowledged", "in_progress"],
    empty: "Nothing being prepared.",
  },
  { key: "way", label: "Ready", holds: ["ready"], empty: "Nothing waiting to go out." },
  {
    key: "done",
    label: "Delivered",
    holds: ["delivered", "completed"],
    empty: "Nothing delivered yet today.",
  },
];

/** Where an order goes next, and what the button says. */
const NEXT: Partial<Record<ServiceOrderStatus, { to: ServiceOrderStatus; label: string }>> = {
  submitted: { to: "acknowledged", label: "Accept" },
  acknowledged: { to: "in_progress", label: "Start preparing" },
  in_progress: { to: "ready", label: "Mark ready" },
  // The one that moves money. Named so nobody presses it by accident.
  ready: { to: "delivered", label: "Delivered — add to bill" },
};

/**
 * Where the ORDER stands once the step has landed — what the guest is waiting
 * for, not which button was pressed.
 */
const ARRIVED: Partial<Record<ServiceOrderStatus, (where: string) => string>> = {
  acknowledged: (w) => `${w}'s order is accepted. The kitchen has it.`,
  in_progress: (w) => `${w}'s order is being prepared.`,
  ready: (w) => `${w}'s order is ready to go up.`,
};

export function Orders() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useServiceOrders(workspaceId);
  const advance = useAdvanceServiceOrder(workspaceId);
  const markCash = useMarkOrderPaidCash(workspaceId);
  const [dept, setDept] = useState("all");

  const mayAdvance = can("order.advance");
  const denied = mayAdvance ? undefined : reasonFor("order.advance");
  const cashDenied = can("folio.payment") ? undefined : reasonFor("folio.payment");

  function move(order: OperatorServiceOrder, to: ServiceOrderStatus) {
    // "Room 12" where there is a room, the order number otherwise — the same
    // thing the card leads with, so the toast names what the operator looked at.
    const where = order.roomLabel ? `Room ${order.roomLabel}` : order.orderNumber;
    advance.mutate(
      { orderId: order.id, to },
      {
        onSuccess: () =>
          toast(
            to === "delivered"
              ? order.orderContext === "pay_now"
                ? `${where} is delivered. It was already paid.`
                : `${where} is delivered. ${fmt(order.totalRwf)} is on the guest's bill.`
              : (ARRIVED[to]?.(where) ?? `${where}'s order has moved on.`),
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  /**
   * Cash at the counter (ADR-050 D-p, AC-24). The total is sent as the amount
   * taken, which the server checks to the franc, and the server records who
   * pressed this. It is the one button on the board that declares a sale.
   */
  function paidInCash(order: OperatorServiceOrder) {
    markCash.mutate(
      { orderId: order.id, amountRwf: order.totalRwf },
      {
        onSuccess: () =>
          toast(`${order.orderNumber} is paid, ${fmt(order.totalRwf)} in cash. It is with the kitchen now.`, "ok"),
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div
        className="pms-enter"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={220} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not an empty board. A guest waiting on room service is
       exactly who this failure hurts. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your orders. Anything a guest has ordered is still on the
        board — this is on our side, not an empty kitchen.
      </LoadFailed>
    );
  }

  const orders = query.data?.orders ?? [];
  // From the orders themselves, not from a fixture of department names.
  const depts = [...new Set(orders.map((o) => o.departmentName).filter(Boolean))] as string[];
  const shown = dept === "all" ? orders : orders.filter((o) => o.departmentName === dept);

  return (
    <div className="pms-enter">
      {depts.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {["all", ...depts].map((d) => {
            const on = dept === d;
            return (
              <Button
                variant="ghost"
                key={d}
                onClick={() => setDept(d)}
                aria-pressed={on}
                style={{
                  border: `1.5px solid ${on ? "var(--accent-text)" : "var(--card-bd)"}`,
                  background: on ? "var(--accent-soft)" : "var(--card)",
                  color: on ? "var(--accent-text)" : "var(--ink2)",
                  borderRadius: 999,
                  padding: "8px 15px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {d === "all" ? "All departments" : d}
              </Button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {COLUMNS.map((col) => {
          const cards = shown.filter((o) => col.holds.includes(o.status));
          return (
            <div
              key={col.key}
              style={{
                background: "var(--field)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-surface)",
                padding: 10,
                minHeight: 220,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "2px 4px 8px" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted2)",
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
                    padding: "14px 12px",
                    fontSize: 11.5,
                    color: "var(--faint)",
                  }}
                >
                  {col.empty}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((o) => {
                  const next = NEXT[o.status];
                  // This card's wait, not the board's: one pending order used
                  // to relabel every ticket in every column "Saving…".
                  const busy = advance.isPending && advance.variables?.orderId === o.id;
                  return (
                    <div
                      key={o.id}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--card-bd)",
                        borderRadius: 12,
                        padding: "11px 12px",
                        opacity: col.key === "done" ? 0.72 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                        <span className="pms-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                          {o.roomLabel ? `Room ${o.roomLabel}` : o.orderNumber}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)" }}>
                          {o.departmentName ?? ""}
                        </span>
                      </div>

                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                        {o.items.map((it) => (
                          <div
                            key={it.id}
                            style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)" }}
                          >
                            {/* The SNAPSHOT, not today's menu name. An order
                                keeps what it was ordered as (D8). */}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {it.quantity} × {it.nameSnapshot}
                            </span>
                            <span className="pms-num">{fmt(it.lineTotalRwf)}</span>
                          </div>
                        ))}
                      </div>

                      {o.guestNote && (
                        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>
                          “{o.guestNote}”
                        </div>
                      )}

                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Badge intent={col.key === "done" ? "ok" : "info"}>{fmt(o.totalRwf)}</Badge>
                        {o.orderContext === "pay_now" && (
                          <Badge intent={o.paidAt ? "ok" : "warn"}>
                            {o.paidAt
                              ? o.paymentMethod === "01"
                                ? "Paid in cash"
                                : "Paid by mobile money"
                              : "Pay now"}
                          </Badge>
                        )}
                        <span style={{ flex: 1 }} />
                      </div>

                      {o.status === "pending_payment" && (
                        <ActionButton
                          variant="primary"
                          deniedReason={cashDenied}
                          pending={markCash.isPending && markCash.variables?.orderId === o.id}
                          onClick={() => paidInCash(o)}
                          className="mt-2 w-full"
                          aria-label={`Mark ${o.orderNumber} paid in cash, ${fmt(o.totalRwf)}`}
                        >
                          Paid in cash · {fmt(o.totalRwf)}
                        </ActionButton>
                      )}

                      {next && (
                        <Button
                          variant="ghost"
                          onClick={() => !denied && !busy && move(o, next.to)}
                          aria-disabled={denied ? true : undefined}
                          title={denied}
                          pending={busy}
                          style={{
                            marginTop: 9,
                            width: "100%",
                            minHeight: 34,
                            border: next.to === "delivered" ? "none" : "1px solid var(--card-bd)",
                            background: next.to === "delivered" ? "var(--accent)" : "var(--panel)",
                            color: next.to === "delivered" ? "var(--accent-ink)" : "var(--foreground)",
                            borderRadius: 9,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: denied ? "not-allowed" : "pointer",
                            opacity: denied ? 0.5 : 1,
                          }}
                        >
                          {next.to === "delivered" && o.orderContext === "pay_now"
                            ? "Delivered"
                            : next.label}
                        </Button>
                      )}
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
