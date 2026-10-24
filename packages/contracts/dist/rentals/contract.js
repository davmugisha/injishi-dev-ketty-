"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignLeaseRequest = exports.ContractHash = exports.LeaseContract = exports.LeaseClause = exports.LeaseContractTerms = exports.LeasePremises = exports.LeaseTenantParty = exports.LeaseLandlordParty = exports.LEASE_FILING_LAW = exports.E_SIGNATURE_LAW = exports.LEASE_CONTRACT_TEMPLATE_VERSION = void 0;
exports.premisesLine = premisesLine;
exports.buildLeaseContract = buildLeaseContract;
exports.canonicalJson = canonicalJson;
exports.contractHash = contractHash;
exports.expectedSignerName = expectedSignerName;
exports.typedNameProblem = typedNameProblem;
const zod_1 = require("zod");
const money_1 = require("./money");
const dates_1 = require("./dates");
const sha256_1 = require("./sha256");
const identity_1 = require("./identity");
const vocab_1 = require("./vocab");
// ===========================================================================
// The lease contract (template version 3)
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
/** The contract template this module writes. */
exports.LEASE_CONTRACT_TEMPLATE_VERSION = 3;
/** The law electronic signatures in Rwanda stand on. */
exports.E_SIGNATURE_LAW = "Law No. 18/2010 relating to electronic messages, electronic signatures and electronic transactions";
/** The law that asks the landlord to file the lease with the tax administration. */
exports.LEASE_FILING_LAW = "Law No. 048/2023";
/** The landlord as the contract names them. */
exports.LeaseLandlordParty = zod_1.z.object({
    /** The business, or the person, letting the home. */
    legalName: zod_1.z.string(),
    /** Who signs for the landlord. */
    signatoryName: zod_1.z.string(),
    /** The signatory's national ID, or the business's TIN. */
    idNumber: zod_1.z.string(),
    phone: zod_1.z.string(),
    email: zod_1.z.string(),
});
/** The tenant as the contract names them. */
exports.LeaseTenantParty = zod_1.z.object({
    fullName: zod_1.z.string(),
    idKind: vocab_1.IdKind,
    idNumber: zod_1.z.string(),
    /** ISO country code. */
    nationality: zod_1.z.string(),
    phone: zod_1.z.string(),
    email: zod_1.z.string(),
});
/** Where the home is, down to the village. */
exports.LeasePremises = zod_1.z.object({
    property: zod_1.z.string(),
    unit: zod_1.z.string().nullable(),
    block: zod_1.z.string().nullable(),
    street: zod_1.z.string().nullable(),
    village: zod_1.z.string().nullable(),
    cell: zod_1.z.string().nullable(),
    sector: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    province: zod_1.z.string().nullable(),
});
/** The terms the contract states. The lease row holds the same figures. */
exports.LeaseContractTerms = zod_1.z.object({
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    /** Set for a tenancy brought onto Injishi mid way. */
    billingStartsOn: zod_1.z.string().nullable(),
    monthlyRentRwf: zod_1.z.number().int(),
    depositRwf: zod_1.z.number().int(),
    rentDueDay: zod_1.z.number().int(),
    graceDays: zod_1.z.number().int(),
    noticeDays: zod_1.z.number().int(),
    occupants: zod_1.z.array(zod_1.z.string()),
    otherTerms: zod_1.z.string().nullable(),
});
/** One clause, as it was frozen. */
exports.LeaseClause = zod_1.z.object({ heading: zod_1.z.string(), body: zod_1.z.string() });
/** The contract both sides sign. */
exports.LeaseContract = zod_1.z.object({
    version: zod_1.z.literal(exports.LEASE_CONTRACT_TEMPLATE_VERSION),
    title: zod_1.z.string(),
    parties: zod_1.z.object({ landlord: exports.LeaseLandlordParty, tenant: exports.LeaseTenantParty }),
    premises: exports.LeasePremises,
    /** The home in one line, as the clauses name it. */
    premisesLine: zod_1.z.string(),
    terms: exports.LeaseContractTerms,
    clauses: zod_1.z.array(exports.LeaseClause),
    /** When this text was rendered. Not part of the fingerprint. */
    issuedAt: zod_1.z.string(),
});
/** Join the pieces of an address, dropping empty ones and one equal to the piece before it. */
function joinAddress(pieces) {
    const out = [];
    for (const raw of pieces) {
        const piece = raw?.trim();
        if (!piece)
            continue;
        if (out.length > 0 && out[out.length - 1].toLowerCase() === piece.toLowerCase())
            continue;
        out.push(piece);
    }
    return out.join(", ");
}
/** `Unit D1, Block A, Ingoro Apartments, KK 15 Ave, Rebero village, ... Kigali City`. */
function premisesLine(p) {
    // A street line that already names a place ("KK 15 Ave, Niboye") keeps it,
    // and the place is not named twice.
    const streetParts = (p.street ?? "").toLowerCase().split(/,\s*/);
    const place = (name, word) => name && !streetParts.includes(name.trim().toLowerCase()) ? `${name.trim()} ${word}` : null;
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
function listWords(items) {
    if (items.length <= 1)
        return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
function idWords(kind) {
    return kind === "national_id" ? "national ID" : "passport";
}
/** The clauses of the agreement, in plain words. */
function leaseClauses(input, premises) {
    const { landlord, tenant, terms } = input;
    const clauses = [
        {
            heading: "The parties",
            body: `This agreement is between ${landlord.legalName}, represented by ${landlord.signatoryName} ` +
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
            body: terms.occupants.length > 0
                ? `The tenant will live in the home with ${listWords(terms.occupants)}. Anyone else who comes to live there needs the landlord's agreement in writing.`
                : "The tenant will live in the home. Anyone else who comes to live there needs the landlord's agreement in writing.",
        },
        {
            heading: "How long",
            body: `The lease runs from ${(0, dates_1.longDate)(terms.startDate)} to ${(0, dates_1.longDate)(terms.endDate)}.`,
        },
        {
            heading: "Rent",
            body: [
                `The rent is ${(0, vocab_1.formatRwf)(terms.monthlyRentRwf)} per month, due on the ${(0, dates_1.ordinal)(terms.rentDueDay)} of each month.`,
                "Rent is charged by calendar month. The first and last months are charged only for the days the lease covers in them. When the lease starts after the due day, the first month's rent is due on the day it starts; when it ends before the due day, the last month's rent is due on its last day.",
                terms.billingStartsOn && terms.billingStartsOn > terms.startDate
                    ? `Rent is charged on Injishi from ${(0, dates_1.longDate)(terms.billingStartsOn)}. Rent for the days before that was settled between the landlord and the tenant.`
                    : null,
                "The tenant pays through Injishi, which pays the rent on to the landlord's chosen account. Each payment pays the oldest rent still owed and shows on both sides once it lands.",
                terms.graceDays > 0
                    ? `Rent not paid within ${terms.graceDays} ${terms.graceDays === 1 ? "day" : "days"} of its due date is late.`
                    : "Rent not paid by its due date is late.",
            ]
                .filter((s) => s !== null)
                .join(" "),
        },
        {
            heading: "Caution deposit",
            body: terms.depositRwf > 0
                ? `The tenant pays a caution deposit of ${(0, vocab_1.formatRwf)(terms.depositRwf)}, due on the day the lease starts. The landlord holds it and returns it after the tenant hands back the home and its keys, less the cost of any damage beyond normal wear. Any amount kept is listed with a reason.`
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
    clauses.push({
        heading: "Disputes",
        body: "The two sides first try to settle any disagreement amicably. If they cannot, either side may take it to the competent authorities of Rwanda.",
    }, {
        heading: "Filing with the tax administration",
        body: `The landlord files a copy of this lease with the Rwanda Revenue Authority within ${money_1.LEASE_TAX_FILING_DAYS} days of signing, as ${exports.LEASE_FILING_LAW} requires.`,
    }, {
        heading: "Signatures",
        body: `Both sides sign electronically on Injishi, under ${exports.E_SIGNATURE_LAW}. Each side types their full name, may draw their signature, and confirms it is them with a code sent to their email or with their password. Injishi records when and from where each side signed and a fingerprint (SHA-256) of this agreement, and sends both sides the signed copy. The lease takes effect once both have signed and the tenancy starts.`,
    });
    return clauses;
}
/**
 * The agreement for these parties, this home and these terms, as of
 * `issuedAt`. Pure: the same input gives the same text, and so the same
 * fingerprint, on every runtime.
 */
function buildLeaseContract(input, issuedAt) {
    const line = premisesLine(input.premises);
    return {
        version: exports.LEASE_CONTRACT_TEMPLATE_VERSION,
        title: "Residential lease agreement",
        parties: { landlord: input.landlord, tenant: input.tenant },
        premises: input.premises,
        premisesLine: line,
        terms: { ...input.terms, occupants: [...input.terms.occupants] },
        clauses: leaseClauses(input, line),
        issuedAt: typeof issuedAt === "string" ? issuedAt : issuedAt.toISOString(),
    };
}
/**
 * JSON with object keys sorted at every level and `undefined` fields left
 * out, so two equal values always serialise to the same string.
 */
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
    }
    if (typeof value === "number" && !Number.isFinite(value))
        throw new RangeError("canonicalJson: numbers must be finite");
    return JSON.stringify(value ?? null);
}
/**
 * The fingerprint a signature is given against: SHA-256 of the contract's
 * canonical JSON without its issue time. The terms are what is agreed; the
 * moment a version was rendered is not, so the landlord can sign the preview
 * they read and the server freeze the same text.
 */
function contractHash(contract) {
    const { issuedAt: _issuedAt, ...terms } = contract;
    return (0, sha256_1.sha256Hex)(canonicalJson(terms));
}
/** A SHA-256 contract fingerprint: 64 lower case hex characters. */
exports.ContractHash = zod_1.z.string().regex(/^[a-f0-9]{64}$/, "Review the contract again, then sign.");
/** The name a signer must type: the one the contract states for their side. */
function expectedSignerName(contract, role) {
    return role === "landlord" ? contract.parties.landlord.signatoryName : contract.parties.tenant.fullName;
}
/** Why a typed signature does not match the contract, or null. */
function typedNameProblem(typed, contract, role) {
    const expected = expectedSignerName(contract, role);
    if ((0, identity_1.comparableName)(typed).length === 0)
        return "Type your full name.";
    return (0, identity_1.sameName)(typed, expected) ? null : `Type your full name as the contract states it: ${expected}.`;
}
/**
 * Sign a lease as whichever side the route says.
 *
 * An electronic signature under Law No. 18/2010: the signer types their full
 * name as the contract states it, may draw a signature (an uploaded PNG), and
 * proves it is them with the code emailed to them or their password.
 * `documentHash` is the `contractHash` they were shown; the API recomputes it
 * and refuses a signature on a contract that has changed since.
 */
exports.SignLeaseRequest = zod_1.z
    .object({
    typedName: zod_1.z.string().trim().min(2, "Type your full name.").max(120, "That name is too long."),
    signatureObjectKey: zod_1.z.string().min(3).max(300).optional(),
    code: zod_1.z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6 digit code from your email.")
        .optional(),
    password: zod_1.z.string().min(1).max(256).optional(),
    documentHash: exports.ContractHash,
})
    .refine((v) => Boolean(v.code) !== Boolean(v.password), {
    message: "Enter the code from your email.",
    path: ["code"],
});
//# sourceMappingURL=contract.js.map