"use client";

/**
 * Rate plans (F-L03) — the terms each room type sells on.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads
 * `GET /api/v1/inventory/rate-plans`. It replaces a `Placeholder`, so there was
 * no fixture here to remove — `rate_plans` is one of the richest tables in the
 * schema and until this wave NOTHING read it: no contract, no repository, no
 * route.
 *
 * **THE DISTINCTION THIS SCREEN EXISTS TO TEACH** is the one Room types states
 * and cannot show: a room type is WHAT THE GUEST GETS, a rate plan is THE TERMS
 * IT SELLS ON. The same rooms sell several ways at once, so the plans are
 * grouped UNDER their room type rather than listed flat — a flat list of
 * "Flexible, Flexible, Flexible" says nothing.
 *
 * **A DERIVED PLAN SHOWS ITS PARENT, not just its price.** Non-refundable is
 * flexible minus ten percent and it MOVES when flexible moves. A screen showing
 * only the computed number would hide the relationship that keeps the two in
 * step, and an operator would go looking for the price to edit on a row that
 * has none of its own.
 *
 * **READ ONLY, deliberately.** Writing a plan is a pricing decision with its
 * own rules — occupancy anchors, derivation, cancellation tiers, stay limits —
 * not a form this wave should invent. Reading is the honest half and it is what
 * unblocks the lens. The follow-up is recorded in ADR-035.
 */

import { cn } from "@/lib/utils";
import type { OperatorRatePlan } from "@injishi/contracts";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
  tableHeadStyle,
} from "../components/ui";
import { useWorkspaceId } from "../data/capability";
import { useRatePlans } from "../data/ops";
import { fmt } from "../lib/format";

const COLS = "minmax(170px,1.5fr) minmax(130px,1fr) minmax(150px,1.2fr) minmax(120px,1fr)";

/** How a cancellation tier reads to somebody who did not name it. */
const TIER_LABEL: Record<string, string> = {
  flexible: "Free cancellation",
  moderate: "Moderate",
  strict: "Strict",
  non_refundable: "Non-refundable",
};

const MODE_LABEL: Record<string, string> = {
  instant_book: "Books instantly",
  request_to_book: "You approve first",
};

/** `-10%` or `RWF -5,000`, whichever the derivation is written in. */
function derivation(plan: OperatorRatePlan): string | null {
  if (plan.derivationKind === null || plan.derivationValue === null) return null;
  const v = plan.derivationValue;
  const sign = v > 0 ? "+" : "";
  return plan.derivationKind === "percentage" ? `${sign}${v}%` : `${sign}${fmt(v)}`;
}

/** `1 to 14 nights`, `2 nights or more`, `Up to 14 nights`, or nothing. */
function stayRule(plan: OperatorRatePlan): string | null {
  const { minStay, maxStay } = plan;
  if (minStay === null && maxStay === null) return null;
  if (minStay !== null && maxStay !== null) return `${minStay} to ${maxStay} nights`;
  if (minStay !== null) return `${minStay} night${minStay === 1 ? "" : "s"} or more`;
  return `Up to ${maxStay} nights`;
}

export function RatePlans() {
  const workspaceId = useWorkspaceId();
  const query = useRatePlans(workspaceId);

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={240} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not a property that sells nothing. Told that, an
       operator would think their rooms have no price. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your rate plans. Every price you have set is still there —
        this is on our side, not a property with no pricing.
      </LoadFailed>
    );
  }

  const all = query.data?.ratePlans ?? [];

  if (all.length === 0) {
    return (
      <EmptyState className="p-5">
        No rate plans yet. A room type needs at least one before it can be sold.
      </EmptyState>
    );
  }

  /*
   * Grouped UNDER the room type, in the order the server sent them — it orders
   * by room type name already, so the groups come out alphabetical without a
   * second sort here.
   */
  const groups: { roomTypeId: string; roomTypeName: string; plans: OperatorRatePlan[] }[] = [];
  for (const plan of all) {
    const last = groups[groups.length - 1];
    if (last && last.roomTypeId === plan.roomTypeId) {
      last.plans.push(plan);
    } else {
      groups.push({
        roomTypeId: plan.roomTypeId,
        roomTypeName: plan.roomTypeName ?? "Room type",
        plans: [plan],
      });
    }
  }

  const row = (plan: OperatorRatePlan, i: number) => {
    const derived = derivation(plan);
    const stay = stayRule(plan);
    const tier = plan.nonRefundable
      ? "Non-refundable"
      : plan.cancellationTier === null
        ? null
        : (TIER_LABEL[plan.cancellationTier] ?? plan.cancellationTier);

    return (
      <div
        key={plan.id}
        className={cn(
          "grid items-center gap-2.5 px-[18px] py-3",
          i === 0 ? "border-t border-transparent" : "border-t border-line",
        )}
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{plan.name}</span>
            {plan.isDefault && <Badge intent="ok">Default</Badge>}
            {plan.status !== "active" && <Badge intent="neutral">Archived</Badge>}
          </span>
          {/* The parent is named, not just implied by the price. */}
          {plan.parentRatePlanName !== null && derived !== null && (
            <span className="text-2xs text-muted-foreground">
              Follows {plan.parentRatePlanName} at {derived}
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">
            {plan.basePriceRwf === null ? "No price set" : fmt(plan.basePriceRwf)}
          </span>
          {plan.baseOccupancy !== null && (
            <span className="text-2xs text-muted-foreground">
              for {plan.baseOccupancy} guest{plan.baseOccupancy === 1 ? "" : "s"}
            </span>
          )}
          {plan.singleOccupancyPriceRwf !== null && (
            <span className="text-2xs text-muted-foreground">
              {fmt(plan.singleOccupancyPriceRwf)} for one
            </span>
          )}
        </span>

        <span className="flex flex-wrap gap-1.5">
          {tier !== null && (
            <Badge intent={plan.nonRefundable ? "warn" : "info"}>{tier}</Badge>
          )}
          {plan.bookingMode !== null && (
            <Badge intent="neutral">
              {MODE_LABEL[plan.bookingMode] ?? plan.bookingMode}
            </Badge>
          )}
        </span>

        <span className="text-2xs text-muted-foreground">{stay ?? "Any length of stay"}</span>
      </div>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        A room type is what the guest gets. A rate plan is the terms it sells on, so the
        same rooms can sell several ways at once.
      </span>

      {groups.map((group) => (
        <section key={group.roomTypeId}>
          <SectionHeading n={group.plans.length}>{group.roomTypeName}</SectionHeading>
          <div className={cn(surfaceClass, "mt-2.5 scrollbar overflow-x-auto")}>
            <div className="min-w-[760px]">
              <div style={tableHeadStyle(COLS)}>
                <span>Plan</span>
                <span>Price a night</span>
                <span>Terms</span>
                <span>Length of stay</span>
              </div>
              {group.plans.map(row)}
            </div>
          </div>
        </section>
      ))}

      <p className="text-2xs text-muted-foreground">
        Editing a plan is not here yet. A price change moves every plan that follows it,
        so it gets its own screen rather than a field on this table.
      </p>
    </div>
  );
}
