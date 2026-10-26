"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseContractView = exports.LeaseEventList = exports.LeaseEventView = exports.LeaseDetail = exports.LeaseChargesSummary = exports.LeaseInvitationView = exports.LeaseVersionSummary = exports.LeaseSignatureView = exports.LeaseTermsView = exports.LeaseCounts = exports.LeaseListQuery = exports.LeaseListPage = exports.LEASE_PAGE_SIZE = exports.LeaseListItem = exports.TenantList = exports.TenantView = exports.TenantLeaseSummary = exports.UpdateBlockRequest = exports.CreateBlockRequest = exports.BlockList = exports.BlockView = exports.BulkUnitsResult = exports.BulkUnitsRequest = exports.MAX_BULK_UNITS = exports.UpdateUnitRequest = exports.CreateUnitRequest = exports.RentalUnitList = exports.TenantSearchQuery = exports.TENANT_SEARCH_LIMIT = exports.UnitListQuery = exports.RentalUnitView = exports.UnitLeaseSummary = exports.UnitTab = exports.UNIT_OCCUPANCY_LABEL = exports.UnitOccupancy = exports.PayoutAccountList = exports.PayoutAccountView = exports.RentalsSetupView = exports.RENTALS_SETUP_STEP_LABEL = exports.RentalsSetupStep = exports.SignatoryRequest = exports.LeaseDefaultsRequest = exports.LandlordProfileView = exports.LeaseDefaults = exports.LandlordSignatory = void 0;
const zod_1 = require("zod");
const phone_1 = require("../phone");
const primitives_1 = require("../primitives");
const brokers_1 = require("./brokers");
const dates_1 = require("./dates");
const contract_1 = require("./contract");
const identity_1 = require("./identity");
const lease_1 = require("./lease");
const move_outs_1 = require("./move-outs");
const vocab_1 = require("./vocab");
// ===========================================================================
// The landlord's rentals API: what each route takes and answers
// ===========================================================================
//
// Every route is under `/api/v1/ops/`, behind a session and the workspace, for
// a residence business only (any other business is answered 404). Requests
// are checked with these schemas on the server; the app reads the answers
// with the same ones. Money is whole francs; days are `yyyy-mm-dd` in Kigali;
// moments are ISO timestamps.
const IsoMoment = zod_1.z.string();
// --- The landlord's profile and setup ------------------------------------------
/** Who signs leases for the business, as their ID document names them, and how tenants reach the landlord. */
exports.LandlordSignatory = zod_1.z.object({
    name: zod_1.z.string().nullable(),
    idKind: vocab_1.IdKind.nullable(),
    idNumber: zod_1.z.string().nullable(),
    contactPhone: zod_1.z.string().nullable(),
    contactEmail: zod_1.z.string().nullable(),
});
/** What a new lease starts from. Each lease keeps its own copy. */
exports.LeaseDefaults = zod_1.z.object({
    graceDays: zod_1.z.number().int(),
    noticeDays: zod_1.z.number().int(),
    /** Null: rent falls due on the day of the month the lease starts. */
    rentDueDay: zod_1.z.number().int().nullable(),
    autoStartLeases: zod_1.z.boolean(),
    /** When the landlord last saved them; null while they are the starting values. */
    setAt: IsoMoment.nullable(),
});
/** `GET /ops/rentals/profile`. */
exports.LandlordProfileView = zod_1.z.object({
    orgId: primitives_1.Uuid,
    workspaceId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    tin: zod_1.z.string().nullable(),
    taxpayerKind: vocab_1.TaxpayerKind.nullable(),
    signatory: exports.LandlordSignatory,
    leaseDefaults: exports.LeaseDefaults,
    brokerFeePercent: zod_1.z.number().int().nullable(),
    /** The fee a unit starts with when the landlord lets brokers offer it; null when not set. */
    brokerFee: brokers_1.BrokerFeeTerms.nullable(),
    setupCompletedAt: IsoMoment.nullable(),
});
/** `PUT /ops/rentals/profile/lease-defaults`: the whole set, so the form and the row never half agree. */
exports.LeaseDefaultsRequest = zod_1.z.object({
    graceDays: lease_1.GraceDays,
    noticeDays: lease_1.NoticeDays,
    /** Null: the day of the month each lease starts. */
    rentDueDay: lease_1.RentDueDay.nullable(),
    autoStartLeases: zod_1.z.boolean(),
});
/**
 * `PUT /ops/rentals/profile/signatory`: who signs leases for the business and
 * the contact a tenant sees. The contract names the signatory as typed here,
 * and the signatory types the same name to sign.
 */
