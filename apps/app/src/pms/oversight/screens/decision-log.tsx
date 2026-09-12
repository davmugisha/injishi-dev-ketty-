"use client";

/**
 * Decision log — what this officer has decided, in order.
 *
 * **IT IS NOT CONNECTED, AND THE EMPTY STATE NO LONGER PRETENDS OTHERWISE.**
 * `oversight.decisions` is `[]` in the store and nothing fills it: the API
 * records every pass and every rejection on the business's own file, and there
 * is no route that reads them back per officer. The old copy said "Act on a
 * file and it appears here, stamped with your name and jurisdiction", so an
 * officer who verified six businesses came back to an empty screen and had to
 * conclude that either the log or their decisions had been lost.
 *
 * The list below stays because it is the shape this screen takes the moment
 * there is a read behind it; the log is append-only, a decision never edited.
 */

import { useConsole } from "../store";
import { Badge, EmptyState, surfaceClass } from "../components/ui";
import { Icon } from "../components/icon";
import { cn } from "@/lib/utils";

const ACTION_INTENT: Record<string, "ok" | "accent" | "bad"> = {
  Approved: "ok",
  "Field-verified": "accent",
  Rejected: "bad",
};

export function DecisionLog() {
  const { oversight, officer } = useConsole();
  if (!officer) return null;

  // Nothing fills this list today (see the note above); the filter stays so the
  // screen keeps its shape for the read that will.
  const mine = oversight.decisions;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        Every decision you take, with the reason attached. Append-only — a decision is never edited.
      </span>

      {mine.length === 0 ? (
        <EmptyState className="flex flex-col items-center gap-2 p-9 text-center">
          <Icon name="scroll-text" size={24} strokeWidth={1.6} />
          <span className="text-base font-semibold text-ink">This log isn&apos;t connected yet</span>
          <span className="max-w-form text-sm text-muted-foreground">
            Your {officer.fn === "business_field_verifier" ? "verifications" : "approvals"} and rejections
            are recorded against each business as you take them — they simply can&apos;t be
            listed back here yet. Open a file from your queue to see where it stands.
          </span>
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "overflow-hidden")}>
          {mine.map((d, i) => (
            <div
              key={d.id}
              className={cn(
                "flex items-start gap-3 px-[18px] py-3.5",
                i === 0 ? "border-t border-transparent" : "border-t border-line",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{d.biz}</span>
                <span className="block text-2xs text-muted-foreground">
                  {[d.by, officer.body, d.ts].filter(Boolean).join(" · ")}
                </span>
                {d.reason && <span className="mt-1 block text-xs text-ink2">Reason — {d.reason}</span>}
                {d.note && <span className="mt-px block text-xs text-muted-foreground">“{d.note}”</span>}
              </span>
              <Badge intent={ACTION_INTENT[d.action] ?? "neutral"}>{d.action}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
