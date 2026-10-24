import { z } from "zod";
import { RwPhoneNumber } from "../phone";
import { Uuid } from "../primitives";
import { CalendarDay } from "./dates";
import { LeaseContract } from "./contract";
import { PersonEmail, PersonName, checkEmailTypo, idNumberProblem, normaliseIdNumber } from "./identity";
import { GraceDays, LeaseAction, LeaseTab, NoticeDays, RentDueDay } from "./lease";
import {
  IdKind,
  LeaseActorRole,
  LeaseDepositStatus,
  LeaseEventKind,
  LeaseInvitationStatus,
  LeaseSignerRole,
  LeaseSigningMethod,
  LeaseStatus,
  MomoNetwork,
  PayoutAccountKind,
  PayoutAccountStatus,
  PositiveRwf,
  RentalUnitState,
  Rwf,
  TaxpayerKind,
  UnitKitchen,
} from "./vocab";

// ===========================================================================
// The landlord's rentals API: what each route takes and answers
// ===========================================================================
//
// Every route is under `/api/v1/ops/`, behind a session and the workspace, for
// a residence business only (any other business is answered 404). Requests
// are checked with these schemas on the server; the app reads the answers
// with the same ones. Money is whole francs; days are `yyyy-mm-dd` in Kigali;
// moments are ISO timestamps.

const IsoMoment = z.string();

// --- The landlord's profile and setup ------------------------------------------

/** Who signs leases for the business, as their ID document names them, and how tenants reach the landlord. */
export const LandlordSignatory = z.object({
  name: z.string().nullable(),
  idKind: IdKind.nullable(),
  idNumber: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
});
export type LandlordSignatory = z.infer<typeof LandlordSignatory>;

/** What a new lease starts from. Each lease keeps its own copy. */
export const LeaseDefaults = z.object({
  graceDays: z.number().int(),
  noticeDays: z.number().int(),
  /** Null: rent falls due on the day of the month the lease starts. */
  rentDueDay: z.number().int().nullable(),
  autoStartLeases: z.boolean(),
  /** When the landlord last saved them; null while they are the starting values. */
  setAt: IsoMoment.nullable(),
});
export type LeaseDefaults = z.infer<typeof LeaseDefaults>;

/** `GET /ops/rentals/profile`. */
export const LandlordProfileView = z.object({
  orgId: Uuid,
  workspaceId: Uuid,
  legalName: z.string(),
  tin: z.string().nullable(),
  taxpayerKind: TaxpayerKind.nullable(),
  signatory: LandlordSignatory,
  leaseDefaults: LeaseDefaults,
  brokerFeePercent: z.number().int().nullable(),
  setupCompletedAt: IsoMoment.nullable(),
});
export type LandlordProfileView = z.infer<typeof LandlordProfileView>;

/** `PUT /ops/rentals/profile/lease-defaults`: the whole set, so the form and the row never half agree. */
export const LeaseDefaultsRequest = z.object({
  graceDays: GraceDays,
  noticeDays: NoticeDays,
  /** Null: the day of the month each lease starts. */
  rentDueDay: RentDueDay.nullable(),
  autoStartLeases: z.boolean(),
});
export type LeaseDefaultsRequest = z.infer<typeof LeaseDefaultsRequest>;

/**
 * `PUT /ops/rentals/profile/signatory`: who signs leases for the business and
 * the contact a tenant sees. The contract names the signatory as typed here,
 * and the signatory types the same name to sign.
 */
export const SignatoryRequest = z
  .object({
    name: PersonName,
    idKind: IdKind,
    idNumber: z
      .string({ required_error: "Enter the ID or passport number." })
      .trim()
      .min(1, "Enter the ID or passport number.")
      .max(40, "That number is too long.")
      .transform(normaliseIdNumber),
    contactPhone: RwPhoneNumber,
    contactEmail: PersonEmail,
    /** The email is right as typed, though it looks like a typo. */
    confirmEmail: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const problem = idNumberProblem(v.idKind, v.idNumber);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ["idNumber"] });
    checkEmailTypo(v.contactEmail, v.confirmEmail, ctx, ["contactEmail"]);
  });
export type SignatoryRequest = z.infer<typeof SignatoryRequest>;

