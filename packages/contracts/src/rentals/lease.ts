import { z } from "zod";
import { RwPhoneNumber } from "../phone";
import { Uuid } from "../primitives";
import { CountryCode } from "../registration";
import {
  CalendarDay,
  LEASE_NOTICE_MAX_DAYS,
  LEASE_NOTICE_MIN_DAYS,
  addDays,
  kigaliToday,
  leaseDatesProblem,
} from "./dates";
import { PersonEmail, PersonName, checkEmailTypo, idNumberProblem, normaliseIdNumber } from "./identity";
import { IdKind, LeaseStatus, PositiveRwf, Rwf } from "./vocab";

// ===========================================================================
// A lease's life: the moves between statuses, the tab it shows under, and the
// shapes that draft and edit it
// ===========================================================================

/**
 * What can happen to a lease. Each action moves a lease from one status to
 * another; `LEASE_TRANSITIONS` says which actions each status allows.
 */
export const LeaseAction = z.enum([
  /** The landlord signs the draft; the invitation goes to the tenant. */
  "landlord_sign",
  /** The terms or the tenant's details change. On a lease out for signature this voids the landlord's signature. */
  "edit_terms",
  /** The tenant signs. */
  "tenant_sign",
  /** The landlord presses Start, or the job starts it on its start date. */
  "start",
  /** The landlord cancels a lease that never started. */
  "cancel",
  /** The landlord acknowledges a move out notice. */
  "acknowledge_notice",
  /** The end date is within `LEASE_ENDING_WINDOW_DAYS`. */
  "near_end",
  /** The notice is withdrawn: the lease runs on. */
  "withdraw_notice",
  /** The landlord records the day the tenant moved out. */
  "record_move_out",
]);
export type LeaseAction = z.infer<typeof LeaseAction>;

/**
 * The lease state machine (blueprint 1.3). The API is the only enforcer; a
 * client reads it to offer only the moves that will succeed.
 *
 * - draft → pending_signature when the landlord signs; editing keeps it a draft.
 * - pending_signature → signed when the tenant signs; back to draft when the
 *   terms are edited (the landlord's signature is voided and a new contract
 *   version is made).
 * - signed → active when the tenancy starts.
 * - draft, pending_signature and signed can be cancelled.
 * - active → ending when a notice is acknowledged or the end date is near.
 * - ending → ended when the move out is recorded, or back to active when the
 *   notice is withdrawn.
 * - ended and cancelled are final.
 */
export const LEASE_TRANSITIONS: Readonly<Record<LeaseStatus, Readonly<Partial<Record<LeaseAction, LeaseStatus>>>>> = {
  draft: { landlord_sign: "pending_signature", edit_terms: "draft", cancel: "cancelled" },
  pending_signature: { tenant_sign: "signed", edit_terms: "draft", cancel: "cancelled" },
  signed: { start: "active", cancel: "cancelled" },
  active: { acknowledge_notice: "ending", near_end: "ending" },
  ending: { record_move_out: "ended", withdraw_notice: "active" },
  ended: {},
  cancelled: {},
};

/** The status `action` takes a lease in `from` to, or null when the action is not allowed. */
export function nextLeaseStatus(from: LeaseStatus, action: LeaseAction): LeaseStatus | null {
  return LEASE_TRANSITIONS[from][action] ?? null;
}

/** The actions a lease in `status` allows. */
export function leaseActionsFrom(status: LeaseStatus): LeaseAction[] {
  return LeaseAction.options.filter((a) => LEASE_TRANSITIONS[status][a] !== undefined);
}

/** May a lease move from `from` to a different status `to`? */
export function canTransition(from: LeaseStatus, to: LeaseStatus): boolean {
  if (from === to) return false;
  return Object.values(LEASE_TRANSITIONS[from]).includes(to);
}

/** Can the terms or the tenant still be changed? Only before the tenant signs. */
export function canEditLease(status: LeaseStatus): boolean {
  return nextLeaseStatus(status, "edit_terms") !== null;
}