exports.SignatoryRequest = zod_1.z
    .object({
    name: identity_1.PersonName,
    idKind: vocab_1.IdKind,
    idNumber: zod_1.z
        .string({ required_error: "Enter the ID or passport number." })
        .trim()
        .min(1, "Enter the ID or passport number.")
        .max(40, "That number is too long.")
        .transform(identity_1.normaliseIdNumber),
    contactPhone: phone_1.RwPhoneNumber,
    contactEmail: identity_1.PersonEmail,
    /** The email is right as typed, though it looks like a typo. */
    confirmEmail: zod_1.z.boolean().optional(),
})
    .superRefine((v, ctx) => {
    const problem = (0, identity_1.idNumberProblem)(v.idKind, v.idNumber);
    if (problem)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: problem, path: ["idNumber"] });
    (0, identity_1.checkEmailTypo)(v.contactEmail, v.confirmEmail, ctx, ["contactEmail"]);
});
/** The steps a new landlord goes through, in order. */
exports.RentalsSetupStep = zod_1.z.enum(["location", "units", "getting_paid", "lease_defaults", "signatory"]);
exports.RENTALS_SETUP_STEP_LABEL = {
    location: "Where your homes are",
    units: "Your units",
    getting_paid: "Getting paid",
    lease_defaults: "Lease defaults",
    signatory: "Who signs leases",
};
/** `GET /ops/rentals/setup`: what is done, and what is next. */
exports.RentalsSetupView = zod_1.z.object({
    steps: zod_1.z.array(zod_1.z.object({
        step: exports.RentalsSetupStep,
        done: zod_1.z.boolean(),
        /** One plain line: "3 units", "MTN MoMo 078•••••456", "Add the village". */
        detail: zod_1.z.string(),
    })),
    /** The first step not done, or null when all are. */
    next: exports.RentalsSetupStep.nullable(),
    complete: zod_1.z.boolean(),
    setupCompletedAt: IsoMoment.nullable(),
});
// --- Payout accounts ------------------------------------------------------------------
/**
 * One payout account, as the landlord's screen shows it. A bank account
 * number is kept encrypted and only its last four digits ever leave the API;
 * an edit sends the whole number again.
 */
exports.PayoutAccountView = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: vocab_1.PayoutAccountKind,
    accountName: zod_1.z.string(),
    bankName: zod_1.z.string().nullable(),
    accountLast4: zod_1.z.string().nullable(),
    momoNetwork: vocab_1.MomoNetwork.nullable(),
    /** `+2507…`; the landlord's own number. */
    momoPhone: zod_1.z.string().nullable(),
    merchantCode: zod_1.z.string().nullable(),
    /** "Bank of Kigali ••••5678", "MTN MoMo 078•••••456", "MoMo Pay 12••56". */
    destination: zod_1.z.string(),
    isPrimary: zod_1.z.boolean(),
    status: vocab_1.PayoutAccountStatus,
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
/** Every write answers with the whole list, so the screen redraws from one response. */
exports.PayoutAccountList = zod_1.z.object({ accounts: zod_1.z.array(exports.PayoutAccountView) });
// --- Units and blocks ----------------------------------------------------------------
/** Whether a unit is lived in, promised, or free: worked out from its leases, never stored. */
exports.UnitOccupancy = zod_1.z.enum(["occupied", "reserved", "vacant"]);
exports.UNIT_OCCUPANCY_LABEL = {
    occupied: "Occupied",
    reserved: "Lease signed or out for signing",
    vacant: "Vacant",
};
/** The tabs of the units list. */
exports.UnitTab = zod_1.z.enum(["all", "occupied", "vacant", "off_market", "retired"]);
exports.UnitLeaseSummary = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    tenantName: zod_1.z.string(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
});
exports.RentalUnitView = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    blockId: primitives_1.Uuid.nullable(),
    blockCode: zod_1.z.string().nullable(),
    blockName: zod_1.z.string().nullable(),
    label: zod_1.z.string(),
    bedrooms: zod_1.z.number().int().nullable(),
    bathrooms: zod_1.z.number().int().nullable(),
    kitchen: vocab_1.UnitKitchen.nullable(),
    furnished: zod_1.z.boolean(),
    floor: zod_1.z.number().int().nullable(),
    sizeSqm: zod_1.z.number().int().nullable(),
    askingRentRwf: zod_1.z.number().int().nullable(),
    askingDepositRwf: zod_1.z.number().int().nullable(),
    state: vocab_1.RentalUnitState,
    listed: zod_1.z.boolean(),
    /** Brokers may offer this unit, for `brokerFee`. */
    brokerOffer: zod_1.z.boolean(),
    brokerFee: brokers_1.BrokerFeeTerms.nullable(),
    availableFrom: dates_1.CalendarDay.nullable(),
    note: zod_1.z.string().nullable(),
    occupancy: exports.UnitOccupancy,
    /** The lease living in it now, or the next one signed or out for signing. */
    currentLease: exports.UnitLeaseSummary.nullable(),
    /** The day after the last lease on it ended; null while let or never let. */
    vacantSince: dates_1.CalendarDay.nullable(),
    retiredAt: IsoMoment.nullable(),
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
/** `GET /ops/units?tab&blockId&q`. No tab: every unit not retired. */
exports.UnitListQuery = zod_1.z.object({
    tab: exports.UnitTab.optional(),
    blockId: primitives_1.Uuid.optional(),
    q: zod_1.z.string().trim().max(80).optional(),
});
/** `GET /ops/tenants?q`: at most this many, the most recently changed first. */
exports.TENANT_SEARCH_LIMIT = 50;
exports.TenantSearchQuery = zod_1.z.object({ q: zod_1.z.string().trim().max(120).optional() });
exports.RentalUnitList = zod_1.z.object({
    units: zod_1.z.array(exports.RentalUnitView),
    /** How many units each tab holds, over the whole business (the search and block filter aside). */
    counts: zod_1.z.record(exports.UnitTab, zod_1.z.number().int()),
});
const UnitLabel = zod_1.z
    .string({ required_error: "Name the unit, like A-01." })
    .trim()
    .min(1, "Name the unit, like A-01.")
    .max(40, "Keep the unit name under 40 characters.");
