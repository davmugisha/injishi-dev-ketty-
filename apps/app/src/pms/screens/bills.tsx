"use client";

/**
 * Bills — one live bill per stay (F-P03).
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/folios`, which
 * is gated on `folio.charge` for the READ as well as the write. That is unusual
 * in this app and correct: a bill names a guest, their room and what they have
 * spent, and a housekeeper has no business reading it.
 *
 * **The three stat tiles are honest now.** The demo derived "tax invoices
 * issued today" by counting reservations flagged `closed` in a fixture. A
 * closed FOLIO is not the same thing as an issued invoice — the invoice is the
 * EBM emission, which is not built — so that tile says what it can actually
 * count: bills closed. Naming it "invoices" would claim a tax document exists
 * where none does.
 */

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  StatCard,
  surface,
  tableHeadStyle,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useFolios } from "../data/ops";
import { dshortIso, fmt } from "../lib/format";
import { folioHref } from "../lib/objects";

export function Bills() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useFolios(workspaceId);

  const mayRead = can("folio.charge");

  /*
   * Refused BEFORE the request, because the server refuses it too.
   *
   * The nav already keeps a receptionist off Finance, and a housekeeper off
   * everything but their rooms. This is the second answer for the person who
   * reaches the screen another way — a bookmark, a shared link — and it names
   * the cause rather than showing an empty table.
   */
  if (!mayRead) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        {reasonFor("folio.charge")}
      </EmptyState>
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton height={86} />
        <Skeleton height={220} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a property with no bills. A desk told that
       would stop chasing the balance a guest is about to walk out on. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your bills. Every open bill is still there — this is on our
        side, not an empty list.
      </LoadFailed>
    );
  }

  const folios = query.data?.folios ?? [];
  /*
   * Where a bill opens (ADR-044, D-c): at its one address, which `folioHref`
   * works out from what the bill is for. A guest's bill opens on their stay, or
   * on their reservation before they arrive. A master, group or house bill is
   * for no record, so it opens in Finance. A row with no address yet gets no
   * button rather than a link to a refusal.
   */
  const billHref = (f: (typeof folios)[number]) => folioHref(workspaceId, f);
  const open = folios.filter((f) => f.status === "open");
  const closed = folios.filter((f) => f.status !== "open");
  const outstanding = open.reduce((a, f) => a + f.balanceRwf, 0);

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <StatCard n={String(open.length)} label="Open bills" />
        <StatCard n={fmt(outstanding)} label="Outstanding on open bills" />
        {/* Closed, not "invoiced". The EBM emission is not built, and a tile
            claiming a tax document exists would be the screen inventing one. */}
        <StatCard n={String(closed.length)} label="Bills closed" />
      </div>

      <section>
        <SectionHeading n={open.length}>Open bills</SectionHeading>
        {open.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            No open bills. One opens when a booking is approved, or when a guest walks
            in.
          </EmptyState>
        ) : (
          <div className="pms-tablescroll" style={{ ...surface, marginTop: 10 }}>
            <div style={tableHeadStyle("1.4fr .8fr 1.2fr 1fr auto")}>
              <span>Guest</span>
              <span>Room</span>
              <span>Opened</span>
              <span>Balance</span>
              <span />
            </div>
            {open.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr .8fr 1.2fr 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {f.guestName ?? "Unnamed guest"}
                  </span>
                  <span className="pms-num" style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>
                    {f.folioNumber}
                  </span>
                </span>
                <span className="pms-num" style={{ fontSize: 13 }}>{f.roomLabel ?? "—"}</span>
                <span className="pms-num" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {dshortIso(f.openedAt)}
                </span>
                <span className="pms-num" style={{ fontSize: 14, fontWeight: 700 }}>
                  {fmt(f.balanceRwf)}
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end" }}>
                  <OpenBill to={billHref(f)}>
                    Open bill
                  </OpenBill>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <SectionHeading n={closed.length}>Closed</SectionHeading>
          <div className="pms-tablescroll" style={{ ...surface, marginTop: 10 }}>
            {closed.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {f.guestName ?? "Unnamed guest"}
                  </span>
                  <span className="pms-num" style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>
                    {f.folioNumber}
                    {f.closedAt ? ` · closed ${dshortIso(f.closedAt)}` : ""}
                  </span>
                </span>
                <Badge intent={f.balanceRwf === 0 ? "ok" : "warn"}>
                  {f.balanceRwf === 0 ? "Settled" : fmt(f.balanceRwf)}
                </Badge>
                <OpenBill to={billHref(f)}>
                  View
                </OpenBill>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** A row's way in. A bill with no address yet gets no button (ADR-044, D-a). */
function OpenBill({ to, children }: { to: string | null; children: ReactNode }) {
  const router = useRouter();
  if (!to) return null;
  return <ActionButton onClick={() => router.push(to)}>{children}</ActionButton>;
}