/** The steps a new landlord goes through, in order. */
export const RentalsSetupStep = z.enum(["location", "units", "getting_paid", "lease_defaults", "signatory"]);
export type RentalsSetupStep = z.infer<typeof RentalsSetupStep>;
export const RENTALS_SETUP_STEP_LABEL: Readonly<Record<RentalsSetupStep, string>> = {
  location: "Where your homes are",
  units: "Your units",
  getting_paid: "Getting paid",
  lease_defaults: "Lease defaults",
  signatory: "Who signs leases",
};

/** `GET /ops/rentals/setup`: what is done, and what is next. */
export const RentalsSetupView = z.object({
  steps: z.array(
    z.object({
      step: RentalsSetupStep,
      done: z.boolean(),
      /** One plain line: "3 units", "MTN MoMo 078•••••456", "Add the village". */
      detail: z.string(),
    }),
  ),
  /** The first step not done, or null when all are. */
  next: RentalsSetupStep.nullable(),
  complete: z.boolean(),
  setupCompletedAt: IsoMoment.nullable(),
});
export type RentalsSetupView = z.infer<typeof RentalsSetupView>;

// --- Payout accounts ------------------------------------------------------------------

/**
 * One payout account, as the landlord's screen shows it. A bank account
 * number is kept encrypted and only its last four digits ever leave the API;
 * an edit sends the whole number again.
 */
export const PayoutAccountView = z.object({
  id: Uuid,
  kind: PayoutAccountKind,
  accountName: z.string(),
  bankName: z.string().nullable(),
  accountLast4: z.string().nullable(),
  momoNetwork: MomoNetwork.nullable(),
  /** `+2507…`; the landlord's own number. */
  momoPhone: z.string().nullable(),
  merchantCode: z.string().nullable(),
  /** "Bank of Kigali ••••5678", "MTN MoMo 078•••••456", "MoMo Pay 12••56". */
  destination: z.string(),
  isPrimary: z.boolean(),
  status: PayoutAccountStatus,
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type PayoutAccountView = z.infer<typeof PayoutAccountView>;

/** Every write answers with the whole list, so the screen redraws from one response. */
export const PayoutAccountList = z.object({ accounts: z.array(PayoutAccountView) });
export type PayoutAccountList = z.infer<typeof PayoutAccountList>;

// --- Units and blocks ----------------------------------------------------------------

/** Whether a unit is lived in, promised, or free: worked out from its leases, never stored. */
export const UnitOccupancy = z.enum(["occupied", "reserved", "vacant"]);
export type UnitOccupancy = z.infer<typeof UnitOccupancy>;
export const UNIT_OCCUPANCY_LABEL: Readonly<Record<UnitOccupancy, string>> = {
  occupied: "Occupied",
  reserved: "Lease signed or out for signing",
  vacant: "Vacant",
};

/** The tabs of the units list. */
export const UnitTab = z.enum(["all", "occupied", "vacant", "off_market", "retired"]);
export type UnitTab = z.infer<typeof UnitTab>;

export const UnitLeaseSummary = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  tenantName: z.string(),
  startDate: CalendarDay,
  endDate: CalendarDay,
});
export type UnitLeaseSummary = z.infer<typeof UnitLeaseSummary>;

