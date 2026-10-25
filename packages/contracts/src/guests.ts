import { z } from "zod";

import { isKnownCountry } from "./countries";
import { normalizeRwPhone } from "./phone";
import { OversightRole, OversightScopeLevel, Uuid } from "./primitives";
import { CalendarDay, daysBetween, guestStayProblem, isIsoDate } from "./rentals/dates";
import { PersonName, defaultIdKind, idNumberProblem, normaliseIdNumber } from "./rentals/identity";
import { IdKind } from "./rentals/vocab";

// ===========================================================================
// Guests and local leaders (P5)
// ===========================================================================
//
// A guest staying overnight in a rented home is registered on Injishi by the
// tenant (for their lease) or by the landlord (their own guests at a property).
// The landlord never approves or sees a tenant's guests. Every registration is
// delivered, at filing, along a chain read from the home's village:
//
//   1 the village leader (Umudugudu)        the village
//   2 the sector DASSO officer              the sector
//   3 the cell executive secretary          the cell
//   4 the district officer                  the district, for a Rwandan guest
//     or the district immigration officer   the district, for a guest from abroad
//
// A step whose post nobody holds waits, and is handed over when a leader is
// appointed for that area or the home's village is set. Each leader reads only
// their own area and role (immigration: only guests from abroad); anything
// else answers 404. Records are kept 12 months after departure.

/** Rwanda's ISO code: the nationality a guest has unless the form says otherwise. */
export const RWANDA_CODE = "RW";

/** How long a guest record is kept after the guest leaves, then purged (counts are kept). */
export const GUEST_RETENTION_MONTHS = 12;

/** How far ahead the leader's Arriving tab looks. */
export const LEADER_ARRIVING_DAYS = 7;

// --- The leader roles -----------------------------------------------------------

export const LEADER_ROLES = ["village_leader", "dasso", "cell_executive", "district_officer", "district_immigration"] as const;
export const LeaderRole = z.enum(LEADER_ROLES);
export type LeaderRole = z.infer<typeof LeaderRole>;

/** Is this oversight role one of the local leaders? */
export function isLeaderRole(role: OversightRole | string): role is LeaderRole {
  return (LEADER_ROLES as readonly string[]).includes(role);
}

/** The roles that review businesses (field verification and approval). */
export const REVIEWER_ROLES = ["business_field_verifier", "business_approver"] as const;

/** What each leader is called, in full. */
export const LEADER_ROLE_LABEL: Readonly<Record<LeaderRole, string>> = {
  village_leader: "Village leader (Umudugudu)",
  dasso: "Sector DASSO",
  cell_executive: "Cell executive secretary",
  district_officer: "District officer",
  district_immigration: "District immigration officer",
};

/** The short words a chip or a column uses. */
export const LEADER_ROLE_SHORT: Readonly<Record<LeaderRole, string>> = {
  village_leader: "Village leader",
  dasso: "DASSO",
  cell_executive: "Cell executive",
  district_officer: "District officer",
  district_immigration: "Immigration",
};

/** Where each leader sits in a registration's chain, from 1. The two district roles share step 4. */
export const LEADER_ROLE_STEP: Readonly<Record<LeaderRole, number>> = {
  village_leader: 1,
  dasso: 2,
  cell_executive: 3,
  district_officer: 4,
  district_immigration: 4,
};

/** The level of the map each leader covers: the one scope level their appointment may name. */
export const LEADER_ROLE_SCOPE: Readonly<Record<LeaderRole, "village" | "cell" | "sector" | "district">> = {
  village_leader: "village",
  dasso: "sector",
  cell_executive: "cell",
  district_officer: "district",
  district_immigration: "district",
};

/** The government body a leader is appointed under unless the admin picks another. */
export const LEADER_ROLE_BODY: Readonly<Record<LeaderRole, string>> = {
  village_leader: "MINALOC",
  dasso: "MINALOC",
  cell_executive: "MINALOC",
  district_officer: "MINALOC",
  district_immigration: "DGIE",
};