const RoomCount = zod_1.z.number().int("Whole rooms only.").min(0, "Pick 0 or more.").max(50, "That is too many rooms.");
/** The facts a unit form edits. `propertyId` is needed only when the business has more than one building. */
const UnitFields = {
    propertyId: primitives_1.Uuid.optional(),
    blockId: primitives_1.Uuid.nullable().optional(),
    label: UnitLabel,
    bedrooms: RoomCount.nullable().optional(),
    bathrooms: RoomCount.nullable().optional(),
    kitchen: vocab_1.UnitKitchen.nullable().optional(),
    furnished: zod_1.z.boolean().optional(),
    floor: zod_1.z.number().int("Pick a floor.").min(-5, "Pick a floor.").max(200, "Pick a floor.").nullable().optional(),
    sizeSqm: zod_1.z.number().int("Whole square metres.").min(1, "Enter the size in square metres.").max(100000).nullable().optional(),
    /** What the landlord asks while it is vacant. Optional, but a unit can't be listed without it. */
    askingRentRwf: vocab_1.PositiveRwf.nullable().optional(),
    askingDepositRwf: vocab_1.Rwf.nullable().optional(),
    availableFrom: dates_1.CalendarDay.nullable().optional(),
    note: zod_1.z.string().trim().max(500, "Keep the note under 500 characters.").nullable().optional(),
    /** `retired` is its own command (`POST /ops/units/:id/retire`). */
    state: zod_1.z.enum(["active", "off_market"]).optional(),
    /** Brokers may offer it: needs an asking rent and a fee. */
    brokerOffer: zod_1.z.boolean().optional(),
    /** What the landlord pays a broker who brings the tenant. Kept when brokers are switched off. */
    brokerFee: brokers_1.BrokerFeeTerms.nullable().optional(),
};
/** `POST /ops/units`. */
exports.CreateUnitRequest = zod_1.z.object(UnitFields);
/** `PATCH /ops/units/:id`: only what is sent changes. */
exports.UpdateUnitRequest = zod_1.z
    .object(UnitFields)
    .omit({ propertyId: true })
    .partial()
    .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Change at least one thing.", path: [] });
/** The most units one bulk add makes. */
exports.MAX_BULK_UNITS = 200;
/**
 * `POST /ops/units/bulk`: several units with the same facts, named one by one
 * (the form makes the names from a pattern, like A-01 to A-12).
 */