export const RentalUnitView = z.object({
  id: Uuid,
  propertyId: Uuid,
  propertyName: z.string(),
  blockId: Uuid.nullable(),
  blockCode: z.string().nullable(),
  blockName: z.string().nullable(),
  label: z.string(),
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  kitchen: UnitKitchen.nullable(),
  furnished: z.boolean(),
  floor: z.number().int().nullable(),
  sizeSqm: z.number().int().nullable(),
  askingRentRwf: z.number().int().nullable(),
  askingDepositRwf: z.number().int().nullable(),
  state: RentalUnitState,
  listed: z.boolean(),
  availableFrom: CalendarDay.nullable(),
  note: z.string().nullable(),
  occupancy: UnitOccupancy,
  /** The lease living in it now, or the next one signed or out for signing. */
  currentLease: UnitLeaseSummary.nullable(),
  /** The day after the last lease on it ended; null while let or never let. */
  vacantSince: CalendarDay.nullable(),
  retiredAt: IsoMoment.nullable(),
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type RentalUnitView = z.infer<typeof RentalUnitView>;

/** `GET /ops/units?tab&blockId&q`. No tab: every unit not retired. */
export const UnitListQuery = z.object({
  tab: UnitTab.optional(),
  blockId: Uuid.optional(),
  q: z.string().trim().max(80).optional(),
});
export type UnitListQuery = z.infer<typeof UnitListQuery>;

/** `GET /ops/tenants?q`: at most this many, the most recently changed first. */
export const TENANT_SEARCH_LIMIT = 50;
export const TenantSearchQuery = z.object({ q: z.string().trim().max(120).optional() });
export type TenantSearchQuery = z.infer<typeof TenantSearchQuery>;

export const RentalUnitList = z.object({
  units: z.array(RentalUnitView),
  /** How many units each tab holds, over the whole business (the search and block filter aside). */
  counts: z.record(UnitTab, z.number().int()),
});
export type RentalUnitList = z.infer<typeof RentalUnitList>;

const UnitLabel = z
  .string({ required_error: "Name the unit, like A-01." })
  .trim()
  .min(1, "Name the unit, like A-01.")
  .max(40, "Keep the unit name under 40 characters.");
const RoomCount = z.number().int("Whole rooms only.").min(0, "Pick 0 or more.").max(50, "That is too many rooms.");

/** The facts a unit form edits. `propertyId` is needed only when the business has more than one building. */
const UnitFields = {
  propertyId: Uuid.optional(),
  blockId: Uuid.nullable().optional(),
  label: UnitLabel,
  bedrooms: RoomCount.nullable().optional(),
  bathrooms: RoomCount.nullable().optional(),
  kitchen: UnitKitchen.nullable().optional(),
  furnished: z.boolean().optional(),
  floor: z.number().int("Pick a floor.").min(-5, "Pick a floor.").max(200, "Pick a floor.").nullable().optional(),
  sizeSqm: z.number().int("Whole square metres.").min(1, "Enter the size in square metres.").max(100_000).nullable().optional(),
  /** What the landlord asks while it is vacant. Optional, but a unit can't be listed without it. */
  askingRentRwf: PositiveRwf.nullable().optional(),
  askingDepositRwf: Rwf.nullable().optional(),
  availableFrom: CalendarDay.nullable().optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").nullable().optional(),
  /** `retired` is its own command (`POST /ops/units/:id/retire`). */
  state: z.enum(["active", "off_market"]).optional(),
};

/** `POST /ops/units`. */
export const CreateUnitRequest = z.object(UnitFields);
export type CreateUnitRequest = z.infer<typeof CreateUnitRequest>;

/** `PATCH /ops/units/:id`: only what is sent changes. */
export const UpdateUnitRequest = z
  .object(UnitFields)
  .omit({ propertyId: true })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Change at least one thing.", path: [] });
export type UpdateUnitRequest = z.infer<typeof UpdateUnitRequest>;

/** The most units one bulk add makes. */
export const MAX_BULK_UNITS = 200;

/**
 * `POST /ops/units/bulk`: several units with the same facts, named one by one
 * (the form makes the names from a pattern, like A-01 to A-12).
 */
export const BulkUnitsRequest = z
  .object({
    ...UnitFields,
    label: z.undefined().optional(),
    labels: z
      .array(UnitLabel)
      .min(1, "Name at least one unit.")
      .max(MAX_BULK_UNITS, `Add at most ${MAX_BULK_UNITS} units at once.`),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.labels.forEach((label, i) => {
      const key = label.trim().toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is named twice.`, path: ["labels", i] });
      seen.add(key);
    });
  });
export type BulkUnitsRequest = z.infer<typeof BulkUnitsRequest>;

export const BulkUnitsResult = z.object({ created: z.array(RentalUnitView) });
export type BulkUnitsResult = z.infer<typeof BulkUnitsResult>;

export const BlockView = z.object({
  id: Uuid,
  propertyId: Uuid,
  code: z.string(),
  name: z.string(),
  kind: z.string().nullable(),
  sortOrder: z.number().int(),
  /** Units in it that are not retired. */
  unitCount: z.number().int(),
});
export type BlockView = z.infer<typeof BlockView>;

export const BlockList = z.object({ blocks: z.array(BlockView) });
export type BlockList = z.infer<typeof BlockList>;

const BlockFields = {
  propertyId: Uuid.optional(),
  /** "A": what unit names in it start with. */
  code: z
    .string({ required_error: "Give the block a short code, like A." })
    .trim()
    .min(1, "Give the block a short code, like A.")
    .max(10, "Keep the code under 10 characters.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Use letters, digits, spaces or dashes."),
  name: z.string({ required_error: "Name the block." }).trim().min(1, "Name the block.").max(80, "Keep the name under 80 characters."),
  kind: z.string().trim().max(80, "Keep it under 80 characters.").nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

/** `POST /ops/blocks`. */
export const CreateBlockRequest = z.object(BlockFields);
export type CreateBlockRequest = z.infer<typeof CreateBlockRequest>;

/** `PATCH /ops/blocks/:id`. */
export const UpdateBlockRequest = z
  .object(BlockFields)
  .omit({ propertyId: true })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Change at least one thing.", path: [] });
export type UpdateBlockRequest = z.infer<typeof UpdateBlockRequest>;

// --- Tenants -----------------------------------------------------------------------------

export const TenantLeaseSummary = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  unitLabel: z.string(),
  startDate: CalendarDay,
  endDate: CalendarDay,
});
export type TenantLeaseSummary = z.infer<typeof TenantLeaseSummary>;

/** A tenant as one landlord business knows them. */
export const TenantView = z.object({
  id: Uuid,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  idKind: IdKind.nullable(),
  idNumber: z.string().nullable(),
  nationality: z.string().nullable(),
  /** They accepted an invitation and signed in. */
  hasAccount: z.boolean(),
  /** False once they signed a contract: what they signed names them as they were. */
  editable: z.boolean(),
  leases: z.array(TenantLeaseSummary),
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type TenantView = z.infer<typeof TenantView>;

export const TenantList = z.object({ tenants: z.array(TenantView) });
export type TenantList = z.infer<typeof TenantList>;

// --- Leases -------------------------------------------------------------------------------

/** One row of the lease list. */
export const LeaseListItem = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  tab: LeaseTab,
  tenant: z.object({ id: Uuid, fullName: z.string(), email: z.string().nullable() }),
  unit: z.object({ id: Uuid, label: z.string(), blockCode: z.string().nullable(), propertyName: z.string() }),
  monthlyRentRwf: z.number().int(),
  startDate: CalendarDay,
  endDate: CalendarDay,
  /** What to do next, in words ("Review and sign", "Waiting for the tenant to sign"). */
  nextAction: z.string().nullable(),
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type LeaseListItem = z.infer<typeof LeaseListItem>;

/** The lease list's page size. */
export const LEASE_PAGE_SIZE = 25;

export const LeaseListPage = z.object({
  items: z.array(LeaseListItem),
  total: z.number().int(),
  page: z.number().int().min(1),
  pageSize: z.number().int(),
  tab: LeaseTab.nullable(),
});
export type LeaseListPage = z.infer<typeof LeaseListPage>;

/** `GET /ops/leases?tab&q&page`. No tab: every lease. */
export const LeaseListQuery = z.object({
  tab: LeaseTab.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type LeaseListQuery = z.infer<typeof LeaseListQuery>;

/** `GET /ops/leases/counts`: how many leases each tab holds. */
export const LeaseCounts = z.object({
  counts: z.record(LeaseTab, z.number().int()),
  total: z.number().int(),
});
export type LeaseCounts = z.infer<typeof LeaseCounts>;

export const LeaseTermsView = z.object({
  startDate: CalendarDay,
  endDate: CalendarDay,
  billingStartsOn: CalendarDay,
  monthlyRentRwf: z.number().int(),
  depositRwf: z.number().int(),
  rentDueDay: z.number().int(),
  graceDays: z.number().int(),
  noticeDays: z.number().int(),
  occupants: z.array(z.string()),
  otherTerms: z.string().nullable(),
});
export type LeaseTermsView = z.infer<typeof LeaseTermsView>;

export const LeaseSignatureView = z.object({
  id: Uuid,
  role: LeaseSignerRole,
  version: z.number().int(),
  typedName: z.string().nullable(),
  method: LeaseSigningMethod,
  signedAt: IsoMoment,
  voidedAt: IsoMoment.nullable(),
  note: z.string().nullable(),
});
export type LeaseSignatureView = z.infer<typeof LeaseSignatureView>;

export const LeaseVersionSummary = z.object({
  id: Uuid,
  version: z.number().int(),
  templateVersion: z.number().int(),
  contentHash: z.string(),
  createdAt: IsoMoment,
});
export type LeaseVersionSummary = z.infer<typeof LeaseVersionSummary>;

export const LeaseInvitationView = z.object({
  status: LeaseInvitationStatus,
  email: z.string(),
  sentAt: IsoMoment,
  lastSentAt: IsoMoment,
  sendCount: z.number().int(),
  expiresAt: IsoMoment,
  acceptedAt: IsoMoment.nullable(),
});
export type LeaseInvitationView = z.infer<typeof LeaseInvitationView>;

/** What the lease has asked for and been paid so far. */
export const LeaseChargesSummary = z.object({
  /** Rent charges raised so far. */
  rentChargedRwf: z.number().int(),
  rentPaidRwf: z.number().int(),
  /** Open rent past its due day plus grace. */
  overdueRwf: z.number().int(),
  /** Everything still owed on charges raised (rent and deposit). */
  balanceRwf: z.number().int(),
  nextDue: z.object({ dueOn: CalendarDay, amountRwf: z.number().int() }).nullable(),
  depositAgreedRwf: z.number().int(),
  depositStatus: LeaseDepositStatus.nullable(),
});
export type LeaseChargesSummary = z.infer<typeof LeaseChargesSummary>;

/** `GET /ops/leases/:id`: the lease record. */
export const LeaseDetail = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  tab: LeaseTab,
  /** The moves this lease allows now (`LEASE_TRANSITIONS`). */
  actions: z.array(LeaseAction),
  nextAction: z.string().nullable(),
  property: z.object({ id: Uuid, name: z.string() }),
  unit: z.object({ id: Uuid, label: z.string(), blockCode: z.string().nullable(), blockName: z.string().nullable() }),
  tenant: TenantView.omit({ leases: true }),
  terms: LeaseTermsView,
  currentVersion: LeaseVersionSummary.nullable(),
  signatures: z.array(LeaseSignatureView),
  invitation: LeaseInvitationView.nullable(),
  charges: LeaseChargesSummary,
  /** What still has to be filled in before the landlord can sign, in words. Empty when ready. */
  contractProblems: z.array(z.string()),
  broker: z.object({ id: Uuid, name: z.string().nullable() }).nullable(),
  supersedesLeaseId: Uuid.nullable(),
  signedAt: IsoMoment.nullable(),
  activatedAt: IsoMoment.nullable(),
  endingSince: IsoMoment.nullable(),
  endedOn: CalendarDay.nullable(),
  endReason: z.string().nullable(),
  cancelledAt: IsoMoment.nullable(),
  cancelReason: z.string().nullable(),
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type LeaseDetail = z.infer<typeof LeaseDetail>;

/** One row of a lease's timeline. */
export const LeaseEventView = z.object({
  id: Uuid,
  kind: LeaseEventKind,
  actorRole: LeaseActorRole,
  /** Who did it, by name; null for the system. */
  actorName: z.string().nullable(),
  visibleToTenant: z.boolean(),
  payload: z.record(z.unknown()),
  occurredAt: IsoMoment,
});
export type LeaseEventView = z.infer<typeof LeaseEventView>;

export const LeaseEventList = z.object({ events: z.array(LeaseEventView) });
export type LeaseEventList = z.infer<typeof LeaseEventList>;

/** `GET /ops/leases/:id/contract`: the current version's text, and the versions before it. */
export const LeaseContractView = z.object({
  leaseId: Uuid,
  version: LeaseVersionSummary,
  /**
   * The text as frozen. Template 3 is `LeaseContract`; a version carried over
   * by migration 0077 (template 0) holds the old free-form JSON.
   */
  content: z.union([LeaseContract, z.record(z.unknown())]),
  /** Both sides have signed this version. */
  signed: z.boolean(),
  versions: z.array(LeaseVersionSummary),
});
export type LeaseContractView = z.infer<typeof LeaseContractView>;