/**
 * The scope levels each oversight role may be appointed at. A leader covers one
 * level; a business reviewer or tax officer the country, a province or a
 * district; a PSF membership officer the country only.
 */
export const OVERSIGHT_ROLE_SCOPES: Readonly<Record<OversightRole, readonly OversightScopeLevel[]>> = {
  village_leader: ["village"],
  dasso: ["sector"],
  cell_executive: ["cell"],
  district_officer: ["district"],
  district_immigration: ["district"],
  business_field_verifier: ["country", "province", "district"],
  business_approver: ["country", "province", "district"],
  tax_compliance_officer: ["country", "province", "district"],
  psf_membership_officer: ["country"],
};

/**
 * The chain a registration goes along, in order: village leader, DASSO, cell
 * executive, then the district officer for a Rwandan guest or the district
 * immigration officer instead for a guest from abroad.
 */
export function guestChainFor(fromAbroad: boolean): LeaderRole[] {
  return ["village_leader", "dasso", "cell_executive", fromAbroad ? "district_immigration" : "district_officer"];
}

/** A guest is "from abroad" when their nationality is not Rwandan. */
export function isFromAbroad(nationality: string): boolean {
  return nationality.toUpperCase() !== RWANDA_CODE;
}

// --- Guest vocabulary -------------------------------------------------------------

export const GuestHostKind = z.enum(["tenant", "landlord"]);
export type GuestHostKind = z.infer<typeof GuestHostKind>;

export const GuestRegistrationStatus = z.enum(["submitted", "cancelled"]);
export type GuestRegistrationStatus = z.infer<typeof GuestRegistrationStatus>;

/** Where a stay is on a given day. */
export const GuestStay = z.enum(["arriving", "staying", "left"]);
export type GuestStay = z.infer<typeof GuestStay>;

/** Where one step of the chain stands: nobody holds the post yet, delivered, or opened. */
export const GuestRouteState = z.enum(["waiting", "delivered", "seen"]);
export type GuestRouteState = z.infer<typeof GuestRouteState>;

/** Where a stay is on `today`: still to come, under way, or over. */
export function guestStayOn(today: string, arrivalOn: string, departureOn: string): GuestStay {
  if (today < arrivalOn) return "arriving";
  if (today > departureOn) return "left";
  return "staying";
}

/** Nights a stay covers: arriving and leaving the same day is 0. */
export function guestNights(arrivalOn: string, departureOn: string): number {
  return Math.max(0, daysBetween(arrivalOn, departureOn));
}

/**
 * Who a guest is to the host: the `guest_relationships` reference table's rows,
 * in the order a form offers them. `other` asks for a few words.
 */
export const GUEST_RELATIONSHIPS: ReadonlyArray<{ code: string; label: string; needsDetail: boolean }> = [
  { code: "father", label: "Father", needsDetail: false },
  { code: "mother", label: "Mother", needsDetail: false },
  { code: "sibling", label: "Brother or sister", needsDetail: false },
  { code: "spouse", label: "Husband or wife", needsDetail: false },
  { code: "partner", label: "Partner", needsDetail: false },
  { code: "child", label: "Son or daughter", needsDetail: false },
  { code: "grandparent", label: "Grandparent", needsDetail: false },
  { code: "grandchild", label: "Grandchild", needsDetail: false },
  { code: "uncle", label: "Uncle", needsDetail: false },
  { code: "aunt", label: "Aunt", needsDetail: false },
  { code: "cousin", label: "Cousin", needsDetail: false },
  { code: "nephew_niece", label: "Nephew or niece", needsDetail: false },
  { code: "in_law", label: "In-law", needsDetail: false },
  { code: "guardian", label: "Guardian", needsDetail: false },
  { code: "friend", label: "Friend", needsDetail: false },
  { code: "colleague", label: "Colleague", needsDetail: false },
  { code: "other", label: "Other", needsDetail: true },
];

/** The relationship that asks for its own words. */
export const OTHER_RELATIONSHIP = "other";

