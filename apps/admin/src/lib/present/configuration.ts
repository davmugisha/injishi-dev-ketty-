import type {
  AdminConfigEntry,
  AdminFeatureFlag,
  AdminFeeSchedule,
  AdminRegistrationFee,
  AdminSubscriptionPlan,
} from "@injishi/contracts";

import type { SectionRow, SectionStat } from "@/lib/types";

import { EMPTY, count, date, detail, humanise, money } from "./format";

/**
 * Configuration (F-A07) — versioned entries, flags and the fee schedule.
 */

/**
 * A config entry, and the one thing about it a staffer must see first.
 *
 * `lockedOnUse` is red, and that is not a warning about danger — it is a
 * warning about permanence. A locked entry has already been used by something
 * that cannot be un-done, so the value on screen is now history rather than a
 * setting. `reversible: false` is amber for the same family of reason: it can
 * still be changed, but not changed back.
 */
export function presentConfigEntry(entry: AdminConfigEntry): SectionRow {
  return {
    ref: `v${entry.version}`,
    subject: humanise(entry.configType),
    context: detail(
      `from ${date(entry.effectiveFrom)}`,
      entry.effectiveTo ? `until ${date(entry.effectiveTo)}` : "current",
    ),
    state: entry.lockedOnUse
      ? "locked on use"
      : entry.reversible
        ? "reversible"
        : "one-way",
    intent: entry.lockedOnUse
      ? "danger"
      : entry.reversible
        ? "success"
        : "warning",
  };
}

/**
 * A feature flag.
 *
 * `value` crosses as `unknown` and stays out of the row. The contract does not
 * pin its shape, and a flag whose value the console renders as `[object
 * Object]` is worse than one that shows only its key and scope. What is shown
 * is what is certain: which flag, where it applies, and from when.
 */
export function presentFeatureFlag(flag: AdminFeatureFlag): SectionRow {
  return {
    ref: `v${flag.version}`,
    subject: flag.key,
    context: detail(
      flag.scope === "district"
        ? (flag.districtName ?? `district ${flag.districtId ?? EMPTY}`)
        : "global",
      `from ${date(flag.effectiveFrom)}`,
    ),
    state: flag.scope,
    // A district-scoped flag is the one worth noticing: it means two parts of
    // the country are running different software.
    intent: flag.scope === "district" ? "warning" : "default",
  };
}

/* ---------- Fee schedule ---------- */

/**
 * A registration fee.
 *
 * Inactive rows are kept and greyed rather than filtered out. The fee schedule
 * is a history as much as a setting — somebody registered under the old figure,
 * and a screen that hides it cannot explain their invoice.
 */
export function presentRegistrationFeeRow(
  fee: AdminRegistrationFee,
): SectionRow {
  return {
    ref: humanise(fee.businessType),
    subject: money(fee.amountRwf, fee.currency),
    context: `from ${date(fee.effectiveFrom)}`,
    state: fee.active ? "active" : "superseded",
    intent: fee.active ? "success" : "default",
  };
}

export function presentSubscriptionPlan(plan: AdminSubscriptionPlan): SectionRow {
  return {
    ref: plan.code,
    subject: `${plan.name} · ${money(plan.priceRwf, plan.currency)}`,
    context: detail(
      `per ${plan.billingPeriod.replace(/ly$/, "")}`,
      plan.roomCountLimit !== null
        ? `up to ${count(plan.roomCountLimit)} rooms`
        : "no room limit",
      plan.effectiveFrom ? `from ${date(plan.effectiveFrom)}` : null,
    ),
    state: plan.active ? "active" : "retired",
    intent: plan.active ? "success" : "default",
  };
}

/**
 * The placement-fee totals.
 *
 * Pending is amber whenever there is any: a placement fee that has been earned
 * and not paid is a broker waiting on money, and the count is the only place
 * that shows up until somebody complains.
 */
export function presentPlacementFeeStats(
  schedule: AdminFeeSchedule,
): SectionStat[] {
  const s = schedule.placementFeeSummary;
  return [
    {
      label: "Placement fees pending",
      value: money(s.pendingRwf, s.currency),
      intent: s.pendingCount > 0 ? "warning" : "default",
      note: `${count(s.pendingCount)} placements`,
    },
    {
      label: "Placement fees paid",
      value: money(s.paidRwf, s.currency),
      intent: "success",
      note: `${count(s.paidCount)} placements`,
    },
  ];
}
