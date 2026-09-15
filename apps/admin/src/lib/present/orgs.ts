import {
  ACCOMMODATION_CLASS_LABEL,
  REJECTION_REASON_LABEL,
  type AdminOboRow,
  type AdminOrgDetail,
  type AdminOrgMember,
  type AdminOrgProperty,
  type AdminOrgReviewItem,
  type AdminOrgRow,
  type AdminSubscriptionStatus,
  type OrgRegistrationStatus,
  type ResidenceClass,
  type StoredAccommodationClass,
} from "@injishi/contracts";

import type {
  BadgeIntent,
  OboRegistration,
  OrgReviewItem,
  OrgRow,
  SectionRow,
} from "@/lib/types";

import {
  EMPTY,
  count,
  date,
  detail,
  elapsed,
  humanise,
  initialsOf,
  optional,
} from "./format";

/**
 * Businesses (F-A03) — the mapping from an org record to a row on a screen.
 *
 * Every colour decision about a business is made in this file and nowhere else.
 */

/* ---------- Registration status ---------- */

/**
 * The stage a business is at, in badge-length words.
 *
 * The long-form sentence for each stage already has an owner —
 * `REGISTRATION_STAGE_MESSAGE` in `@injishi/contracts` — and it is written for
 * the registrant ("We're checking your TIN with RRA"). A staff badge needs two
 * words, so these are the short forms and the long ones stay where they are.
 */
export const REGISTRATION_LABEL: Readonly<
  Record<OrgRegistrationStatus, string>
> = {
  pending_payment: "fee unpaid",
  submitted: "submitted",
  tin_verified: "TIN verified",
  field_verified: "field verified",
  approved: "approved",
  active: "active",
  rejected: "rejected",
  suspended: "suspended",
};

/**
 * The colour each stage earns.
 *
 * ONLY `active` is green, and that is a statement about the model rather than a
 * taste in palettes: `permissionsForWorkspace` returns an EMPTY permission set
 * at every other stage, so an owner at `approved` holds the role and none of
 * its powers (D20, D23). A console that painted `approved` green would be
 * telling a staffer that a business is trading when it cannot list a room.
 *
 * The stages between are `primary` — moving, on track, nobody is waiting on
 * anybody. `pending_payment` is amber because it is the one stage that stalls
 * on the registrant rather than on the platform.
 */
export const REGISTRATION_INTENT: Readonly<
  Record<OrgRegistrationStatus, BadgeIntent>
> = {
  pending_payment: "warning",
  submitted: "default",
  tin_verified: "accent",
  field_verified: "accent",
  approved: "accent",
  active: "success",
  rejected: "danger",
  suspended: "danger",
};

/* ---------- Subscription ---------- */

/**
 * Subscription health.
 *
 * `past_due` is amber and not red: the business is still trading and somebody
 * needs to chase an invoice. `suspended` is red because service has actually
 * stopped. Collapsing the two would either raise a false alarm or hide a real
 * outage.
 */
const SUBSCRIPTION_INTENT: Readonly<
  Record<AdminSubscriptionStatus, BadgeIntent>
> = {
  trialing: "accent",
  active: "success",
  past_due: "warning",
  canceled: "default",
  suspended: "danger",
};

function subscriptionBadge(
  status: AdminSubscriptionStatus | null,
  planName: string | null,
): { text: string; intent: BadgeIntent } {
  // No subscription row at all is a real and common state — a business still in
  // the registration pipeline has never had one. It is neutral, not a failure.
  if (status === null) return { text: "no plan", intent: "default" };
  return {
    text: detail(planName, humanise(status)),
    intent: SUBSCRIPTION_INTENT[status],
  };
}

/* ---------- The directory ---------- */

/**
 * What kind of business this is, in one phrase.
 *
 * Built from the classification the org actually holds, falling back to its
 * domain. `ACCOMMODATION_CLASS_LABEL` comes from `@injishi/contracts` so the
 * console words a class exactly as the registration wizard did — except for the
 * retired codes (D24), which that table does not carry and which an org
 * registered before the change still legitimately holds. Those are humanised
 * from the enum member rather than hidden: a console that cannot render a
 * retired class is a console that cannot show you your oldest customers.
 */
function orgType(row: AdminOrgRow): string {
  if (row.accommodationClass) return accommodationLabel(row.accommodationClass);
  if (row.residenceClass) return residenceLabel(row.residenceClass);
  return humanise(row.domain);
}