// --- Field rules ------------------------------------------------------------------

/**
 * A guest's phone in E.164: a Rwandan mobile however it is spaced
 * (`0788 123 456`), or a number from another country with its + code. The
 * same rule as the kit's `PhoneInput` with `allowInternational`.
 */
export function normaliseGuestPhone(raw: string): string | null {
  const text = raw.trim().replace(/[\s\-().]/g, "");
  if (text.startsWith("00")) return normaliseGuestPhone(`+${text.slice(2)}`);
  if (text.startsWith("+") && !text.startsWith("+250")) return /^\+[1-9]\d{7,14}$/.test(text) ? text : null;
  return normalizeRwPhone(text);
}

export const GuestPhone = z
  .string({ required_error: "Enter their phone number.", invalid_type_error: "Enter their phone number." })
  .trim()
  .min(1, "Enter their phone number.")
  .transform((raw, ctx) => {
    const phone = normaliseGuestPhone(raw);
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a Rwandan mobile like 0788 123 456, or a number with its country code.",
      });
      return z.NEVER;
    }
    return phone;
  });

/** An ISO 3166-1 alpha-2 code from the list the country picker offers. */
export const GuestCountryCode = z
  .string({ required_error: "Pick a country.", invalid_type_error: "Pick a country." })
  .trim()
  .toUpperCase()
  .refine((code): boolean => isKnownCountry(code), "Pick a country.");

/**
 * Where the guest is coming from: a village in Rwanda, picked down the place
 * cascade, or another country.
 */
export const GuestOrigin = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("village"), villageId: z.number({ invalid_type_error: "Pick the village they come from." }).int().positive("Pick the village they come from.") }),
  z.object({ kind: z.literal("country"), countryCode: GuestCountryCode }),
]);
export type GuestOrigin = z.infer<typeof GuestOrigin>;

/**
 * Why an ID is not acceptable for this nationality, or null. Optional: an empty
 * number is fine. A national ID is Rwandan only; a number given with no kind is
 * read as a national ID for a Rwandan and a passport otherwise.
 */
export function guestIdProblem(input: { nationality: string; idKind?: IdKind | null; idNumber?: string | null }): { path: "idKind" | "idNumber"; message: string } | null {
  const number = input.idNumber?.trim() ?? "";
  if (!number) return null;
  const kind = input.idKind ?? defaultIdKind(input.nationality);
  if (kind === "national_id" && input.nationality !== RWANDA_CODE) {
    return { path: "idKind", message: "A national ID is for Rwandans. Use their passport number." };
  }
  const problem = idNumberProblem(kind, number);
  return problem ? { path: "idNumber", message: problem } : null;
}

/** The ID as stored: both null when none was given, else the kind and the normalised number. */
export function guestIdOf(input: { nationality: string; idKind?: IdKind | null; idNumber?: string | null }): { idKind: IdKind | null; idNumber: string | null } {
  const number = input.idNumber?.trim() ?? "";
  if (!number) return { idKind: null, idNumber: null };
  return { idKind: input.idKind ?? defaultIdKind(input.nationality), idNumber: normaliseIdNumber(number) };
}

// --- Registering a guest (tenant and landlord) -----------------------------------------

const guestFields = {
  fullName: PersonName,
  phone: GuestPhone,
  nationality: GuestCountryCode.default(RWANDA_CODE),
  idKind: IdKind.nullable().optional(),
  idNumber: z.string().trim().max(40, "That number is too long.").nullable().optional(),
  relationship: z.string({ required_error: "Pick who they are to you." }).trim().min(1, "Pick who they are to you."),
  relationshipOther: z.string().trim().max(80, "Keep it under 80 characters.").nullable().optional(),
  origin: GuestOrigin,
  arrivalOn: CalendarDay,
  departureOn: CalendarDay,
};

type GuestFields = {
  nationality: string;
  idKind?: IdKind | null;
  idNumber?: string | null;
  relationship: string;
  relationshipOther?: string | null;
  origin: GuestOrigin;
  arrivalOn: string;
  departureOn: string;
};

