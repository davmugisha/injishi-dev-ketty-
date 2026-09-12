"use client";

import { Badge, Button } from "@injishi/ui";
import { Check, Clock, Flag, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { recheckTin, suspendOrg } from "@/lib/actions/orgs";
import { ReasonDialog } from "@/lib/actions/reason-dialog";
import { useAdminUi, useStubAction } from "@/lib/store";
import type { OrgReviewItem } from "@/lib/types";

const BADGE_ICONS = {
  clock: Clock,
  "triangle-alert": TriangleAlert,
  flag: Flag,
} as const;

/**
 * One queue row: the presented view plus the org id a write is addressed to.
 *
 * The id rides BESIDE the view type, as it does in the directory: `OrgReviewItem`
 * is a presentation shape and an address is not a presentation decision. The
 * queue used to key its rows, and its "retry queued" state, on the legal name —
 * which is not unique, and is not something a write can be sent to.
 */
export interface ReviewQueueRow {
  id: string;
  item: OrgReviewItem;
}

/** What the reason dialog is about to do once the staffer says why. */
type Pending =
  | { kind: "retry"; rows: ReviewQueueRow[] }
  | { kind: "suspend"; row: ReviewQueueRow };

/** What a confirmed re-check said, in badge-length words. */
const CHECK_RESULT_LABEL = {
  verified: "re-checked · passed",
  failed: "re-checked · failed",
  pending: "re-checked · RRA silent",
} as const;

/**
 * Review queue — orgs needing a human despite auto-verification.
 *
 * A CLIENT COMPONENT because every control on it is stateful. The ROWS are read
 * on the server and arrive already mapped, so no colour, label or icon on this
 * screen is decided in the browser — `presentReviewItem` owns all three.
 *
 * THE BUTTONS ARE REAL NOW. "Retry now" and "Batch-resolve retries" call
 * `POST /admin/orgs/:orgId/tin-recheck` and "Suspend…" calls
 * `POST /admin/orgs/:orgId/suspend`, each through a Server Action, each after
 * asking for the reason the audit row records. A row only shows "re-checked"
 * once the platform has confirmed it; the old "retry queued" badge appeared on
 * click, before anything had been asked of anyone.
 */
export function ReviewQueue({ rows }: { rows: ReviewQueueRow[] }) {
  const toast = useAdminUi((s) => s.toast);
  const stubAction = useStubAction();
  // What the platform CONFIRMED for each row, kept locally rather than by
  // re-reading the page: re-rendering `/businesses` re-reads the OBO register,
  // which logs a record access for every intended owner on it.
  const [checked, setChecked] = useState<Map<string, keyof typeof CHECK_RESULT_LABEL>>(
    new Map(),
  );
  const [suspended, setSuspended] = useState<Set<string>>(new Set());
  // The dialog names the business it was opened from. It used to name one
  // fixture org in hardcoded prose, which on a real queue would have asked a
  // staffer to confirm the suspension of a business they had not selected.
  const [pending, setPending] = useState<Pending | null>(null);
  // Which row of a batch is out right now, 1-based. The batch runs one row at
  // a time, so "Waiting for the platform…" alone could sit there for a minute
  // with no sign it was getting anywhere.
  const [progress, setProgress] = useState(0);

  const retryable = rows.filter(
    (r) => r.item.action.kind === "retry-tin" && !checked.has(r.id),
  );

  async function confirm(reason: string): Promise<boolean> {
    if (!pending) return true;

    if (pending.kind === "suspend") {
      const out = await suspendOrg(pending.row.id, reason);
      if (out.ok) setSuspended((prev) => new Set(prev).add(pending.row.id));
      toast(`${pending.row.item.name}: ${out.message}`, out.tone);
      return out.ok || out.reason !== "bad_input";
    }

    // One at a time rather than all at once: a refusal that applies to the
    // caller (a missing power, the emailed code, an ended session) is true of
    // every row, and saying it once beats saying it for each of twenty rows.
    const batch = pending.rows.length > 1;
    let confirmed = 0;
    try {
      for (let index = 0; index < pending.rows.length; index += 1) {
        const row = pending.rows[index]!;
        setProgress(index + 1);
        const out = await recheckTin(row.id, reason);
        if (out.ok) {
          confirmed += 1;
          setChecked((prev) => new Map(prev).set(row.id, out.data.result));
          if (!batch) toast(`${row.item.name}: ${out.message}`, out.tone);
          continue;
        }
        if (out.reason === "bad_input") {
          toast(out.message, out.tone);
          return false;
        }
        toast(`${row.item.name}: ${out.message}`, out.tone);
        // A row-level answer (gone, or moved on) leaves the rest worth trying;
        // anything else is about the caller or the platform, and stops the batch.
        if (out.reason !== "missing" && out.reason !== "unreachable") break;
      }
    } finally {
      setProgress(0);
    }
    if (batch) {
      toast(
        `${confirmed} of ${pending.rows.length} TIN re-checks confirmed by the platform.`,
        confirmed === pending.rows.length ? "success" : "warning",
      );
    }
    return true;
  }

  return (
    <section className="mt-8" aria-label="District review queue">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Review queue{" "}
          <Badge variant="warning">registration is auto-verified — these need a human</Badge>
        </h2>
        {retryable.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPending({ kind: "retry", rows: retryable })}
          >
            <Check className="h-4 w-4" aria-hidden /> Batch-resolve retries
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          No business is waiting on a decision. Registrations that clear their
          TIN check never reach this queue — an empty one means every applicant
          has an answer.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
          {rows.map((row) => {
            const { id, item } = row;
            const BadgeIcon = item.badge.icon
              ? BADGE_ICONS[item.badge.icon as keyof typeof BADGE_ICONS]
              : undefined;
            const result = checked.get(id);
            return (
              <div key={id} className="queue-row flex-wrap">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-card font-bold text-card-foreground">
                  {item.initials}
                </span>
                <span className="min-w-0 grow">
                  <span className="block truncate text-sm font-semibold">
                    {item.name}{" "}
                    <span className="font-normal text-muted-foreground">· {item.district}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </span>
                <Badge variant={item.badge.intent} className="shrink-0">
                  {BadgeIcon ? <BadgeIcon className="size-3" aria-hidden /> : null}
                  {item.badge.text}
                </Badge>
                {item.action.kind === "retry-tin" &&
                  (result ? (
                    <Badge variant="default" className="shrink-0">
                      <RefreshCw className="size-3" aria-hidden />
                      {CHECK_RESULT_LABEL[result]}
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setPending({ kind: "retry", rows: [row] })}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden /> Retry now
                    </Button>
                  ))}
                {item.action.kind === "stub" && (
                  <Button
                    variant={item.action.label === "Diagnose" ? "outline" : "ghost"}
                    size="sm"
                    className="shrink-0"
                    onClick={stubAction(item.action.stub)}
                  >
                    {item.action.label}
                  </Button>
                )}
                {item.action.kind === "suspend" && suspended.has(id) && (
                  <Badge variant="danger" className="shrink-0">
                    suspended · confirmed
                  </Badge>
                )}
                {item.action.kind === "suspend" && !suspended.has(id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive"
                    onClick={() => setPending({ kind: "suspend", row })}
                  >
                    Suspend…
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReasonDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        tone={pending?.kind === "suspend" ? "danger" : "default"}
        title={
          pending?.kind === "suspend"
            ? `Suspend ${pending.row.item.name}?`
            : pending && pending.rows.length > 1
              ? `Re-check ${pending.rows.length} TINs with RRA?`
              : `Re-check ${pending?.rows[0]?.item.name ?? "this business"}'s TIN?`
        }
        confirmLabel={pending?.kind === "suspend" ? "Suspend" : "Re-check"}
        pendingLabel={
          pending?.kind === "suspend"
            ? "Suspending…"
            : pending && pending.rows.length > 1
              ? `Re-checking ${Math.max(progress, 1)} of ${pending.rows.length}…`
              : "Asking RRA again…"
        }
        body={
          pending?.kind === "suspend" ? (
            <>
              {/* Every sentence here is what the write actually does. This
                  dialog used to promise paused rent, notified tenants and a
                  second admin's approval — none of which exists. */}
              <p>
                Suspension takes every operating power away from this
                business&apos;s workspace until it is reinstated: the permission
                model grants nothing to an org that is not active. No record is
                deleted, and it can be reversed.
              </p>
              <p className="mt-2">Nobody is notified automatically.</p>
            </>
          ) : (
            <p>
              Asks the RRA adapter again. A pass moves the business on to TIN
              verified and a fail rejects it; if RRA does not answer, it stays at
              submitted. Only businesses still at submitted can be re-checked.
            </p>
          )
        }
      />
    </section>
  );
}