/** Does editing a lease in `status` void the landlord's signature? */
export function editVoidsLandlordSignature(status: LeaseStatus): boolean {
  return status === "pending_signature";
}

/** The final statuses: nothing moves a lease out of them. */
export const FINAL_LEASE_STATUSES: readonly LeaseStatus[] = ["ended", "cancelled"];

/** The statuses that hold the unit: two of these can never overlap in time on one unit. */
export const LIVE_LEASE_STATUSES: readonly LeaseStatus[] = ["pending_signature", "signed", "active", "ending"];

export function isFinalLease(status: LeaseStatus): boolean {
  return FINAL_LEASE_STATUSES.includes(status);
}

export function isLiveLease(status: LeaseStatus): boolean {
  return LIVE_LEASE_STATUSES.includes(status);
}

/** How close the end date comes before an active lease shows as ending. */
export const LEASE_ENDING_WINDOW_DAYS = 30;

/** Is an active lease's end date near enough that it should move to `ending`? */
export function endDateIsNear(endDate: string, today: string = kigaliToday()): boolean {
  return endDate <= addDays(today, LEASE_ENDING_WINDOW_DAYS);
}

/**
 * The move the daily job makes on a lease today, or null: start a signed
 * lease on its start date (when the landlord lets Injishi start leases), and
 * move an active lease whose end is near to `ending`.
 */
export function scheduledLeaseAction(
  lease: { status: LeaseStatus; startDate: string; endDate: string },
  opts: { today?: string; autoStart?: boolean } = {},
): LeaseAction | null {
  const today = opts.today ?? kigaliToday();
  if (lease.status === "signed" && (opts.autoStart ?? true) && lease.startDate <= today) return "start";
  if (lease.status === "active" && endDateIsNear(lease.endDate, today)) return "near_end";
  return null;
}

// --- Tabs ------------------------------------------------------------------------