function accommodationLabel(value: StoredAccommodationClass): string {
  return value in ACCOMMODATION_CLASS_LABEL
    ? ACCOMMODATION_CLASS_LABEL[value as keyof typeof ACCOMMODATION_CLASS_LABEL]
    : humanise(value);
}

const RESIDENCE_LABEL: Readonly<Record<ResidenceClass, string>> = {
  residential_landlord: "Landlord",
  residential_property_manager: "Property manager",
};

function residenceLabel(value: ResidenceClass): string {
  return RESIDENCE_LABEL[value];
}

/**
 * One row of the business directory.
 *
 * `domain` passes straight through. `OrgRow.domain` also allows `"mixed"` for
 * an org running both sides of the platform, and this mapping never produces
 * it: `AdminOrgRow.domain` is a single `Domain`, so "mixed" is not a fact the
 * API has ever sent. Deriving it from anything available here would be the
 * console guessing at a business's shape.
 */
export function presentOrgRow(row: AdminOrgRow | AdminOrgDetail): OrgRow {
  return {
    name: row.legalName,
    ...(row.isObo ? { obo: true } : {}),
    type: orgType(row),
    tin: row.tin ?? EMPTY,
    district: row.districtName ?? EMPTY,
    domain: row.domain,
    rdbEntityGroup: optional(row.rdbEntityGroup),
    accommodationClass: optional(row.accommodationClass),
    residenceClass: optional(row.residenceClass),
    tourismLicenseNumber: optional(row.tourismLicenseNumber),
    chamberOfTourismMember: row.chamberOfTourismMember,
    psfMember: row.psfMember,
    eacStarGrade: optional(row.eacStarGrade),
    state: {
      text: REGISTRATION_LABEL[row.registrationStatus],
      intent: REGISTRATION_INTENT[row.registrationStatus],
    },
    subscription: subscriptionBadge(
      row.subscriptionStatus,
      row.subscriptionPlanName,
    ),
    // The row's affordance, named for the record it opens. `stub` is the
    // sentence the console shows until the detail screen exists; it repeats the
    // business name rather than inventing anything about it.
    action: { label: "Open record", stub: `Business record — ${row.legalName}` },
  };
}

/* ---------- The review queue ---------- */

/**
 * One business waiting on a decision.
 *
 * The detail line is assembled from what the API sent and nothing else: the
 * stage, the reviewer's last decision if there was one, and how long it has
 * been waiting. `REJECTION_REASON_LABEL` comes from `@injishi/contracts`, so a
 * refusal is worded here exactly as it is worded to the registrant — a queue
 * that paraphrases the reason is a queue where staff and applicant are reading
 * two different rejections.
 *
 * The icon is chosen here because the API deliberately sends no icon. Each one
 * follows from a fact on the row: a clock where the TIN check has not passed, a
 * warning where a reviewer refused, a flag where the business is suspended.
 */
export function presentReviewItem(item: AdminOrgReviewItem): OrgReviewItem {
  // TIME IN THE CURRENT STAGE, from the event log (ADR-053, AC-R7). It used to
  // be "waiting since submission", derived from a review that may not exist
  // yet, which is the figure that could not tell a business stuck at the RRA
  // check from one stuck at an officer. A business that reached its stage before
  // the log existed has no entry, and shows no wait rather than a guessed one.
  const inStage = item.stageEnteredAt ? elapsed(item.stageEnteredAt) : null;
  const decision = item.lastDecision;
  const icon = reviewIcon(item);

  return {
    initials: initialsOf(item.legalName),
    name: item.legalName,
    district: item.districtName ?? EMPTY,
    detail: detail(
      humanise(item.domain),
      REGISTRATION_LABEL[item.registrationStatus],
      !item.tinVerified && "TIN not verified",
      decision?.reasonCode && REJECTION_REASON_LABEL[decision.reasonCode],
      decision && `decided ${date(decision.decidedAt)}`,
      inStage && `in stage ${inStage}`,
      // Every automatic RRA retry used (AC-R5). Named on the row, because the
      // point of the ceiling is that a human looks now.
      item.stalled && "RRA check stalled, needs a person",
      // Nobody is appointed to take this stage here (ADR-053, AC-G9). A business
      // stuck for want of an officer must not look like one under slow review.
      item.coverage === "uncovered" && "No officer appointed for this stage and district",
    ),
    badge: {
      text: REGISTRATION_LABEL[item.registrationStatus],
      intent: REGISTRATION_INTENT[item.registrationStatus],
      ...(icon ? { icon } : {}),
    },
    action: reviewAction(item),
  };
}

