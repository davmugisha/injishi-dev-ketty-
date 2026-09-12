"use client";

import { Badge, Button } from "@injishi/ui";

import { useAdminUi } from "@/lib/store";
import type { OboRegistration } from "@/lib/types";
import { notBuilt } from "@/lib/not-built";

/**
 * OBO oversight — money stays locked until the owner claims (FL02).
 *
 * A client component only for the re-send button's toast; the rows are read on
 * the server, and the claim badge — including whether the payout is still
 * locked — is worded by `presentObo`.
 *
 * NO "invite re-sent" BADGE. It used to replace the button with a green one on
 * click, beside a toast saying nothing had been sent: the row claimed a success
 * the toast denied. The button stays until a re-send route exists.
 *
 * THE PAYOUT COLUMN IS GONE. It rendered a hardcoded "locked" badge on every
 * row, which was true of the fixture and is not true of a claimed registration.
 * `OboRegistration` carries no payout field: `presentObo` folds the lock into
 * the claim badge and drops it once the owner has claimed, precisely so the
 * console cannot show a lock that has already been released.
 */
export function OboTable({ rows }: { rows: OboRegistration[] }) {
  const toast = useAdminUi((s) => s.toast);

  return (
    <section className="mt-8" aria-label="On-behalf-of registrations">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        OBO oversight — unclaimed{" "}
        <Badge variant="default">money stays locked until the owner claims</Badge>
      </h2>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          Nobody has registered a business on somebody else&apos;s behalf yet.
          When a field agent does, the registration appears here with its payout
          locked until the owner claims it.
        </div>
      ) : (
        <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">On-behalf-of registrations and their claim state</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-4">Org</th>
                <th className="p-4">Registrant (agent)</th>
                <th className="p-4">Intended owner</th>
                <th className="p-4">Claim</th>
                <th className="p-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.org}>
                  <td className="p-4 font-semibold">
                    {row.org}{" "}
                    <span className="font-normal text-muted-foreground">· {row.district}</span>
                  </td>
                  <td className="p-4">
                    {row.agent} <Badge variant="default">field agent</Badge>
                  </td>
                  <td className="p-4">{row.owner}</td>
                  <td className="p-4">
                    <Badge variant={row.claim.intent}>{row.claim.text}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant={row.action.variant}
                      size="sm"
                      onClick={() => toast(notBuilt("Re-sending a claim invitation"))}
                    >
                      {row.action.label}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Admin can see — never override — the payout lock. The claim path is the owner&apos;s alone (
        <span className="money">FL02</span>).
      </p>
    </section>
  );
}
