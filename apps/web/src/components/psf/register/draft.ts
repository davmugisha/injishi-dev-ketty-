import {
  MomoPhone,
  isOtherAssociation,
  PsfPublicBusiness,
  PsfPublicContact,
  type PsfFeesView,
  type EnterpriseRegistrationKind,
  type PsfCompanyType,
  type PsfContactRole,
  type PsfMembershipFamily,
  type PsfOwnerGroup,
  type PsfOwnership,
  type PsfPublicSubmitRequest,
  type PsfTier,
  type PsfTradeDirection,
  type PsfVerifiedApplicant,
} from "@injishi/contracts";

/**
 * The public PSF form's draft (2026-10-19): one object for the four steps,
 * kept in `sessionStorage` so a reload or a back button keeps what was typed,
 * and dropped when the tab closes, because it carries a verified name and
 * birth date that have no business outliving the visit.
 *
 * Every id is a string while it is a draft, because the selects hand back
 * strings; it becomes a number in `toRequest`, once.
 */
/** The select value for "Other" (the kind typed in) and "Not on the list: I will type it". */
export const TYPE_IT = "__type_it__";

export type StepKey = "business" | "place" | "you" | "membership" | "review";
export const STEPS: { key: StepKey; title: string; sub: string }[] = [
  { key: "business", title: "Your business", sub: "Its TIN, name and sector" },
  { key: "place", title: "Where it trades", sub: "Address, branches, trade" },
  { key: "you", title: "You", sub: "Your National ID, checked once" },
  { key: "membership", title: "Membership", sub: "The level you can afford" },
  { key: "review", title: "Check and pay", sub: "One payment, by mobile money" },
];

/**
 * One branch as the form holds it: the selects' values as strings, and their
 * names for the read back. No name: a branch trades under the business's.
 */
export interface PsfBranchDraft {
  /** A stable React key; never sent. */
  key: string;
  provinceId: string;
  districtId: string;
  sectorId: string;
  placeNames: { province: string; district: string; sector: string };
  street: string;
}

export function newBranch(): PsfBranchDraft {
  return {
    key: Math.random().toString(36).slice(2, 10),
    provinceId: "",
    districtId: "",
    sectorId: "",
    placeNames: { province: "", district: "", sector: "" },
    street: "",
  };
}

export interface PsfDraft {
  nid: string;
  applicant: PsfVerifiedApplicant | null;
  role: PsfContactRole;
  gender: "male" | "female" | "";
  phone: string;
  email: string;

  legalName: string;
  registrationKind: EnterpriseRegistrationKind | "";
  tin: string;
  registrationNumber: string;
  clusterCode: string;
  /** A subtype's id, or `TYPE_IT` while the business types its own. */
  subsectorId: string;
  subsectorOther: string;
  associationCode: string;
  /** Typed when PSF's list does not have the association (filed under the cluster's "other"). */
  associationOther: string;
  ownerGroups: PsfOwnerGroup[];
  provinceId: string;
  districtId: string;
  sectorId: string;
  /** Down to the village (umudugudu), 2026-10-23: where PSF's officer actually finds the business. */
  cellId: string;
  villageId: string;
  /** The names the selects showed, kept for the read-back on Check and pay. */
  placeNames: { province: string; district: string; sector: string; cell?: string; village?: string };
  street: string;
  companyType: PsfCompanyType | "";
  ownership: PsfOwnership | "";
  ownershipOther: string;
  businessActivity: string;
  website: string;
  /** The logo's key from `POST /psf/logo` and the file's name, for the read back; never the bytes. */
  logoObjectKey: string;
  logoName: string;
  tradeDirection: PsfTradeDirection;
  tradeGoods: string;
  tradeCountries: string[];
  /** Other places it trades from (2026-10-23), each admitted by its own district's PSF office. */
  branches: PsfBranchDraft[];

  family: PsfMembershipFamily | "";
  tierCode: string;
  amount: string;
  /**
   * A holder of an old PSF card joining the new module (2026-11-02): no fee now, the level on its card,
   * and the card itself, uploaded under the ID check. PSF gives a new number and the certificate.
   */
  cardHolder: boolean;
  cardObjectKey: string;
  cardName: string;

  payer: string;
  agree: boolean;
}

