import { z } from "zod";
import { LEASE_TAX_FILING_DAYS } from "./money";
import { longDate, ordinal } from "./dates";
import { sha256Hex } from "./sha256";
import { comparableName, sameName } from "./identity";
import { IdKind, formatRwf } from "./vocab";

// ===========================================================================
// The lease contract (template version 4)
// ===========================================================================
//
// The residential lease agreement both sides sign: both parties in full, the
// home down to its village, the terms, and one plain clause per term. A new
// version is written each time the terms change before signing, frozen on
// `lease_contract_versions.content`, and signed as it stands: what a person
// signed is what they were shown, never a document regenerated later.
//
// Built here, in the shared package, so the API that freezes it, the PDF that
// prints it and the screen that shows it before signing all hold the same
// text, and so its SHA-256 fingerprint is the same wherever it is computed.
// Money and dates are written out by hand rather than through `Intl`, whose
// tables differ between runtimes: a different comma would be a different
// fingerprint.

/** The contract template this module writes for a new version. */
export const LEASE_CONTRACT_TEMPLATE_VERSION = 4;

/**
 * Every template a frozen contract may carry. Each is kept as text on its version, so one written under
 * an older template still reads, prints and signs as it stands; only new versions use the latest.
 *   3  signers confirm "with a code sent to their email or with their password"
 *   4  signers confirm "with an emailed code, or a tenant's password" (a landlord holds no password)
 */
export const LEASE_CONTRACT_TEMPLATE_VERSIONS = [3, 4] as const;
export type LeaseContractTemplateVersion = (typeof LEASE_CONTRACT_TEMPLATE_VERSIONS)[number];

/** A template version a stored contract may name. */
export function isKnownContractTemplate(version: number): version is LeaseContractTemplateVersion {
  return (LEASE_CONTRACT_TEMPLATE_VERSIONS as readonly number[]).includes(version);
}

/** The law electronic signatures in Rwanda stand on. */
export const E_SIGNATURE_LAW =
  "Law No. 18/2010 relating to electronic messages, electronic signatures and electronic transactions";

/** The law that asks the landlord to file the lease with the tax administration. */
export const LEASE_FILING_LAW = "Law No. 048/2023";

/** The landlord as the contract names them. */
export const LeaseLandlordParty = z.object({
  /** The business, or the person, letting the home. */
  legalName: z.string(),
  /** Who signs for the landlord. */
  signatoryName: z.string(),
  /** The signatory's national ID, or the business's TIN. */
  idNumber: z.string(),
  phone: z.string(),
  email: z.string(),
});
export type LeaseLandlordParty = z.infer<typeof LeaseLandlordParty>;

/** The tenant as the contract names them. */
export const LeaseTenantParty = z.object({
  fullName: z.string(),
  idKind: IdKind,
  idNumber: z.string(),
  /** ISO country code. */
  nationality: z.string(),
  phone: z.string(),
  email: z.string(),
});
export type LeaseTenantParty = z.infer<typeof LeaseTenantParty>;

/** Where the home is, down to the village. */
export const LeasePremises = z.object({
  property: z.string(),
  unit: z.string().nullable(),
  block: z.string().nullable(),
  street: z.string().nullable(),
  village: z.string().nullable(),
  cell: z.string().nullable(),
  sector: z.string().nullable(),
  district: z.string().nullable(),
  province: z.string().nullable(),
});
export type LeasePremises = z.infer<typeof LeasePremises>;

/** The terms the contract states. The lease row holds the same figures. */
export const LeaseContractTerms = z.object({
  startDate: z.string(),
  endDate: z.string(),
  /** Set for a tenancy brought onto Injishi mid way. */
  billingStartsOn: z.string().nullable(),
  monthlyRentRwf: z.number().int(),
  depositRwf: z.number().int(),
  rentDueDay: z.number().int(),
  graceDays: z.number().int(),
  noticeDays: z.number().int(),
  occupants: z.array(z.string()),
  otherTerms: z.string().nullable(),
});
export type LeaseContractTerms = z.infer<typeof LeaseContractTerms>;

/** One clause, as it was frozen. */
export const LeaseClause = z.object({ heading: z.string(), body: z.string() });
export type LeaseClause = z.infer<typeof LeaseClause>;

/** The contract both sides sign. */
export const LeaseContract = z.object({
  version: z.union([z.literal(3), z.literal(4)]),
  title: z.string(),
  parties: z.object({ landlord: LeaseLandlordParty, tenant: LeaseTenantParty }),
  premises: LeasePremises,
  /** The home in one line, as the clauses name it. */
  premisesLine: z.string(),
  terms: LeaseContractTerms,
  clauses: z.array(LeaseClause),
  /** When this text was rendered. Not part of the fingerprint. */
  issuedAt: z.string(),
});
export type LeaseContract = z.infer<typeof LeaseContract>;

export interface LeaseContractInput {
  landlord: LeaseLandlordParty;
  tenant: LeaseTenantParty;
  premises: LeasePremises;
  terms: LeaseContractTerms;
}