exports.BulkUnitsRequest = zod_1.z
    .object({
    ...UnitFields,
    label: zod_1.z.undefined().optional(),
    labels: zod_1.z
        .array(UnitLabel)
        .min(1, "Name at least one unit.")
        .max(exports.MAX_BULK_UNITS, `Add at most ${exports.MAX_BULK_UNITS} units at once.`),
})
    .superRefine((v, ctx) => {
    const seen = new Set();
    v.labels.forEach((label, i) => {
        const key = label.trim().toLowerCase();
        if (seen.has(key))
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: `${label} is named twice.`, path: ["labels", i] });
        seen.add(key);
    });
});
exports.BulkUnitsResult = zod_1.z.object({ created: zod_1.z.array(exports.RentalUnitView) });
exports.BlockView = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyId: primitives_1.Uuid,
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    kind: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    /** Units in it that are not retired. */
    unitCount: zod_1.z.number().int(),
});
exports.BlockList = zod_1.z.object({ blocks: zod_1.z.array(exports.BlockView) });
const BlockFields = {
    propertyId: primitives_1.Uuid.optional(),
    /** "A": what unit names in it start with. */
    code: zod_1.z
        .string({ required_error: "Give the block a short code, like A." })
        .trim()
        .min(1, "Give the block a short code, like A.")
        .max(10, "Keep the code under 10 characters.")
        .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Use letters, digits, spaces or dashes."),
    name: zod_1.z.string({ required_error: "Name the block." }).trim().min(1, "Name the block.").max(80, "Keep the name under 80 characters."),
    kind: zod_1.z.string().trim().max(80, "Keep it under 80 characters.").nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(10000).optional(),
};
/** `POST /ops/blocks`. */
exports.CreateBlockRequest = zod_1.z.object(BlockFields);
/** `PATCH /ops/blocks/:id`. */
exports.UpdateBlockRequest = zod_1.z
    .object(BlockFields)
    .omit({ propertyId: true })
    .partial()
    .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Change at least one thing.", path: [] });