/**
 * The checks one form and the API share. The lease window (a tenant's guest
 * stays inside the lease) is the server's to add: it knows the lease.
 */
function checkGuest(v: GuestFields, ctx: z.RefinementCtx): void {
  const id = guestIdProblem(v);
  if (id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [id.path], message: id.message });
  if (v.relationship === OTHER_RELATIONSHIP && (v.relationshipOther?.trim().length ?? 0) < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["relationshipOther"], message: "Say who they are to you, in a few words." });
  }
  if (v.origin.kind === "country" && v.origin.countryCode === RWANDA_CODE) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["origin"], message: "For somewhere in Rwanda, pick the village." });
  }
  if (isIsoDate(v.arrivalOn) && isIsoDate(v.departureOn)) {
    const stay = guestStayProblem({ arrivalOn: v.arrivalOn, departureOn: v.departureOn });
    if (stay) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [stay.path], message: stay.message });
  }
}

/** A tenant registers a guest for their lease: `POST /me/tenancies/:leaseId/guests`, and `PATCH …/:id`. */
export const TenantGuestRequest = z.object(guestFields).superRefine(checkGuest);
export type TenantGuestRequest = z.infer<typeof TenantGuestRequest>;

/** A landlord registers their own guest at one of their buildings: `POST /ops/guests`, and `PATCH …/:id`. */
export const LandlordGuestRequest = z
  .object({ ...guestFields, propertyId: Uuid, unitId: Uuid.nullable().optional() })
  .superRefine(checkGuest);
export type LandlordGuestRequest = z.infer<typeof LandlordGuestRequest>;

// --- What a host reads -------------------------------------------------------------

/** One step of the chain as the host reads it: who it went to and where it stands. Never a flag. */
export const HostChainStep = z.object({
  role: LeaderRole,
  roleLabel: z.string(),
  step: z.number().int(),
  state: GuestRouteState,
});
export type HostChainStep = z.infer<typeof HostChainStep>;

export const HostGuest = z.object({
  id: Uuid,
  hostKind: GuestHostKind,
  fullName: z.string(),
  phone: z.string(),
  nationality: z.string(),
  nationalityName: z.string(),
  fromAbroad: z.boolean(),
  idKind: IdKind.nullable(),
  idNumber: z.string().nullable(),
  relationship: z.string(),
  relationshipLabel: z.string(),
  relationshipOther: z.string().nullable(),
  origin: GuestOrigin,
  /** Where they come from, in words: the village path or the country. */
  originWords: z.string(),
  arrivalOn: z.string(),
  departureOn: z.string(),
  nights: z.number().int(),
  status: GuestRegistrationStatus,
  /** Null once cancelled. */
  stay: GuestStay.nullable(),
  /** Changes and cancelling are open until the arrival day has passed. */
  canChange: z.boolean(),
  propertyId: Uuid,
  propertyName: z.string(),
  unitId: Uuid.nullable(),
  unitLabel: z.string().nullable(),
  chain: z.array(HostChainStep),
  createdAt: z.string(),
});
export type HostGuest = z.infer<typeof HostGuest>;

/** A building a landlord can register a guest at, and whether guests there reach a village leader yet. */
export const GuestBuilding = z.object({
  id: Uuid,
  name: z.string(),
  address: z.string().nullable(),
  /** False while the building has no village on record: its village and cell steps wait. */
  located: z.boolean(),
  units: z.array(z.object({ id: Uuid, label: z.string() })),
});
export type GuestBuilding = z.infer<typeof GuestBuilding>;

export const HostGuestTab = z.enum(["arriving", "staying", "left", "cancelled"]);
export type HostGuestTab = z.infer<typeof HostGuestTab>;

export const HostGuestQuery = z.object({ tab: HostGuestTab.optional() });
export type HostGuestQuery = z.infer<typeof HostGuestQuery>;

export const HostGuestList = z.object({
  guests: z.array(HostGuest),
  counts: z.record(HostGuestTab, z.number().int()),
});
export type HostGuestList = z.infer<typeof HostGuestList>;

