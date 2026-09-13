"use client";

/**
 * Rate plans (F-L03) — the terms each room type sells on.
 *
 * **On real data** (ADR-035, D-f wave 2), and since ADR-049 **writable** for
 * the acts an owner needs to sell: add a plan, make a plan the default, archive
 * or restore one. Reads `GET /api/v1/inventory/rate-plans` and shows the plans
 * of the property in view (`usePropertyInView`), grouped under their room type.
 *
 * **THE DISTINCTION THIS SCREEN EXISTS TO TEACH** is the one Room types states
 * and cannot show: a room type is WHAT THE GUEST GETS, a rate plan is THE TERMS
 * IT SELLS ON. The same rooms sell several ways at once, so the plans are
 * grouped UNDER their room type rather than listed flat — a flat list of
 * "Flexible, Flexible, Flexible" says nothing.
 *
 * **EXACTLY ONE DEFAULT PER ROOM TYPE.** The database enforces it with a partial
 * unique index, and the API MOVES the flag when another plan is made default
 * rather than refusing. So "Make default" is one press, and the default plan
 * offers no Archive: a room type with no default could not be sold.
 *
 * **A DERIVED PLAN SHOWS ITS PARENT, not just its price.** Non-refundable is
 * flexible minus ten percent and it MOVES when flexible moves. Derivation,
 * occupancy anchors and stay limits are still edited nowhere; they are pricing
 * rules with their own spec (F-L05), and a field on this form would guess at them.
 */

import { cn } from "@/lib/utils";
import { Checkbox } from "@injishi/ui";
import type { CancellationTier, OperatorRatePlan } from "@injishi/contracts";
import { useState } from "react";
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
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useCreateRatePlan, useRoomTypes, useUpdateRatePlan } from "../data/inventory";
import { useRatePlans } from "../data/ops";
import { fmt } from "../lib/format";
import { PropertyPicker, usePropertyInView } from "./inventory-property";

const COLS = "minmax(170px,1.5fr) minmax(130px,1fr) minmax(150px,1.2fr) minmax(120px,1fr) minmax(170px,1.2fr)";

/** How a cancellation tier reads to somebody who did not name it. */
const TIER_LABEL: Record<CancellationTier, string> = {
  flexible: "Flexible",
  moderate: "Moderate",
  limited: "Limited",
  firm: "Firm",
  strict_extended_stay: "Strict, for long stays",
};

const MODE_LABEL: Record<string, string> = {
  instant_book: "Books instantly",
  request_to_book: "You approve first",
};

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

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

type Draft = { name: string; price: string; tier: CancellationTier; isDefault: boolean };
const EMPTY_DRAFT: Draft = { name: "", price: "", tier: "flexible", isDefault: false };