// --- Tenants -----------------------------------------------------------------------------
exports.TenantLeaseSummary = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    unitLabel: zod_1.z.string(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
});
/** A tenant as one landlord business knows them. */
exports.TenantView = zod_1.z.object({
    id: primitives_1.Uuid,
    fullName: zod_1.z.string(),
    email: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    idKind: vocab_1.IdKind.nullable(),
    idNumber: zod_1.z.string().nullable(),
    nationality: zod_1.z.string().nullable(),
    /** They accepted an invitation and signed in. */
    hasAccount: zod_1.z.boolean(),
    /** False once they signed a contract: what they signed names them as they were. */
    editable: zod_1.z.boolean(),
    leases: zod_1.z.array(exports.TenantLeaseSummary),
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
exports.TenantList = zod_1.z.object({ tenants: zod_1.z.array(exports.TenantView) });
// --- Leases -------------------------------------------------------------------------------
/** One row of the lease list. */
exports.LeaseListItem = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    tab: lease_1.LeaseTab,
    tenant: zod_1.z.object({ id: primitives_1.Uuid, fullName: zod_1.z.string(), email: zod_1.z.string().nullable() }),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), blockCode: zod_1.z.string().nullable(), propertyName: zod_1.z.string() }),
    monthlyRentRwf: zod_1.z.number().int(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    /** What to do next, in words ("Review and sign", "Waiting for the tenant to sign"). */
    nextAction: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
/** The lease list's page size. */
exports.LEASE_PAGE_SIZE = 25;
exports.LeaseListPage = zod_1.z.object({
    items: zod_1.z.array(exports.LeaseListItem),
    total: zod_1.z.number().int(),
    page: zod_1.z.number().int().min(1),
    pageSize: zod_1.z.number().int(),
    tab: lease_1.LeaseTab.nullable(),
});
/** `GET /ops/leases?tab&q&page`. No tab: every lease. */
exports.LeaseListQuery = zod_1.z.object({
    tab: lease_1.LeaseTab.optional(),
    q: zod_1.z.string().trim().max(120).optional(),
    page: zod_1.z.coerce.number().int().min(1).max(10000).default(1),
});
/** `GET /ops/leases/counts`: how many leases each tab holds. */
exports.LeaseCounts = zod_1.z.object({
    counts: zod_1.z.record(lease_1.LeaseTab, zod_1.z.number().int()),
    total: zod_1.z.number().int(),
});
exports.LeaseTermsView = zod_1.z.object({
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    billingStartsOn: dates_1.CalendarDay,
    monthlyRentRwf: zod_1.z.number().int(),
    depositRwf: zod_1.z.number().int(),
    rentDueDay: zod_1.z.number().int(),
    graceDays: zod_1.z.number().int(),
    noticeDays: zod_1.z.number().int(),
    occupants: zod_1.z.array(zod_1.z.string()),
    otherTerms: zod_1.z.string().nullable(),
});
exports.LeaseSignatureView = zod_1.z.object({
    id: primitives_1.Uuid,
    role: vocab_1.LeaseSignerRole,
    version: zod_1.z.number().int(),
    typedName: zod_1.z.string().nullable(),
    method: vocab_1.LeaseSigningMethod,
    signedAt: IsoMoment,
    voidedAt: IsoMoment.nullable(),
    note: zod_1.z.string().nullable(),
});
exports.LeaseVersionSummary = zod_1.z.object({
    id: primitives_1.Uuid,
    version: zod_1.z.number().int(),
    templateVersion: zod_1.z.number().int(),
    contentHash: zod_1.z.string(),
    createdAt: IsoMoment,
});
exports.LeaseInvitationView = zod_1.z.object({
    status: vocab_1.LeaseInvitationStatus,
    email: zod_1.z.string(),
    sentAt: IsoMoment,
    lastSentAt: IsoMoment,
    sendCount: zod_1.z.number().int(),
    expiresAt: IsoMoment,
    acceptedAt: IsoMoment.nullable(),
});
/** What the lease has asked for and been paid so far. */
exports.LeaseChargesSummary = zod_1.z.object({
    /** Rent charges raised so far. */
    rentChargedRwf: zod_1.z.number().int(),
    rentPaidRwf: zod_1.z.number().int(),
    /** Open rent past its due day plus grace. */
    overdueRwf: zod_1.z.number().int(),
    /** Everything still owed on charges raised (rent and deposit). */
    balanceRwf: zod_1.z.number().int(),
    nextDue: zod_1.z.object({ dueOn: dates_1.CalendarDay, amountRwf: zod_1.z.number().int() }).nullable(),
    depositAgreedRwf: zod_1.z.number().int(),
    depositStatus: vocab_1.LeaseDepositStatus.nullable(),
});
/** `GET /ops/leases/:id`: the lease record. */
exports.LeaseDetail = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    tab: lease_1.LeaseTab,
    /** The moves this lease allows now (`LEASE_TRANSITIONS`). */
    actions: zod_1.z.array(lease_1.LeaseAction),
    nextAction: zod_1.z.string().nullable(),
    property: zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string() }),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), blockCode: zod_1.z.string().nullable(), blockName: zod_1.z.string().nullable() }),
    tenant: exports.TenantView.omit({ leases: true }),
    terms: exports.LeaseTermsView,
    currentVersion: exports.LeaseVersionSummary.nullable(),
    signatures: zod_1.z.array(exports.LeaseSignatureView),
    invitation: exports.LeaseInvitationView.nullable(),
    charges: exports.LeaseChargesSummary,
    /** What still has to be filled in before the landlord can sign, in words. Empty when ready. */
    contractProblems: zod_1.z.array(zod_1.z.string()),
    broker: brokers_1.LeaseBrokerView.nullable(),
    /** The live move out notice (submitted or acknowledged), if any (WP 1.7). */
    notice: move_outs_1.MoveOutNoticeView.nullable(),
    /** The deposit record, once the tenant signed (WP 1.7). */
    deposit: move_outs_1.DepositView.nullable(),
    supersedesLeaseId: primitives_1.Uuid.nullable(),
    signedAt: IsoMoment.nullable(),
    activatedAt: IsoMoment.nullable(),
    endingSince: IsoMoment.nullable(),
    endedOn: dates_1.CalendarDay.nullable(),
    endReason: zod_1.z.string().nullable(),
    cancelledAt: IsoMoment.nullable(),
    cancelReason: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
/** One row of a lease's timeline. */
exports.LeaseEventView = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: vocab_1.LeaseEventKind,
    actorRole: vocab_1.LeaseActorRole,
    /** Who did it, by name; null for the system. */
    actorName: zod_1.z.string().nullable(),
    visibleToTenant: zod_1.z.boolean(),
    payload: zod_1.z.record(zod_1.z.unknown()),
    occurredAt: IsoMoment,
});
exports.LeaseEventList = zod_1.z.object({ events: zod_1.z.array(exports.LeaseEventView) });
/** `GET /ops/leases/:id/contract`: the current version's text, and the versions before it. */
exports.LeaseContractView = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    version: exports.LeaseVersionSummary,
    /**
     * The text as frozen. Template 3 is `LeaseContract`; a version carried over
     * by migration 0077 (template 0) holds the old free-form JSON.
     */
    content: zod_1.z.union([contract_1.LeaseContract, zod_1.z.record(zod_1.z.unknown())]),
    /** Both sides have signed this version. */
    signed: zod_1.z.boolean(),
    versions: zod_1.z.array(exports.LeaseVersionSummary),
});
//# sourceMappingURL=api.js.map