/** The tabs of the landlord's lease list. One per status, in the order a lease lives them. */
export const LeaseTab = z.enum(["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]);
export type LeaseTab = z.infer<typeof LeaseTab>;

export const LEASE_TAB_LABEL: Readonly<Record<LeaseTab, string>> = {
  to_sign: "To sign",
  waiting_for_tenant: "Waiting for tenant",
  ready_to_start: "Ready to start",
  active: "Active",
  ending: "Ending",
  ended: "Ended",
  cancelled: "Cancelled",
};

const TAB_OF: Readonly<Record<LeaseStatus, LeaseTab>> = {
  draft: "to_sign",
  pending_signature: "waiting_for_tenant",
  signed: "ready_to_start",
  active: "active",
  ending: "ending",
  ended: "ended",
  cancelled: "cancelled",
};

/** The tab a lease shows under. Worked out from its status, never stored. */
export function leaseTab(status: LeaseStatus): LeaseTab {
  return TAB_OF[status];
}

/** The statuses a tab lists (for the API's `?tab=` filter). */
export function leaseStatusesForTab(tab: LeaseTab): LeaseStatus[] {
  return LeaseStatus.options.filter((s) => TAB_OF[s] === tab);
}

// --- Drafting a lease ---------------------------------------------------------------

/** The grace days a lease gets when the landlord does not pick: rent is late 5 days after it is due. */
export const DEFAULT_GRACE_DAYS = 5;
export const MAX_GRACE_DAYS = 31;
/** The notice a lease asks for when the landlord does not pick. */
export const DEFAULT_NOTICE_DAYS = LEASE_NOTICE_MIN_DAYS;
/** The most people one lease names as living in the home with the tenant. */
export const MAX_OCCUPANTS = 12;

/** The day of the month rent falls due: 1 to 28, so it exists in every month. */
export const RentDueDay = z
  .number({ required_error: "Pick a day from 1 to 28.", invalid_type_error: "Pick a day from 1 to 28." })
  .int("Pick a day from 1 to 28.")
  .min(1, "Pick a day from 1 to 28.")
  .max(28, "Pick a day from 1 to 28.");

/**
 * The due day to suggest for a lease starting on `startDate`: the day the
 * tenant moves in, or the 28th for a start on the 29th to 31st.
 */
export function dueDayFromStart(startDate: string): number {
  const day = Number(startDate.slice(8, 10));
  return Number.isInteger(day) && day >= 1 ? Math.min(day, 28) : 1;
}

export const GraceDays = z
  .number({ invalid_type_error: "Pick from 0 to 31 days." })
  .int("Pick from 0 to 31 days.")
  .min(0, "Pick from 0 to 31 days.")
  .max(MAX_GRACE_DAYS, "Pick from 0 to 31 days.");

export const NoticeDays = z
  .number({ invalid_type_error: `Pick at least ${LEASE_NOTICE_MIN_DAYS} days.` })
  .int(`Pick at least ${LEASE_NOTICE_MIN_DAYS} days.`)
  .min(LEASE_NOTICE_MIN_DAYS, `Notice is at least ${LEASE_NOTICE_MIN_DAYS} days.`)
  .max(LEASE_NOTICE_MAX_DAYS, `Notice is at most ${LEASE_NOTICE_MAX_DAYS} days.`);

const OtherTerms = z.string().trim().max(2000, "Keep other terms under 2000 characters.");
const Occupants = z
  .array(PersonName)
  .max(MAX_OCCUPANTS, `Name at most ${MAX_OCCUPANTS} people.`)
  .refine((names) => new Set(names.map((n) => n.toLowerCase())).size === names.length, "Each person once.");

/** The tenant, as a lease draft names them. */
const TenantShape = {
  fullName: PersonName,
  email: PersonEmail,
  /** A Rwandan mobile number, stored as `+2507xxxxxxxx`. */
  phone: RwPhoneNumber,
  idKind: IdKind,
  /** Stored without spaces or dashes, letters upper case. */
  idNumber: z
    .string({ required_error: "Enter the ID or passport number." })
    .trim()
    .min(1, "Enter the ID or passport number.")
    .max(40, "That number is too long.")
    .transform(normaliseIdNumber),
  /** ISO country code (`RW` for a Rwandan). Required, so a partial edit never resets it. */
  nationality: CountryCode,
};

export const TenantInput = z.object(TenantShape).superRefine((t, ctx) => checkTenantId(t, ctx, []));
export type TenantInput = z.infer<typeof TenantInput>;

/**
 * Change a tenant's record (`PATCH /ops/tenants/:id`). Only what is sent
 * changes. The API refuses once the tenant has signed a contract: what they
 * signed names them as they were. A new email goes through the same typo
 * guard as a new lease's.
 */
export const UpdateTenantRequest = z
  .object({ ...TenantShape, confirmEmail: z.boolean().optional() })
  .partial()
  .superRefine((v, ctx) => {
    const { confirmEmail: _confirm, ...fields } = v;
    if (Object.values(fields).every((x) => x === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Change at least one thing.", path: [] });
    }
    checkTenantId(v, ctx, []);
    checkEmailTypo(v.email, v.confirmEmail, ctx, ["email"]);
  });
export type UpdateTenantRequest = z.infer<typeof UpdateTenantRequest>;

function checkTenantId(
  t: { idKind?: IdKind; idNumber?: string },
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (t.idKind === undefined || t.idNumber === undefined) return;
  const problem = idNumberProblem(t.idKind, t.idNumber);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: [...path, "idNumber"] });
}

/** The terms of a lease, without defaults, so a partial edit never resets one. */
const TermsShape = {
  startDate: CalendarDay,
  endDate: CalendarDay,
  /**
   * For a tenancy that began before it came onto Injishi: the day rent starts
   * being charged here. Absent: from the start date.
   */
  billingStartsOn: CalendarDay.nullable(),
  monthlyRentRwf: PositiveRwf,
  depositRwf: Rwf,
  rentDueDay: RentDueDay,
  graceDays: GraceDays,
  noticeDays: NoticeDays,
  /** The people who will live in the home with the tenant. */
  occupants: Occupants,
  otherTerms: OtherTerms.nullable(),
};

/**
 * The terms of a new lease. Grace days, notice days and the due day may be
 * left out: the API fills them from the landlord's lease defaults
 * (`landlord_profiles`), then from `DEFAULT_GRACE_DAYS`, `DEFAULT_NOTICE_DAYS`
 * and `dueDayFromStart`, so a form that pre-fills from the defaults and an API
 * client that sends nothing get the same lease.
 */
export const LeaseTermsInput = z.object({
  ...TermsShape,
  billingStartsOn: TermsShape.billingStartsOn.optional(),
  rentDueDay: RentDueDay.optional(),
  graceDays: GraceDays.optional(),
  noticeDays: NoticeDays.optional(),
  occupants: Occupants.default([]),
  otherTerms: TermsShape.otherTerms.optional(),
});
export type LeaseTermsInput = z.infer<typeof LeaseTermsInput>;

/**
 * Draft a lease on one unit (`POST /ops/leases`).
 *
 * The tenant is an existing tenant record (`tenantId`) or a new one
 * (`tenant`), never both. The tenant's email is where the invitation to read
 * and sign goes, so a likely typo is refused unless `confirmEmail` says it is
 * right. The dates are checked against Kigali today when the request is read.
 */
export const CreateLeaseRequest = z
  .object({
    unitId: Uuid,
    tenantId: Uuid.optional(),
    tenant: z.object(TenantShape).optional(),
    terms: LeaseTermsInput,
    /** The broker who brought this tenant, when one did. */
    brokerId: Uuid.optional(),
    /** The tenant's email is right as typed, though it looks like a typo. */
    confirmEmail: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.tenantId === undefined) === (v.tenant === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick a tenant or add a new one.", path: ["tenant"] });
    }
    if (v.tenant) {
      checkTenantId(v.tenant, ctx, ["tenant"]);
      checkEmailTypo(v.tenant.email, v.confirmEmail, ctx, ["tenant", "email"]);
    }
    const dates = leaseDatesProblem(v.terms, kigaliToday());
    if (dates) ctx.addIssue({ code: z.ZodIssueCode.custom, message: dates.message, path: ["terms", dates.path] });
  });