/** A tenant's guests, with the days the lease lets a guest stay. */
export const TenantGuestList = HostGuestList.extend({
  window: z.object({ start: z.string(), end: z.string() }),
});
export type TenantGuestList = z.infer<typeof TenantGuestList>;

/** A landlord's own guests, with the buildings the form offers. */
export const LandlordGuestList = HostGuestList.extend({
  buildings: z.array(GuestBuilding),
});
export type LandlordGuestList = z.infer<typeof LandlordGuestList>;

// --- The reference lists the form offers ------------------------------------------------

export const GuestCountry = z.object({ code: z.string(), name: z.string() });
export type GuestCountry = z.infer<typeof GuestCountry>;

export const GuestRelationship = z.object({ code: z.string(), label: z.string(), needsDetail: z.boolean() });
export type GuestRelationship = z.infer<typeof GuestRelationship>;

// --- The leader's console ---------------------------------------------------------------

export const LeaderGuestTab = z.enum(["arriving", "staying", "left", "flagged"]);
export type LeaderGuestTab = z.infer<typeof LeaderGuestTab>;

const AreaId = z.coerce.number().int().positive();

/** The Arriving tab's window: the next 7 days, or everyone arriving after that. */
export const LeaderArrivingWhen = z.enum(["soon", "later"]);
export type LeaderArrivingWhen = z.infer<typeof LeaderArrivingWhen>;

