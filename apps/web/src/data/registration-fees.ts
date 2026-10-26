/**
 * EVERY REGISTRATION FEE THIS PROTOTYPE QUOTES, AND WHO IS PRETENDING TO HAVE
 * SET IT.
 *
 * Read this before you trust a number it returns. The platform has one real
 * source for a registration fee — `registration_fees` in the API, read through
 * `fetchRegistrationFee` — and that table is keyed by BUSINESS TYPE
 * (`host` / `landlord` / `broker`), not by what kind of place is being
 * registered. So a 200-room hotel and a three-room guest house are quoted the
 * same amount today, and F-A10's admin editor for that table does not exist.
 *
 * The brief asks for the fee to be set by admin AND to differ per accommodation
 * type. Both halves are demonstrated here, in the browser, with the amounts
 * below invented for the demonstration. They are NOT a published price list,
 * they have not been agreed with RDB or anyone else, and they must not be
 * quoted to a registrant, screenshotted for a pitch, or read as a product
 * claim.
 *
 * WHAT IS REAL AND WHAT IS NOT. The vocabulary is real: the ten keys below are
 * exactly the fee-bearing tiles in `registration-kinds.ts`, so a type here can
 * only ever be a type the wizard can actually be on. The shape is real too —
 * `setBy` and `effectiveFrom` mirror the `registration_fees` columns, because
 * that table is effective-dated and never destructive (D8: the amount is locked
 * onto the invoice at charge time, so a later price change cannot rewrite what
 * somebody already paid). The AMOUNTS are fabricated.
 *
 * WHY THE SERVER STILL WINS. `resolveRegistrationFee` in `data/registration.ts`
 * asks the API first and falls back to this file only when it does not answer.
 * A demo laptop with no API running is the case this file exists for; a real
 * deployment quotes its own table and this file is never read.
 *
 * WHY BROKER IS ABSENT. A broker registration is free and instant
 * (ADR-026 assumption 2) and never reaches the pay step, so pricing one here
 * would invent a charge that the wizard is structurally unable to make.
 *
 * WHEN F-A10 LANDS, DELETE THIS FILE. The admin editor writes
 * `registration_fees` rows, the wizard reads them through the API it already
 * calls, and nothing below has to survive the swap.
 */
import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";

/** One priced row of the schedule. Mirrors a `registration_fees` row. */
export interface RegistrationFee {
  /** A fee-bearing `RegistrationKind` — the eight classes, plus the two tiles. */
  accommodationType: string;
  /** What the wizard and the console call it on screen. */
  label: string;
  amountRwf: number;
  /** The staffer the demo credits with the current amount. */
  setBy: string;
  /** ISO date. The schedule is effective-dated, exactly as the table is. */
  effectiveFrom: string;
}

/**
 * The two labels that are NOT accommodation classes.
 *
 * `residence` and `bar_restaurant` are registration tiles rather than RDB
 * accommodation classes, so `ACCOMMODATION_CLASS_LABEL` has no word for them.
 * They are spelled the same way `registration-kinds.ts` spells them, and only
 * here, so the wizard and this schedule cannot come to call the same tile two
 * different things.
 */
const TILE_LABEL: Record<string, string> = {
  residence: "Residence",
  bar_restaurant: "Bar & Restaurant",
};

/** Class labels come from contracts; nothing here retypes the eight. */
const TYPE_LABEL: Record<string, string> = {
  ...ACCOMMODATION_CLASS_LABEL,
  ...TILE_LABEL,
};

/** What a type is called, falling back to its key rather than to an em dash. */
function accommodationTypeLabel(accommodationType: string): string {
  return TYPE_LABEL[accommodationType] ?? accommodationType;
}

/**
 * The published schedule, ordered the way the console lists it: most expensive
 * first, because the ordering question a staffer opens the screen with is
 * "what are we charging the big businesses".
 *
 * The spread is the point of the feature, and it is graded by how much work a
 * registration of that kind actually makes: a hotel brings a licensed premises,
 * a graded star rating and an officer's site visit; a guest house brings a room
 * in somebody's house. A flat fee across the two is what the brief is asking to
 * end.
 */