/** Join the pieces of an address, dropping empty ones and one equal to the piece before it. */
function joinAddress(pieces: readonly (string | null | undefined)[]): string {
  const out: string[] = [];
  for (const raw of pieces) {
    const piece = raw?.trim();
    if (!piece) continue;
    if (out.length > 0 && out[out.length - 1].toLowerCase() === piece.toLowerCase()) continue;
    out.push(piece);
  }
  return out.join(", ");
}

/** `Unit D1, Block A, Ingoro Apartments, KK 15 Ave, Rebero village, ... Kigali City`. */
export function premisesLine(p: LeasePremises): string {
  // A street line that already names a place ("KK 15 Ave, Niboye") keeps it,
  // and the place is not named twice.
  const streetParts = (p.street ?? "").toLowerCase().split(/,\s*/);
  const place = (name: string | null, word: string): string | null =>
    name && !streetParts.includes(name.trim().toLowerCase()) ? `${name.trim()} ${word}` : null;
  return joinAddress([
    p.unit ? `Unit ${p.unit.trim()}` : null,
    p.block ? `Block ${p.block.trim()}` : null,
    p.property,
    p.street,
    place(p.village, "village"),
    place(p.cell, "cell"),
    place(p.sector, "sector"),
    p.district ? `${p.district.trim()} district` : null,
    p.province,
  ]);
}

/** "A", "A and B", "A, B and C". */
function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function idWords(kind: IdKind): string {
  return kind === "national_id" ? "national ID" : "passport";
}

/** How a signer proves it is them, as each template words it. */
const SIGNER_PROOF: Readonly<Record<LeaseContractTemplateVersion, string>> = {
  3: "a code sent to their email or with their password",
  4: "an emailed code, or a tenant's password",
};

/** The clauses of the agreement, in plain words. */
function leaseClauses(
  input: LeaseContractInput,
  premises: string,
  template: LeaseContractTemplateVersion,
): LeaseClause[] {
  const { landlord, tenant, terms } = input;
  const clauses: LeaseClause[] = [
    {
      heading: "The parties",
      body:
        `This agreement is between ${landlord.legalName}, represented by ${landlord.signatoryName} ` +
        `(ID or TIN ${landlord.idNumber}, phone ${landlord.phone}, email ${landlord.email}), the landlord, ` +
        `and ${tenant.fullName} (${idWords(tenant.idKind)} ${tenant.idNumber}, phone ${tenant.phone}, ` +
        `email ${tenant.email}), the tenant.`,
    },
    {
      heading: "The home",
      body: `The landlord lets ${premises} to the tenant as a private home.`,
    },
    {
      heading: "Who lives there",
      body:
        terms.occupants.length > 0
          ? `The tenant will live in the home with ${listWords(terms.occupants)}. Anyone else who comes to live there needs the landlord's agreement in writing.`
          : "The tenant will live in the home. Anyone else who comes to live there needs the landlord's agreement in writing.",
    },
    {
      heading: "How long",
      body: `The lease runs from ${longDate(terms.startDate)} to ${longDate(terms.endDate)}.`,
    },
    {
      heading: "Rent",
      body: [
        `The rent is ${formatRwf(terms.monthlyRentRwf)} per month, due on the ${ordinal(terms.rentDueDay)} of each month.`,
        "Rent is charged by calendar month. The first and last months are charged only for the days the lease covers in them. When the lease starts after the due day, the first month's rent is due on the day it starts; when it ends before the due day, the last month's rent is due on its last day.",
        terms.billingStartsOn && terms.billingStartsOn > terms.startDate
          ? `Rent is charged on Injishi from ${longDate(terms.billingStartsOn)}. Rent for the days before that was settled between the landlord and the tenant.`
          : null,
        "The tenant pays through Injishi, which pays the rent on to the landlord's chosen account. Each payment pays the oldest rent still owed and shows on both sides once it lands.",
        terms.graceDays > 0
          ? `Rent not paid within ${terms.graceDays} ${terms.graceDays === 1 ? "day" : "days"} of its due date is late.`
          : "Rent not paid by its due date is late.",
      ]
        .filter((s): s is string => s !== null)
        .join(" "),
    },
    {
      heading: "Caution deposit",
      body:
        terms.depositRwf > 0
          ? `The tenant pays a caution deposit of ${formatRwf(terms.depositRwf)}, due on the day the lease starts. The landlord holds it and returns it after the tenant hands back the home and its keys, less the cost of any damage beyond normal wear. Any amount kept is listed with a reason.`
          : "No caution deposit is taken on this lease.",
    },
    {
      heading: "Repairs",
      body: "The tenant reports anything broken through Injishi. The landlord keeps the home safe and in good repair, and pays for repairs needed through normal wear and for the building itself: its roof, walls, wiring and plumbing. The tenant takes reasonable care of the home and pays to repair damage caused by them, their household or their guests.",
    },
    {
      heading: "Using the home",
      body: "The tenant uses the home as a residence, keeps the peace with neighbours, and does not sublet it or change its structure without the landlord agreeing in writing.",
    },
    {
      heading: "Guests",
      body: "The tenant registers overnight guests on Injishi.",
    },
    {
      heading: "Notice",
      body: `Either side gives at least ${terms.noticeDays} days' notice in writing before ending the lease early. The tenant gives notice through Injishi.`,
    },
    {
      heading: "Ending and renewal",
      body: "When the lease ends, the tenant hands the home back clean, with all its keys. To renew, both sides sign a new lease on Injishi before this one ends.",
    },
  ];
  if (terms.otherTerms?.trim()) {
    clauses.push({ heading: "Other terms", body: terms.otherTerms.trim() });
  }
  clauses.push(
    {
      heading: "Disputes",
      body: "The two sides first try to settle any disagreement amicably. If they cannot, either side may take it to the competent authorities of Rwanda.",
    },
    {
      heading: "Filing with the tax administration",
      body: `The landlord files a copy of this lease with the Rwanda Revenue Authority within ${LEASE_TAX_FILING_DAYS} days of signing, as ${LEASE_FILING_LAW} requires.`,
    },
    {
      heading: "Signatures",
      body: `Both sides sign electronically on Injishi, under ${E_SIGNATURE_LAW}. Each side types their full name, may draw their signature, and confirms it is them with ${SIGNER_PROOF[template]}. Injishi records when and from where each side signed and a fingerprint (SHA-256) of this agreement, and sends both sides the signed copy. The lease takes effect once both have signed and the tenancy starts.`,
    },
  );
  return clauses;
}

