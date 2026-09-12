import type { AdminBrokerRow, AdminRevealEvent } from "@injishi/contracts";

import type { BadgeIntent, BrokerRow, RevealEvent } from "@/lib/types";

import { EMPTY, count, dateTime, detail, money } from "./format";

/**
 * Brokers (F-A05) — the roster and the reveal log.
 */

/** Suspended is red because the account cannot work; active is settled. */
const BROKER_INTENT: Readonly<Record<AdminBrokerRow["status"], BadgeIntent>> = {
  active: "success",
  suspended: "danger",
};

/**
 * One broker.
 *
 * The note line is where the screen earns its keep. A broker who reveals
 * landlords and never places a tenant is either burning credits or harvesting
 * contacts, and the ratio is the only thing on the row that shows it — so it is
 * computed here, from two counts the API sent, and coloured.
 *
 * The thresholds are the console's judgement and are stated once, here:
 * ten or more reveals with nothing placed is worth a look; a credit balance in
 * the negative is worth stopping for. Neither is a fact the API asserted, which
 * is why both live in the presentation layer where a staffer can see the rule
 * change rather than in a query where they cannot.
 */
export function presentBrokerRow(row: AdminBrokerRow): BrokerRow {
  const noNettedPlacements = row.placementCount === 0 && row.revealCount >= 10;
  const overdrawn = row.revealCreditBalance < 0;

  return {
    name: row.name ?? row.email ?? EMPTY,
    note: detail(
      row.email,
      row.phoneMasked,
      `${count(row.revealCreditBalance)} credits`,
      overdrawn && "credit balance negative",
      noNettedPlacements && "reveals with no placements",
    ),
    ...(overdrawn
      ? { noteTone: "destructive" as const }
      : noNettedPlacements
        ? { noteTone: "warning" as const }
        : {}),
    // `AdminBrokerRow` carries no district coverage. The reveal log knows which
    // districts a broker works, but that is a different response, and joining
    // the two here would be this file inventing a summary from data it was not
    // given.
    districts: EMPTY,
    status: { text: row.status, intent: BROKER_INTENT[row.status] },
    reveals: count(row.revealCount),
    ...(noNettedPlacements ? { revealsTone: "destructive" as const } : {}),
    placements: count(row.placementCount),
    fees: money(row.placementFeesRwf, row.currency),
    action:
      row.status === "active"
        ? { kind: "suspend" }
        : {
            kind: "stub",
            label: "Reinstate",
            stub: `Reinstate broker — ${row.name ?? row.email ?? row.id}`,
          },
    ...(noNettedPlacements || overdrawn ? { flagged: true } : {}),
  };
}

/**
 * One reveal.
 *
 * The outcome badge says what the row IS and no more. `AdminRevealEvent`
 * carries no placement result — whether this reveal ever led to a tenancy lives
 * on the placement, not on the reveal — so a badge reading "converted" or
 * "abandoned" here would be the console answering a question it was not told
 * the answer to.
 */
export function presentRevealEvent(event: AdminRevealEvent): RevealEvent {
  return {
    when: dateTime(event.revealedAt),
    broker: event.brokerName ?? EMPTY,
    unit: event.landlordOrgName ?? event.listingId ?? EMPTY,
    district: event.districtName ?? EMPTY,
    outcome: { text: "revealed", intent: "default" },
  };
}