function reviewIcon(item: AdminOrgReviewItem): string | null {
  if (item.registrationStatus === "suspended") return "flag";
  if (item.registrationStatus === "rejected") return "triangle-alert";
  if (!item.tinVerified) return "clock";
  return null;
}

/**
 * What a staffer can do about this row.
 *
 * `retry-tin` is offered only where it would actually do something — the TIN
 * check has not passed and the business has not already been refused. Every
 * other state gets a stub, because the actions behind them (approve, reject,
 * suspend) are pipeline decisions that do not exist yet: nothing in this
 * platform creates an org, calls RRA, or records a verifier's decision. An
 * affordance that pretends otherwise is a button that lies.
 */
function reviewAction(item: AdminOrgReviewItem): OrgReviewItem["action"] {
  if (
    !item.tinVerified &&
    item.registrationStatus !== "rejected" &&
    item.registrationStatus !== "suspended"
  ) {
    return { kind: "retry-tin" };
  }
  return {
    kind: "stub",
    label: "Open review",
    stub: `Registration review — ${item.legalName}`,
  };
}

/* ---------- On-behalf-of registrations ---------- */

/**
 * The claim state of an OBO registration, and why each colour.
 *
 * `registrant_held` is amber, not neutral: the payout is locked and the real
 * owner has not taken possession of their own business, which is a state that
 * should not sit there quietly. `expired` is red because the invitation window
 * closed and somebody has to re-open it. `owner_claimed` is the resolved state.
 */
const CLAIM_INTENT: Readonly<Record<AdminOboRow["claimStatus"], BadgeIntent>> = {
  registrant_held: "warning",
  owner_claimed: "success",
  expired: "danger",
};

const CLAIM_ACTION: Readonly<
  Record<AdminOboRow["claimStatus"], OboRegistration["action"]>
> = {
  registrant_held: { label: "Re-send invite", variant: "ghost" },
  owner_claimed: { label: "Open record", variant: "ghost" },
  expired: { label: "Extend & re-send", variant: "outline" },
};

export function presentObo(row: AdminOboRow): OboRegistration {
  return {
    org: row.orgName,
    district: row.districtName ?? EMPTY,
    // The registrant is the agent who filed on the owner's behalf.
    agent: row.registrantName ?? EMPTY,
    owner: row.intendedOwnerName,
    claim: {
      text: detail(
        humanise(row.claimStatus),
        row.claimedAt ? `claimed ${date(row.claimedAt)}` : null,
        // Only worth saying while it is still true. Once claimed, the lock is
        // gone and repeating it would describe a state that has ended.
        row.claimStatus !== "owner_claimed" && row.payoutLocked
          ? "payout locked"
          : null,
      ),
      intent: CLAIM_INTENT[row.claimStatus],
    },
    action: CLAIM_ACTION[row.claimStatus],
  };
}

/* ---------- Detail sub-tables ---------- */

/**
 * One person's membership of a business.
 *
 * Rendered as a `SectionRow` rather than a bespoke type: `lib/types.ts` has no
 * org-member row, and the detail screen's sub-tables all share that shape.
 * A removed member is neutral, not red — leaving a business is normal, and
 * colouring it as a failure would make every past employee look like an
 * incident.
 */
export function presentOrgMember(member: AdminOrgMember): SectionRow {
  return {
    ref: member.userId,
    subject: member.name ?? member.email,
    context: detail(
      humanise(member.orgRole),
      `joined ${date(member.joinedAt)}`,
      member.removedAt ? `removed ${date(member.removedAt)}` : null,
    ),
    state: member.status,
    intent: member.removedAt ? "default" : "success",
  };
}

/**
 * One property, which is one branch, of this business (ADR-054 AC-R4).
 *
 * `published` is the only colour here, because it is the only fact on the row
 * that has a right and a wrong side: an unpublished property earns no bookings.
 * An archived branch reads as archived rather than as a draft, because it was
 * retired on purpose and will not be published again as it stands.
 */
export function presentOrgProperty(property: AdminOrgProperty): SectionRow {
  return {
    ref: property.id,
    subject: property.name,
    context: detail(
      property.isHeadOffice ? "head office" : "branch",
      humanise(property.domain),
      property.districtName,
      property.rraBranchId ? `RRA branch ${property.rraBranchId}` : null,
      `${count(property.roomCount)} rooms`,
      `${count(property.roomTypeCount)} room types`,
      `${count(property.listingCount)} listings`,
      property.archivedAt ? `archived ${date(property.archivedAt)}` : null,
    ),
    state: property.archivedAt ? "archived" : property.published ? "published" : "draft",
    intent: property.published && !property.archivedAt ? "success" : "default",
  };
}
