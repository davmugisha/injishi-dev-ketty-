"use client";

import { Badge, Button } from "@injishi/ui";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { reissueClaimCode } from "@/lib/actions/users";
import { ReasonDialog } from "@/lib/actions/reason-dialog";
import { useAdminUi, useStubAction } from "@/lib/store";
import type { UnclaimedStay } from "@/lib/types";

/** One row: the presented stay plus the stay id a write is sent to. */
export interface UnclaimedStayRow {
  id: string;
  stay: UnclaimedStay;
}

/**
 * Unclaimed walk-in stays — identity-bearing records without a User (F-B10).
 *
 * Which stays are here, and whether a claim code can be reissued at all, is
 * decided on the server: `presentUnclaimedStay` withholds the reissue action
 * when no identity was captured, because a claim then has nowhere to go.
 *
 * RE-ISSUE IS REAL: it asks for a reason and calls
 * `POST /admin/users/stays/:stayId/reissue-claim`. The new code is shown on the
 * row only once the platform has returned it — the old "new code issued" badge
 * appeared on click, beside a code that did not exist. It stays on screen
 * because a toast is gone before a staffer can read a code aloud to a guest.
 */
export function UnclaimedStays({ stays }: { stays: UnclaimedStayRow[] }) {
  const toast = useAdminUi((s) => s.toast);
  const stubAction = useStubAction();
  const [issued, setIssued] = useState<Map<string, string>>(new Map());
  const [reissuing, setReissuing] = useState<UnclaimedStayRow | null>(null);

  async function confirm(reason: string): Promise<boolean> {
    if (!reissuing) return true;
    const out = await reissueClaimCode(reissuing.id, reason);
    if (out.ok) {
      setIssued((prev) => new Map(prev).set(reissuing.id, out.data.claimCode));
    }
    toast(`${reissuing.stay.title}: ${out.message}`, out.tone);
    return out.ok || out.reason !== "bad_input";
  }

  return (
    <section className="mt-8" aria-label="Unclaimed walk-in stays">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Unclaimed walk-in stays{" "}
        <Badge variant="default">identity-bearing records without a User (F-B10)</Badge>
      </h2>
      {stays.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          Every stay that has ended is attached to somebody. A walk-in appears
          here only while nobody has claimed it — an empty list means none is
          waiting.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
          {stays.map((entry) => {
            const { id, stay } = entry;
            const code = issued.get(id);
            return (
              <div key={id} className="queue-row flex-wrap">
                <span className="money w-20 shrink-0 text-xs font-bold">{stay.ref}</span>
                <span className="min-w-0 grow">
                  <span className="block truncate text-sm font-semibold">
                    {stay.title}{" "}
                    <span className="font-normal text-muted-foreground">{stay.meta}</span>
                  </span>
                  <span
                    className={`block text-xs ${
                      stay.detailTone === "destructive" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {stay.detail}
                  </span>
                </span>
                {code && (
                  <Badge variant="default" className="money shrink-0">
                    new code {code}
                  </Badge>
                )}
                {stay.action.kind === "reissue" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setReissuing(entry)}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />{" "}
                    {code ? "Re-issue again" : "Re-issue code"}
                  </Button>
                )}
                {stay.action.kind === "stub" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={stubAction(stay.action.stub)}
                  >
                    {stay.action.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReasonDialog
        open={reissuing !== null}
        onClose={() => setReissuing(null)}
        onConfirm={confirm}
        // Danger weight: the old code dies the moment this lands, and a guest
        // holding it is locked out of their own stay until they get the new one.
        tone="danger"
        title={`New claim code for ${reissuing?.stay.title ?? "this stay"}?`}
        confirmLabel="Replace the code"
        pendingLabel="Issuing the new code…"
        body={
          <p>
            The stay gets a new code and the old one stops working at once. Give the new code only
            to the guest whose stay this is: whoever types it first takes the stay, and the identity
            captured on it.
          </p>
        }
      />
    </section>
  );
}
