"use client";

import type { OrgRegistrationStatus } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recheckTin, reinstateOrg, suspendOrg } from "@/lib/actions/orgs";
import type { WriteOutcome } from "@/lib/actions/outcome";
import { ReasonDialog } from "@/lib/actions/reason-dialog";
import { useAdminUi } from "@/lib/store";

type Move = "suspend" | "reinstate" | "tin";

/**
 * The writes on one business's record: suspend, reinstate, retry the TIN check.
 *
 * A client island because `OrgRecord` renders on the server and a Server
 * Component cannot hand a button an `onClick`. It receives the status the page
 * just read and offers only the moves that status allows — suspend when active,
 * reinstate when suspended, a TIN retry while still at submitted. That is an
 * affordance, not the rule: the API answers 409 to an illegal move whatever
 * this renders, because the page it was drawn from can be stale.
 *
 * On a CONFIRMED success only, the record refreshes, so the status badge beside
 * these buttons changes because the platform says it did, not because a click
 * happened here. The refresh re-reads the lens that is open, exactly as a reload
 * would; any other outcome re-reads nothing, because nothing is known to have
 * moved. The re-read runs in a transition and the buttons wait with it, so
 * the gap between the toast and the badge changing is visibly in progress
 * rather than a stale record that still offers the move just made.
 */
export function OrgActions({
  orgId,
  name,
  status,
  hasTin,
}: {
  orgId: string;
  name: string;
  status: OrgRegistrationStatus;
  hasTin: boolean;
}) {
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const [move, setMove] = useState<Move | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const offered: Move[] = [];
  if (status === "active") offered.push("suspend");
  if (status === "suspended") offered.push("reinstate");
  if (status === "submitted" && hasTin) offered.push("tin");
  if (offered.length === 0) return null;

  async function confirm(reason: string): Promise<boolean> {
    let out: WriteOutcome<unknown>;
    if (move === "suspend") out = await suspendOrg(orgId, reason);
    else if (move === "reinstate") out = await reinstateOrg(orgId, reason);
    else out = await recheckTin(orgId, reason);
    toast(`${name}: ${out.message}`, out.tone);
    if (out.ok) startRefresh(() => router.refresh());
    return out.ok || out.reason !== "bad_input";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {offered.includes("suspend") && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          pending={refreshing}
          onClick={() => setMove("suspend")}
        >
          {refreshing ? "Updating the record…" : "Suspend…"}
        </Button>
      )}
      {offered.includes("reinstate") && (
        <Button
          variant="outline"
          size="sm"
          pending={refreshing}
          onClick={() => setMove("reinstate")}
        >
          {refreshing ? "Updating the record…" : "Reinstate…"}
        </Button>
      )}
      {offered.includes("tin") && (
        <Button
          variant="outline"
          size="sm"
          pending={refreshing}
          onClick={() => setMove("tin")}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />{" "}
          {refreshing ? "Updating the record…" : "Retry TIN check"}
        </Button>
      )}

      <ReasonDialog
        open={move !== null}
        onClose={() => setMove(null)}
        onConfirm={confirm}
        tone={move === "suspend" ? "danger" : "default"}
        title={
          move === "suspend"
            ? `Suspend ${name}?`
            : move === "reinstate"
              ? `Reinstate ${name}?`
              : `Re-check ${name}'s TIN?`
        }
        confirmLabel={
          move === "suspend" ? "Suspend" : move === "reinstate" ? "Reinstate" : "Re-check"
        }
        pendingLabel={
          move === "suspend"
            ? "Suspending…"
            : move === "reinstate"
              ? "Reinstating…"
              : "Asking RRA again…"
        }
        body={
          move === "suspend" ? (
            <p>
              Suspension takes every operating power away from this business&apos;s
              workspace until it is reinstated: the permission model grants nothing
              to an org that is not active. No record is deleted, it can be reversed,
              and nobody is notified automatically.
            </p>
          ) : move === "reinstate" ? (
            <p>
              The business becomes active again and its workspace regains the powers
              its members&apos; roles give them.
            </p>
          ) : (
            <p>
              Asks the RRA adapter again. A pass moves the business on to TIN
              verified and a fail rejects it; if RRA does not answer, it stays at
              submitted.
            </p>
          )
        }
      />
    </div>
  );
}