const ROWS: ReadonlyArray<Omit<RegistrationFee, "label">> = [
  {
    accommodationType: "hotel",
    amountRwf: 250_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
  {
    accommodationType: "lodge",
    amountRwf: 180_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
  {
    accommodationType: "tented_camp",
    amountRwf: 120_000,
    setBy: "Chantal Mukamana · Finance",
    effectiveFrom: "2026-04-01",
  },
  {
    accommodationType: "motel",
    amountRwf: 100_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
  {
    accommodationType: "villa",
    amountRwf: 90_000,
    setBy: "Chantal Mukamana · Finance",
    effectiveFrom: "2026-04-01",
  },
  {
    accommodationType: "bar_restaurant",
    amountRwf: 80_000,
    setBy: "Chantal Mukamana · Finance",
    effectiveFrom: "2026-06-01",
  },
  {
    accommodationType: "apartment",
    amountRwf: 60_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
  {
    accommodationType: "guest_house",
    amountRwf: 45_000,
    setBy: "Chantal Mukamana · Finance",
    effectiveFrom: "2026-04-01",
  },
  {
    accommodationType: "residence",
    amountRwf: 20_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
  {
    // D24's escape hatch. Priced at the middle of the range rather than at the
    // top or the bottom: "Other" is where a place that fits none of the eight
    // lands, and both over- and under-charging it is a decision nobody has
    // enough information to make until an officer has seen it.
    accommodationType: "other",
    amountRwf: 100_000,
    setBy: "Samuel Kayitare · Super Admin",
    effectiveFrom: "2026-01-01",
  },
];

const REGISTRATION_FEE_SCHEDULE: readonly RegistrationFee[] = ROWS.map(
  (row) => ({ ...row, label: accommodationTypeLabel(row.accommodationType) }),
);

/**
 * What an unpriced type is quoted.
 *
 * `other` rather than the cheapest row or a zero: a type with no row of its own
 * is by definition one nobody has classified yet, which is the same situation
 * "Other" describes. Quoting zero would tell a registrant their registration is
 * free, and quoting the cheapest would make forgetting to price a new type the
 * profitable mistake.
 */
const FALLBACK_FEE_TYPE = "other";

/* -------------------------------------------------------------------------
 * The demo's admin control
 * ---------------------------------------------------------------------- */

/** One overridden row: everything about a fee an admin edit can change. */
export interface RegistrationFeeOverride {
  amountRwf: number;
  setBy: string;
  effectiveFrom: string;
}

/** Overrides by accommodation type. Only edited types appear. */
export type RegistrationFeeOverrides = Record<string, RegistrationFeeOverride>;

/** The schedule as it stands after the console's edits are laid over it. */
function feeScheduleWith(
  overrides: RegistrationFeeOverrides,
): RegistrationFee[] {
  return REGISTRATION_FEE_SCHEDULE.map((fee) => {
    const edit = overrides[fee.accommodationType];
    return edit === undefined ? fee : { ...fee, ...edit };
  });
}

/**
 * The fee for one accommodation type — the whole lookup, in one place.
 *
 * Takes the overrides as an ARGUMENT rather than reading the cookie itself, so
 * it stays pure and a caller can render it on the server. A component that
 * wants the live value reads the cookie once in an effect and passes the result
 * down; reading it during render would give the server one answer and the
 * client another, and React would tear the whole bill down on hydration.
 */
export function registrationFeeFor(
  accommodationType: string | null,
  overrides: RegistrationFeeOverrides = {},
): RegistrationFee | null {
  if (accommodationType === null) return null;
  const schedule = feeScheduleWith(overrides);
  return (
    schedule.find((fee) => fee.accommodationType === accommodationType) ??
    schedule.find((fee) => fee.accommodationType === FALLBACK_FEE_TYPE) ??
    null
  );
}