export const LeaderGuestQuery = z.object({
  tab: LeaderGuestTab.default("arriving"),
  when: LeaderArrivingWhen.default("soon"),
  sectorId: AreaId.optional(),
  cellId: AreaId.optional(),
  villageId: AreaId.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type LeaderGuestQuery = z.infer<typeof LeaderGuestQuery>;

export const FlagGuestRequest = z.object({
  note: z
    .string({ required_error: "Say what needs a closer look." })
    .trim()
    .min(3, "Say what needs a closer look.")
    .max(500, "Keep the note under 500 characters."),
});
export type FlagGuestRequest = z.infer<typeof FlagGuestRequest>;

/** One step of the chain as a leader reads it: who holds it, who opened it, any flag. */
export const LeaderChainStep = z.object({
  role: LeaderRole,
  roleLabel: z.string(),
  step: z.number().int(),
  state: GuestRouteState,
  deliveredAt: z.string().nullable(),
  seenAt: z.string().nullable(),
  seenBy: z.string().nullable(),
  flag: z.object({ note: z.string(), at: z.string(), by: z.string().nullable() }).nullable(),
});
export type LeaderChainStep = z.infer<typeof LeaderChainStep>;

export const LeaderGuest = z.object({
  id: Uuid,
  fullName: z.string(),
  nationality: z.string(),
  nationalityName: z.string(),
  fromAbroad: z.boolean(),
  idKind: IdKind.nullable(),
  idNumber: z.string().nullable(),
  phone: z.string(),
  relationshipLabel: z.string(),
  originWords: z.string(),
  arrivalOn: z.string(),
  departureOn: z.string(),
  nights: z.number().int(),
  stay: GuestStay,
  host: z.object({ kind: GuestHostKind, name: z.string(), phone: z.string().nullable() }),
  home: z.object({
    propertyName: z.string(),
    unitLabel: z.string().nullable(),
    /** Street, then village up to district, each place once. */
    address: z.string(),
    /** The village and cell by name, for a list that covers several. */
    villageName: z.string().nullable(),
    cellName: z.string().nullable(),
    villageId: z.number().int().nullable(),
    cellId: z.number().int().nullable(),
    sectorId: z.number().int().nullable(),
    districtId: z.number().int().nullable(),
  }),
  chain: z.array(LeaderChainStep),
  /** Opened by this leader (any of their posts covering it). */
  seenByMe: z.boolean(),
  flagged: z.boolean(),
  /** The host changed it after it was filed. */
  changedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type LeaderGuest = z.infer<typeof LeaderGuest>;

/** One post a leader holds, in words. */
export const LeaderScope = z.object({
  assignmentId: Uuid,
  role: LeaderRole,
  roleLabel: z.string(),
  level: z.enum(["village", "cell", "sector", "district"]),
  area: z.string(),
});
export type LeaderScope = z.infer<typeof LeaderScope>;

/** The places a wider post can narrow to: only those inside it. */
export const LeaderFilters = z.object({
  sectors: z.array(z.object({ id: z.number().int(), name: z.string() })),
  cells: z.array(z.object({ id: z.number().int(), name: z.string(), sectorId: z.number().int() })),
  villages: z.array(z.object({ id: z.number().int(), name: z.string(), cellId: z.number().int() })),
});
export type LeaderFilters = z.infer<typeof LeaderFilters>;

export const LeaderCounts = z.object({
  /** Arriving in the next 7 days. */
  arriving: z.number().int(),
  /** Arriving after that. */
  later: z.number().int(),
  staying: z.number().int(),
  left: z.number().int(),
  flagged: z.number().int(),
  /** Guests in scope this leader has not opened yet. */
  unseen: z.number().int(),
});
export type LeaderCounts = z.infer<typeof LeaderCounts>;

export const LeaderSummary = z.object({
  leader: z.object({ name: z.string().nullable(), email: z.string() }),
  scopes: z.array(LeaderScope),
  filters: LeaderFilters,
  counts: LeaderCounts,
});
export type LeaderSummary = z.infer<typeof LeaderSummary>;

export const LeaderGuestPage = LeaderSummary.extend({
  tab: LeaderGuestTab,
  when: LeaderArrivingWhen,
  guests: z.array(LeaderGuest),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type LeaderGuestPage = z.infer<typeof LeaderGuestPage>;

// --- The leader's reports ----------------------------------------------------------------

/** The longest period one report covers. */
export const GUEST_REPORT_MAX_DAYS = 731;

export const GuestReportQuery = z
  .object({
    from: CalendarDay,
    to: CalendarDay,
    sectorId: AreaId.optional(),
    cellId: AreaId.optional(),
    villageId: AreaId.optional(),
  })
  .superRefine((v, ctx) => {
    if (!isIsoDate(v.from) || !isIsoDate(v.to)) return;
    if (v.to < v.from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "The end can't be before the start." });
    else if (daysBetween(v.from, v.to) > GUEST_REPORT_MAX_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "A report covers at most two years." });
    }
  });
export type GuestReportQuery = z.infer<typeof GuestReportQuery>;

export const ReportBucket = z.enum(["day", "week", "month"]);
export type ReportBucket = z.infer<typeof ReportBucket>;

export const GuestReport = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  generatedAt: z.string(),
  leader: z.object({ name: z.string().nullable(), email: z.string() }),
  scopes: z.array(LeaderScope),
  /** The narrowing applied inside the leader's area, in words, or null. */
  narrowedTo: z.string().nullable(),
  totals: z.object({
    /** Guests whose arrival falls in the period. */
    registered: z.number().int(),
    /** Guests staying today, whatever the period. */
    stayingNow: z.number().int(),
    fromAbroad: z.number().int(),
    flagged: z.number().int(),
    /** Mean nights per stay, one decimal; null with no guests. */
    averageNights: z.number().nullable(),
  }),
  /** The level the area table breaks down by: one below the widest post. */
  areaLevel: z.enum(["sector", "cell", "village"]),
  byArea: z.array(z.object({ id: z.number().int(), name: z.string(), registered: z.number().int(), fromAbroad: z.number().int(), flagged: z.number().int() })),
  byNationality: z.array(z.object({ code: z.string(), name: z.string(), count: z.number().int() })),
  byRelationship: z.array(z.object({ code: z.string(), label: z.string(), count: z.number().int() })),
  arrivals: z.object({
    bucket: ReportBucket,
    points: z.array(z.object({ start: z.string(), label: z.string(), count: z.number().int() })),
  }),
  /** Homes with the most guests, by address: never a person's name. */
  topHomes: z.array(z.object({ address: z.string(), unitLabel: z.string().nullable(), guests: z.number().int() })),
  /** Records older than the retention period are purged; their counts are folded into the totals. */
  purged: z.object({ before: z.string(), registered: z.number().int(), fromAbroad: z.number().int(), flagged: z.number().int() }).nullable(),
});
export type GuestReport = z.infer<typeof GuestReport>;

// --- Admin: local leaders and officers -------------------------------------------------------

/** How an appointment is grouped on the admin screen. */
export const AppointmentKind = z.enum(["leader", "reviewer", "officer"]);
export type AppointmentKind = z.infer<typeof AppointmentKind>;

export function appointmentKindOf(role: OversightRole): AppointmentKind {
  if (isLeaderRole(role)) return "leader";
  if ((REVIEWER_ROLES as readonly string[]).includes(role)) return "reviewer";
  return "officer";
}

export const OversightAppointment = z.object({
  id: Uuid,
  userId: Uuid,
  name: z.string().nullable(),
  email: z.string(),
  role: OversightRole,
  roleLabel: z.string(),
  kind: AppointmentKind,
  bodyCode: z.string(),
  bodyName: z.string().nullable(),
  title: z.string().nullable(),
  scopeLevel: OversightScopeLevel,
  /** The area in words, village up to district; "Rwanda" for the whole country. */
  area: z.string(),
  provinceId: z.number().int().nullable(),
  districtId: z.number().int().nullable(),
  sectorId: z.number().int().nullable(),
  cellId: z.number().int().nullable(),
  villageId: z.number().int().nullable(),
  grantedAt: z.string(),
  grantedBy: z.string().nullable(),
  /** For a leader: guest registrations delivered to this post, and how many were opened. */
  delivered: z.number().int(),
  seen: z.number().int(),
});
export type OversightAppointment = z.infer<typeof OversightAppointment>;

export const OversightAppointmentQuery = z.object({
  role: OversightRole.optional(),
  kind: AppointmentKind.optional(),
  provinceId: AreaId.optional(),
  districtId: AreaId.optional(),
  sectorId: AreaId.optional(),
  cellId: AreaId.optional(),
  villageId: AreaId.optional(),
  q: z.string().trim().max(120).optional(),
});
export type OversightAppointmentQuery = z.infer<typeof OversightAppointmentQuery>;

/** A place's names from the province down, as far as it is known: a form prefills the place picker with it. */
export const PlaceNames = z.object({
  province: z.string().nullable(),
  district: z.string().nullable(),
  sector: z.string().nullable(),
  cell: z.string().nullable(),
  village: z.string().nullable(),
});
export type PlaceNames = z.infer<typeof PlaceNames>;

/** Guests waiting because nobody holds a post in an area. */
export const WaitingArea = z.object({
  role: LeaderRole,
  roleLabel: z.string(),
  level: z.enum(["village", "cell", "sector", "district"]),
  /** In words; "No village on record" when the home has none yet. */
  area: z.string(),
  located: z.boolean(),
  provinceId: z.number().int().nullable(),
  districtId: z.number().int().nullable(),
  sectorId: z.number().int().nullable(),
  cellId: z.number().int().nullable(),
  villageId: z.number().int().nullable(),
  names: PlaceNames,
  reports: z.number().int(),
  oldestArrival: z.string(),
});
export type WaitingArea = z.infer<typeof WaitingArea>;

export const OversightAppointmentList = z.object({
  appointments: z.array(OversightAppointment),
  counts: z.object({ leader: z.number().int(), reviewer: z.number().int(), officer: z.number().int() }),
  waiting: z.array(WaitingArea),
  waitingReports: z.number().int(),
});
export type OversightAppointmentList = z.infer<typeof OversightAppointmentList>;

const reason = z
  .string({ required_error: "Say why, in a few words." })
  .trim()
  .min(4, "Say why, in a few words.")
  .max(500, "Keep the reason under 500 characters.");

const PlaceId = z.number().int().positive().nullable().optional();

/**
 * Appoint a person to a post by email (`POST /admin/local-leaders`). The person
 * is found by email or created with it and signs in with an emailed code. The
 * area names exactly the level the role covers: a village for a village
 * leader, a sector for a DASSO, a cell for a cell executive secretary, a
 * district for the two district roles; a business reviewer the country, a
 * province or a district.
 */
export const AppointOfficerRequest = z
  .object({
    email: z.string({ required_error: "Enter their email address." }).trim().toLowerCase().email("Enter their email address."),
    name: z.string().trim().min(2, "Enter their full name.").max(120, "That name is too long.").nullable().optional(),
    role: OversightRole,
    governmentBodyCode: z.string({ required_error: "Pick the government body." }).trim().min(1, "Pick the government body."),
    governmentTitle: z
      .string({ required_error: "Give the title their institution uses." })
      .trim()
      .min(2, "Give the title their institution uses.")
      .max(200, "That title is too long."),
    scopeLevel: OversightScopeLevel,
    provinceId: PlaceId,
    districtId: PlaceId,
    sectorId: PlaceId,
    cellId: PlaceId,
    villageId: PlaceId,
    reason,
  })
  .superRefine((v, ctx) => {
    const allowed = OVERSIGHT_ROLE_SCOPES[v.role];
    if (!allowed.includes(v.scopeLevel)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scopeLevel"], message: "Pick an area at the level this role covers." });
      return;
    }
    const need: Record<OversightScopeLevel, [keyof typeof v, string] | null> = {
      country: null,
      province: ["provinceId", "Pick the province."],
      district: ["districtId", "Pick the district."],
      sector: ["sectorId", "Pick the sector."],
      cell: ["cellId", "Pick the cell."],
      village: ["villageId", "Pick the village."],
    };
    const required = need[v.scopeLevel];
    if (required && !v[required[0]]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [required[0]], message: required[1] });
  });
