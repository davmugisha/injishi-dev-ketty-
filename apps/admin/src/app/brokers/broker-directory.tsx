"use client";

import { Badge, Button } from "@injishi/ui";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { suspendBroker } from "@/lib/actions/brokers";
import { ReasonDialog } from "@/lib/actions/reason-dialog";
import { useAdminUi, useStubAction } from "@/lib/store";
import type { BrokerRow } from "@/lib/types";

/**
 * One directory row: the presented broker plus the id a write is sent to.
 *
 * Beside the view type, not inside it, as everywhere in this console. The rows
 * used to be keyed — and "suspended" — by display name, which two brokers can
 * share and which no route accepts.
 */
export interface BrokerDirectoryRow {
  id: string;
  row: BrokerRow;
}

/**
 * Directory — licensed rental agents, with harvest-anomaly suspension.
 *
 * A CLIENT COMPONENT because suspension is a dialog. The rows are read on the
 * server; the reveal-to-placement judgement that tints a row — ten reveals with
 * nothing placed, a negative credit balance — is `presentBrokerRow`'s, stated
 * once there rather than re-derived here from counts.
 *
 * SUSPEND IS REAL: it asks for a reason and calls
 * `POST /admin/brokers/:brokerId/suspend`. The status column changes because
 * the action re-reads the directory after the platform confirms — it used to
 * flip to "suspended" on click, before anything had been asked of anyone.
 * Reinstating a broker has no route yet and still says so.
 *
 * THE DISTRICT COLUMN IS EMPTY AND STAYS EMPTY. `AdminBrokerRow` carries no
 * coverage; the reveal log knows which districts a broker works but that is a
 * different response, and joining the two in the browser would be this screen
 * inventing a summary from data it was not given.
 */
export function BrokerDirectory({ rows }: { rows: BrokerDirectoryRow[] }) {
  const toast = useAdminUi((s) => s.toast);
  const stubAction = useStubAction();
  const [suspending, setSuspending] = useState<BrokerDirectoryRow | null>(null);

  async function confirm(reason: string): Promise<boolean> {
    if (!suspending) return true;
    const out = await suspendBroker(suspending.id, reason);
    toast(`${suspending.row.name}: ${out.message}`, out.tone);
    return out.ok || out.reason !== "bad_input";
  }

  return (
    <section className="mt-8" aria-label="Broker directory">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Directory — licensed rental agents
      </h2>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          No broker has registered yet. The residence directory opens to brokers
          district by district — an empty roster is a stage, not a fault.
        </div>
      ) : (
        <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">
              Registered brokers with reveal-to-placement performance
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-4">Broker</th>
                <th className="p-4">District activity</th>
                <th className="p-4">Status</th>
                <th className="p-4">Reveals</th>
                <th className="p-4">Placements</th>
                <th className="p-4">Placement fees</th>
                <th className="p-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((entry) => {
                const { id, row } = entry;
                return (
                  <tr key={id} className={row.flagged ? "bg-destructive/5" : ""}>
                    <td className="p-4">
                      <span className="font-semibold">{row.name}</span>
                      <span
                        className={`block text-xs ${
                          row.noteTone === "destructive"
                            ? "text-destructive"
                            : row.noteTone === "warning"
                              ? "text-warning"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.noteTone === "destructive" && (
                          <TriangleAlert className="mr-1 inline h-3 w-3" aria-hidden />
                        )}
                        {row.note}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{row.districts}</td>
                    <td className="p-4">
                      <Badge variant={row.status.intent}>{row.status.text}</Badge>
                    </td>
                    <td
                      className={`money p-4 ${
                        row.revealsTone === "destructive" ? "font-bold text-destructive" : ""
                      }`}
                    >
                      {row.reveals}
                    </td>
                    <td className="money p-4">{row.placements}</td>
                    <td className="money p-4 font-semibold">{row.fees}</td>
                    <td className="p-4 text-right">
                      {row.action.kind === "suspend" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setSuspending(entry)}
                        >
                          Suspend…
                        </Button>
                      )}
                      {row.action.kind === "stub" && (
                        <Button variant="ghost" size="sm" onClick={stubAction(row.action.stub)}>
                          {row.action.label}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Suspension marks the broker suspended and records your reason. Fees already earned against
        activated leases are untouched (<span className="money">F-R08</span>). Reveals with no
        placement are surfaced, not auto-penalized.
      </p>

      <ReasonDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={confirm}
        tone="danger"
        title={`Suspend ${suspending?.row.name ?? "this broker"}?`}
        confirmLabel="Suspend"
        pendingLabel="Suspending…"
        body={
          <p>
            The broker is marked suspended and the audit trail records who did it and why. It can
            be reversed. Nothing in the platform yet refuses a suspended broker on its own — no
            broker-facing reveal or placement route exists to refuse them — so this is the record
            that the first such route must check.
          </p>
        }
      />
    </section>
  );
}