export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequest>;

/**
 * Change a lease before the tenant signs (`PATCH /ops/leases/:id`).
 * Only what is sent changes. The API merges it with the lease and checks the
 * merged dates with `leaseDatesProblem`; an edit of a lease out for signature
 * voids the landlord's signature and returns it to draft.
 */
export const EditLeaseRequest = z
  .object({
    unitId: Uuid.optional(),
    tenant: z.object(TenantShape).partial().optional(),
    terms: z.object(TermsShape).partial().optional(),
    confirmEmail: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const changes =
      (v.unitId !== undefined ? 1 : 0) +
      Object.values(v.tenant ?? {}).filter((x) => x !== undefined).length +
      Object.values(v.terms ?? {}).filter((x) => x !== undefined).length;
    if (changes === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Change at least one thing.", path: [] });
    if (v.tenant) {
      checkTenantId(v.tenant, ctx, ["tenant"]);
      checkEmailTypo(v.tenant.email, v.confirmEmail, ctx, ["tenant", "email"]);
    }
    const t = v.terms;
    if (t?.startDate && t.endDate && t.endDate <= t.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The lease has to end after it starts.", path: ["terms", "endDate"] });
    }
  });
export type EditLeaseRequest = z.infer<typeof EditLeaseRequest>;

/** Cancel a lease that has not started (`POST /ops/leases/:id/cancel`). */
export const CancelLeaseRequest = z.object({
  reason: z.string().trim().min(3, "Say why the lease is cancelled.").max(500, "Keep the reason under 500 characters."),
});
export type CancelLeaseRequest = z.infer<typeof CancelLeaseRequest>;