export const EMPTY_DRAFT: PsfDraft = {
  nid: "",
  applicant: null,
  role: "owner",
  gender: "",
  phone: "",
  email: "",
  legalName: "",
  registrationKind: "",
  tin: "",
  registrationNumber: "",
  clusterCode: "",
  subsectorId: "",
  subsectorOther: "",
  associationCode: "",
  associationOther: "",
  ownerGroups: [],
  provinceId: "",
  districtId: "",
  sectorId: "",
  cellId: "",
  villageId: "",
  placeNames: { province: "", district: "", sector: "", cell: "", village: "" },
  street: "",
  companyType: "",
  ownership: "",
  ownershipOther: "",
  businessActivity: "",
  website: "",
  logoObjectKey: "",
  logoName: "",
  tradeDirection: "none",
  tradeGoods: "",
  tradeCountries: [],
  branches: [],
  family: "",
  tierCode: "",
  amount: "",
  cardHolder: false,
  cardObjectKey: "",
  cardName: "",
  payer: "",
  agree: false,
};

const KEY = "injishi.psf.register.v1";

export function loadDraft(): PsfDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const draft = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<PsfDraft>) };
    // A check older than its token is no check at all: ask again rather than fail at submit.
    if (draft.applicant && new Date(draft.applicant.expiresAt).getTime() < Date.now() + 60_000) draft.applicant = null;
    return draft;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: PsfDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* A private window may refuse storage; the form still works in memory. */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept, nothing to clear */
  }
}

export type Errors = Record<string, string>;