/**
 * The agreement for these parties, this home and these terms, as of
 * `issuedAt`. Pure: the same input gives the same text, and so the same
 * fingerprint, on every runtime. `template` is the latest unless an older
 * version is being rebuilt (tests pin each one's fingerprint).
 */
export function buildLeaseContract(
  input: LeaseContractInput,
  issuedAt: Date | string,
  template: LeaseContractTemplateVersion = LEASE_CONTRACT_TEMPLATE_VERSION,
): LeaseContract {
  const line = premisesLine(input.premises);
  return {
    version: template,
    title: "Residential lease agreement",
    parties: { landlord: input.landlord, tenant: input.tenant },
    premises: input.premises,
    premisesLine: line,
    terms: { ...input.terms, occupants: [...input.terms.occupants] },
    clauses: leaseClauses(input, line, template),
    issuedAt: typeof issuedAt === "string" ? issuedAt : issuedAt.toISOString(),
  };
}

/**
 * JSON with object keys sorted at every level and `undefined` fields left
 * out, so two equal values always serialise to the same string.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new RangeError("canonicalJson: numbers must be finite");
  return JSON.stringify(value ?? null);
}

/**
 * The fingerprint a signature is given against: SHA-256 of the contract's
 * canonical JSON without its issue time. The terms are what is agreed; the
 * moment a version was rendered is not, so the landlord can sign the preview
 * they read and the server freeze the same text.
 */
export function contractHash(contract: LeaseContract): string {
  const { issuedAt: _issuedAt, ...terms } = contract;
  return sha256Hex(canonicalJson(terms));
}

/** A SHA-256 contract fingerprint: 64 lower case hex characters. */
export const ContractHash = z.string().regex(/^[a-f0-9]{64}$/, "Review the contract again, then sign.");

/** The name a signer must type: the one the contract states for their side. */
export function expectedSignerName(contract: LeaseContract, role: "landlord" | "tenant"): string {
  return role === "landlord" ? contract.parties.landlord.signatoryName : contract.parties.tenant.fullName;
}

/** Why a typed signature does not match the contract, or null. */
export function typedNameProblem(typed: string, contract: LeaseContract, role: "landlord" | "tenant"): string | null {
  const expected = expectedSignerName(contract, role);
  if (comparableName(typed).length === 0) return "Type your full name.";
  return sameName(typed, expected) ? null : `Type your full name as the contract states it: ${expected}.`;
}

/**
 * Sign a lease as whichever side the route says.
 *
 * An electronic signature under Law No. 18/2010: the signer types their full
 * name as the contract states it, may draw a signature (an uploaded PNG), and
 * proves it is them with the code emailed to them, or a tenant with their password.
 * `documentHash` is the `contractHash` they were shown; the API recomputes it
 * and refuses a signature on a contract that has changed since.
 *
 * The landlord's signature sends the invitation to the tenant's email, so the
 * API checks that address for a likely typo once more; `confirmEmail` says it
 * is right as typed. The tenant's side ignores it.
 */
export const SignLeaseRequest = z
  .object({
    typedName: z.string().trim().min(2, "Type your full name.").max(120, "That name is too long."),
    /** The drawn signature, uploaded first by the signer (`POST /uploads`, kind `lease_signature`). */
    signatureObjectKey: z.string().min(3).max(300).optional(),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6 digit code from your email.")
      .optional(),
    password: z.string().min(1).max(256).optional(),
    documentHash: ContractHash,
    confirmEmail: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.code) !== Boolean(v.password), {
    message: "Enter the code from your email.",
    path: ["code"],
  });
export type SignLeaseRequest = z.infer<typeof SignLeaseRequest>;