export function RatePlans() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { list, properties, current, select } = usePropertyInView(workspaceId);
  const plansQuery = useRatePlans(workspaceId);
  const roomTypesQuery = useRoomTypes(workspaceId, current?.id ?? null);
  const create = useCreateRatePlan(workspaceId);
  const update = useUpdateRatePlan(workspaceId);
  /** The room type whose "add a plan" form is open, if any. */
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }

  if (list.isPending || plansQuery.isPending || (current && roomTypesQuery.isPending)) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={240} delay={60} />
      </div>
    );
  }

  if (list.isError || plansQuery.isError || roomTypesQuery.isError) {
    /* An unreachable API is not a property that sells nothing. Told that, an
       operator would think their rooms have no price. */
    return (
      <LoadFailed
        onRetry={() => {
          void list.refetch();
          void plansQuery.refetch();
          void roomTypesQuery.refetch();
        }}
        retrying={list.isFetching || plansQuery.isFetching || roomTypesQuery.isFetching}
      >
        We couldn&apos;t load your rate plans. Every price you have set is still there — this
        is on our side, not a property with no pricing.
      </LoadFailed>
    );
  }

  if (!current || !workspaceId) {
    return (
      <EmptyState className="p-5">
        No property on this business yet. Rate plans belong to its room types.
      </EmptyState>
    );
  }

  const roomTypes = roomTypesQuery.data?.roomTypes ?? [];
  const plans = plansQuery.data?.ratePlans ?? [];
  const busy = create.isPending || update.isPending;

  const openAdd = (roomTypeId: string) => {
    setError(null);
    setFormError(null);
    setDraft(EMPTY_DRAFT);
    setAddingTo(roomTypeId);
  };

  const submit = () => {
    if (!addingTo) return;
    const name = draft.name.trim();
    const priceText = draft.price.trim().replace(/[,\s]/g, "");
    const price = priceText === "" ? null : Number(priceText);
    if (name.length < 2) return setFormError("Give the rate plan a name.");
    if (price !== null && (!Number.isInteger(price) || price < 0)) {
      return setFormError("Write the price a night in whole Rwandan francs.");
    }
    setFormError(null);
    create.mutate(
      {
        roomTypeId: addingTo,
        body: { name, basePriceRwf: price, cancellationTier: draft.tier, isDefault: draft.isDefault },
      },
      {
        onSuccess: () => setAddingTo(null),
        onError: (err) => setFormError(humanError(err)),
      },
    );
  };

  const change = (plan: OperatorRatePlan, body: { isDefault?: boolean; status?: "active" | "archived" }) => {
    if (busy) return;
    setError(null);
    update.mutate({ ratePlanId: plan.id, body }, { onError: (err) => setError(humanError(err)) });
  };

  const row = (plan: OperatorRatePlan, i: number) => {
    const derived = derivation(plan);
    const stay = stayRule(plan);
    const tier = plan.nonRefundable
      ? "Non-refundable"
      : plan.cancellationTier === null
        ? null
        : (TIER_LABEL[plan.cancellationTier] ?? plan.cancellationTier);
    const active = plan.status === "active";

    return (
      <div
        key={plan.id}
        data-rate-plan={plan.name}
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
            {!active && <Badge intent="neutral">Archived</Badge>}
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
          {tier !== null && <Badge intent={plan.nonRefundable ? "warn" : "info"}>{tier}</Badge>}
          {plan.bookingMode !== null && (
            <Badge intent="neutral">{MODE_LABEL[plan.bookingMode] ?? plan.bookingMode}</Badge>
          )}
        </span>

        <span className="text-2xs text-muted-foreground">{stay ?? "Any length of stay"}</span>

        <span className="flex flex-wrap justify-end gap-1.5">
          {active && !plan.isDefault && (
            <ActionButton onClick={() => change(plan, { isDefault: true })}>Make default</ActionButton>
          )}
          {active && !plan.isDefault && (
            <ActionButton onClick={() => change(plan, { status: "archived" })}>Archive</ActionButton>
          )}
          {!active && <ActionButton onClick={() => change(plan, { status: "active" })}>Restore</ActionButton>}
        </span>
      </div>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      <PropertyPicker properties={properties} current={current} onSelect={select} />
      <span data-property-heading className="text-base font-bold text-foreground">
        {current.name}
      </span>
      <span className="text-xs text-muted-foreground">
        A room type is what the guest gets. A rate plan is the terms it sells on, so the same
        rooms can sell several ways at once. Each room type sells on exactly one default plan.
      </span>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {roomTypes.length === 0 && (
        <EmptyState className="p-5">
          No room types on this property yet. Add one under Room types; its price becomes its
          first rate plan.
        </EmptyState>
      )}

      {roomTypes.map((roomType) => {
        const group = plans.filter((p) => p.roomTypeId === roomType.id);
        return (
          <section key={roomType.id} data-room-type-group={roomType.name} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <SectionHeading n={group.length}>{roomType.name}</SectionHeading>
              {addingTo !== roomType.id && roomType.status === "active" && (
                <ActionButton onClick={() => openAdd(roomType.id)}>Add a rate plan</ActionButton>
              )}
            </div>

            {addingTo === roomType.id && (
              <form
                className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <span className="text-sm font-semibold text-ink">A new rate plan for {roomType.name}</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-ink">Plan name</span>
                    <input
                      aria-label="Rate plan name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="e.g. Breakfast included"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-ink">Price a night (RWF)</span>
                    <input
                      aria-label="Rate plan price a night in RWF"
                      inputMode="numeric"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-ink">Cancellation</span>
                    <select
                      aria-label="Cancellation"
                      value={draft.tier}
                      onChange={(e) => setDraft({ ...draft, tier: e.target.value as CancellationTier })}
                      className={inputClass}
                    >
                      {(Object.keys(TIER_LABEL) as CancellationTier[]).map((tier) => (
                        <option key={tier} value={tier}>
                          {TIER_LABEL[tier]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Checkbox
                  isSelected={draft.isDefault}
                  onChange={(isDefault) => setDraft({ ...draft, isDefault })}
                  className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
                >
                  Sell this plan by default
                </Checkbox>
                {formError && (
                  <p role="alert" className="text-sm text-danger">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <ActionButton onClick={() => setAddingTo(null)}>Cancel</ActionButton>
                  <ActionButton variant="primary" type="submit" pending={create.isPending}>
                    Save rate plan
                  </ActionButton>
                </div>
              </form>
            )}

            {group.length === 0 ? (
              <EmptyState className="p-4 text-sm">No rate plans on this room type yet.</EmptyState>
            ) : (
              <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
                <div className="min-w-[900px]">
                  <div style={tableHeadStyle(COLS)}>
                    <span>Plan</span>
                    <span>Price a night</span>
                    <span>Terms</span>
                    <span>Length of stay</span>
                    <span />
                  </div>
                  {group.map(row)}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