/** zod's issues as `path.joined → message`, the first one per field. */
export function issuesToErrors(issues: { path: (string | number)[]; message: string }[], prefix = ""): Errors {
  const out: Errors = {};
  for (const i of issues) {
    const key = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

const blank = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function businessFrom(d: PsfDraft): unknown {
  return {
    legalName: d.legalName,
    registrationKind: d.registrationKind || undefined,
    tin: d.registrationKind === "tin" ? blank(d.tin.replace(/\s/g, "")) : undefined,
    registrationNumber: ["rca", "rgb", "other"].includes(d.registrationKind) ? blank(d.registrationNumber) : undefined,
    subsectorId: d.subsectorId && d.subsectorId !== TYPE_IT ? d.subsectorId : undefined,
    subsectorOther: d.subsectorId === TYPE_IT ? blank(d.subsectorOther) : undefined,
    associationCode: d.associationCode,
    associationOther: isOtherAssociation(d.associationCode) ? blank(d.associationOther) : undefined,
    ownerGroups: d.ownerGroups,
    address: {
      provinceId: Number(d.provinceId) || 0,
      districtId: Number(d.districtId) || 0,
      sectorId: Number(d.sectorId) || 0,
      cellId: Number(d.cellId) || undefined,
      villageId: Number(d.villageId) || undefined,
      street: d.street,
    },
    companyType: d.companyType || undefined,
    ownership: d.ownership || undefined,
    ownershipOther: d.ownership === "other" ? blank(d.ownershipOther) : undefined,
    businessActivity: d.businessActivity,
    website: blank(d.website),
    logoObjectKey: blank(d.logoObjectKey),
    tradeDirection: d.tradeDirection,
    tradeGoods: d.tradeDirection === "none" ? undefined : blank(d.tradeGoods),
    tradeCountries: d.tradeDirection === "none" ? [] : d.tradeCountries,
    branches: d.branches.map((b) => ({
      address: {
        provinceId: Number(b.provinceId) || 0,
        districtId: Number(b.districtId) || 0,
        sectorId: Number(b.sectorId) || 0,
        street: b.street,
      },
    })),
  };
}

export function validateYou(d: PsfDraft): Errors {
  const errors: Errors = {};
  if (!d.applicant) errors.nid = "Check your National ID before you carry on.";
  const contact = PsfPublicContact.safeParse({
    role: d.role,
    gender: d.gender || undefined,
    phoneE164: d.phone,
    email: blank(d.email),
  });
  if (!contact.success) Object.assign(errors, issuesToErrors(contact.error.issues, "contact"));
  return errors;
}

/**
 * The business's fields that the second step, Where it trades, asks for
 * (2026-11-02): its address, its branches and its trade. Everything else under
 * `business.` is the first step's.
 */
export function isPlaceField(path: string): boolean {
  return /^business\.(address|branches|trade)/.test(path);
}

/** Your business: registration, name and sector. */
export function validateBusiness(d: PsfDraft): Errors {
  return Object.fromEntries(Object.entries(validateBusinessAll(d)).filter(([k]) => !isPlaceField(k)));
}

/** Where it trades: address, branches and trade. */
export function validatePlace(d: PsfDraft): Errors {
  return Object.fromEntries(Object.entries(validateBusinessAll(d)).filter(([k]) => isPlaceField(k)));
}

function validateBusinessAll(d: PsfDraft): Errors {
  const errors: Errors = {};
  if (!d.clusterCode) errors["business.clusterCode"] = "Pick the sector your business works in.";
  if (d.clusterCode && !d.subsectorId) errors["business.subsectorId"] = "Pick the kind of business, or type it.";
  const parsed = PsfPublicBusiness.safeParse(businessFrom(d));
  if (!parsed.success) Object.assign(errors, issuesToErrors(parsed.error.issues, "business"));
  if (!d.registrationKind) errors["business.registrationKind"] = "Say how the business is registered.";
  if (!d.companyType) errors["business.companyType"] = "Pick the kind of company.";
  if (!d.ownership) errors["business.ownership"] = "Pick who owns it.";
  if (!d.provinceId) errors["business.address.provinceId"] = "Choose a province.";
  if (!d.districtId) errors["business.address.districtId"] = "Choose a district.";
  if (!d.sectorId) errors["business.address.sectorId"] = "Choose a sector.";
  // Required here, optional in the contract (`cellId`/`villageId` on the
  // address): the form insists, the API still takes an address without them.
  if (d.sectorId && !d.cellId) errors["business.address.cellId"] = "Choose a cell.";
  if (d.cellId && !d.villageId) errors["business.address.villageId"] = "Choose a village.";
  return errors;
}

/**
 * The amount is PSF's price for the band in the business's district
 * (2026-10-20), never the business's own; the form copies it into the draft,
 * and the API refuses a form whose amount no longer matches.
 */
export function validateMembership(d: PsfDraft, tiers: PsfTier[], fees: PsfFeesView | null): Errors {
  const tier = tiers.find((t) => t.code === d.tierCode);
  if (!d.family) return { "membership.family": d.cardHolder ? "Pick the level printed on your card." : "Pick a membership." };
  if (!tier) return { "membership.tierCode": d.cardHolder ? "Pick the band printed on your card." : "Pick the band you can afford." };
  // A card holder pays nothing now: its card, not an amount (2026-11-02).
  if (d.cardHolder) return d.cardObjectKey ? {} : { "membership.cardObjectKey": "Add a photo or scan of your PSF card." };
  if (!fees) return { "membership.declaredFeeRwf": "Loading PSF's price for your district. Try again in a moment." };
  const band = fees.fees.find((f) => f.tierCode === tier.code);
  const price = band?.amountRwf ?? null;
  if (price === null) return { "membership.tierCode": "PSF has not set a price for this band in your district yet. Pick another." };
  // At least the band's price, and below the next band's (`psfFeeCeilings`).
  const amount = Number(d.amount.replace(/[^\d]/g, ""));
  if (!d.amount.trim() || amount < price) {
    return { "membership.declaredFeeRwf": `This band starts at ${rwf(price)} a year. Pay at least that, or pick a lower band.` };
  }
  const ceiling = band?.ceilingRwf ?? null;
  if (ceiling !== null && amount > ceiling) {
    return { "membership.declaredFeeRwf": `This band goes up to ${rwf(ceiling)} a year. For more, pick the next band.` };
  }
  return {};
}

export function validateReview(d: PsfDraft): Errors {
  const errors: Errors = {};
  const momo = MomoPhone.safeParse(d.payer);
  if (!d.cardHolder && !momo.success) errors.payerPhoneE164 = momo.error.issues[0]?.message ?? "Give a mobile money number.";
  if (!d.agree) errors.consent = "Tick the box to agree to share this with PSF.";
  return errors;
}

export function toRequest(d: PsfDraft): PsfPublicSubmitRequest {
  return {
    checkToken: d.applicant?.checkToken ?? "",
    business: businessFrom(d) as PsfPublicSubmitRequest["business"],
    membership: d.cardHolder
      ? { tierCode: d.tierCode, intake: "card_holder", cardObjectKey: d.cardObjectKey }
      : {
          tierCode: d.tierCode,
          declaredFeeRwf: d.amount.trim() === "" ? undefined : Number(d.amount.replace(/[^\d]/g, "")),
          intake: "new",
        },
    contact: {
      role: d.role,
      gender: (d.gender || "female") as "male" | "female",
      phoneE164: d.phone,
      email: blank(d.email),
    },
    ...(d.cardHolder ? {} : { payerPhoneE164: d.payer }),
    consent: true,
  };
}

/** Which step a field the server refused lives on, so the form can go back to it. */
export function stepOfPath(path: string): StepKey {
  if (path.startsWith("membership")) return "membership";
  // The logo is asked for on the last step, after the ID check it uploads under.
  if (path === "business.logoObjectKey") return "review";
  if (isPlaceField(path)) return "place";
  if (path.startsWith("business")) return "business";
  if (path.startsWith("contact") || path.startsWith("checkToken")) return "you";
  return "review";
}

export const rwf = (n: number | null | undefined) => `RWF ${(n ?? 0).toLocaleString("en-US")}`;