export type AppointOfficerRequest = z.infer<typeof AppointOfficerRequest>;

/** Ending an appointment says why (`DELETE /admin/local-leaders/:id?reason=`). */
export const EndAppointmentQuery = z.object({ reason });
export type EndAppointmentQuery = z.infer<typeof EndAppointmentQuery>;

// --- Admin: coverage ----------------------------------------------------------------------

export const LeaderCoverage = z.object({
  generatedAt: z.string(),
  roles: z.array(
    z.object({
      role: LeaderRole,
      roleLabel: z.string(),
      level: z.enum(["village", "cell", "sector", "district"]),
      /** Every area of this level in Rwanda, and how many have someone in the post. */
      nationwide: z.object({ areas: z.number().int(), covered: z.number().int() }),
      /** Areas with rented homes on Injishi, and how many have someone in the post. */
      withHomes: z.object({ areas: z.number().int(), covered: z.number().int() }),
    }),
  ),
  /** Areas with rented homes and nobody in the post, most waiting guests first. */
  uncovered: z.array(
    z.object({
      role: LeaderRole,
      roleLabel: z.string(),
      level: z.enum(["village", "cell", "sector", "district"]),
      area: z.string(),
      provinceId: z.number().int().nullable(),
      districtId: z.number().int().nullable(),
      sectorId: z.number().int().nullable(),
      cellId: z.number().int().nullable(),
      villageId: z.number().int().nullable(),
      names: PlaceNames,
      homes: z.number().int(),
      waitingReports: z.number().int(),
    }),
  ),
  waiting: z.array(WaitingArea),
  /** Leaders with guests delivered who never opened one. */
  neverOpened: z.array(
    z.object({
      assignmentId: Uuid,
      name: z.string().nullable(),
      email: z.string(),
      role: LeaderRole,
      roleLabel: z.string(),
      area: z.string(),
      delivered: z.number().int(),
      firstDeliveredAt: z.string(),
      grantedAt: z.string(),
    }),
  ),
});
export type LeaderCoverage = z.infer<typeof LeaderCoverage>;
