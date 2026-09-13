"use client";

/**
 * Decision log — what this officer has decided, newest first (ADR-053, AC-G6).
 *
 * Read from `GET /api/v1/oversight/decisions`: this officer's OWN decisions and
 * nobody else's, each naming the business, what was done at which gate, the
 * reason where there was one, the note, and when. The body and the title on a
 * row are what the decision recorded at the time, so an appointment that was
 * later revoked or moved still shows the posting the decision was taken under.
 *
 * It was an empty array in the store behind a message saying it was not
 * connected; that message is gone with the gap it described. The log is
 * append-only: a decision is never edited.
 */

import { Button } from "@injishi/ui";

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
  const {
    oversight,
    officer,
    decisionsLoading,
    decisionsError,
    hasOlderDecisions,
    loadOlderDecisions,
  } = useConsole();
  if (!officer) return null;

  const mine = oversight.decisions;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        Every decision you take, with the reason attached. Append-only — a decision is never edited.
      </span>

      {decisionsLoading ? (
        <span role="status" className="text-sm text-muted-foreground">
          Loading your decisions…
        </span>
      ) : decisionsError ? (
        <EmptyState className="flex flex-col items-center gap-2 p-9 text-center">
          <Icon name="scroll-text" size={24} strokeWidth={1.6} />
          <span className="text-base font-semibold text-ink">We couldn&apos;t load your decisions</span>
          <span className="max-w-form text-sm text-muted-foreground">
            Nothing about them has changed. Try again in a moment.
          </span>
        </EmptyState>
      ) : mine.length === 0 ? (
        <EmptyState className="flex flex-col items-center gap-2 p-9 text-center">
          <Icon name="scroll-text" size={24} strokeWidth={1.6} />
          <span className="text-base font-semibold text-ink">No decisions yet</span>
          <span className="max-w-form text-sm text-muted-foreground">
            Your {officer.fn === "business_field_verifier" ? "verifications" : "approvals"} and rejections
            appear here as you take them, with the reason attached.
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
                  {[d.title, d.body, d.ts].filter(Boolean).join(" · ")}
                </span>
                {d.reason && <span className="mt-1 block text-xs text-ink2">Reason — {d.reason}</span>}
                {d.note && <span className="mt-px block text-xs text-muted-foreground">“{d.note}”</span>}
              </span>
              <Badge intent={ACTION_INTENT[d.action] ?? "neutral"}>{d.action}</Badge>
            </div>
          ))}
        </div>
      )}

      {hasOlderDecisions ? (
        <Button variant="outline" size="sm" className="self-start" onClick={loadOlderDecisions}>
          Show older decisions
        </Button>
      ) : null}
    </div>
  );
}
