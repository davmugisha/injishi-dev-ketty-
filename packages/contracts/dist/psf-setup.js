"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePsfFormExtraRequest = exports.CreatePsfFormExtraRequest = exports.ChangePsfAssociationRequest = exports.AddPsfAssociationRequest = exports.ChangePsfSectorRequest = exports.AddPsfSectorRequest = exports.PsfExtraAnswers = exports.PsfFormSetupView = exports.PsfFormConfig = exports.PsfFormExtra = exports.UpdatePsfFormFieldSettingRequest = exports.PsfFormFieldSetting = exports.PSF_FORM_FIELDS = exports.PSF_FORM_STEP_LABEL = exports.PsfFormStep = exports.PSF_FORM_STEPS = exports.PsfBandsView = exports.UpdatePsfBandRequest = exports.CreatePsfBandRequest = exports.PsfBand = exports.UpdatePsfLevelRequest = exports.CreatePsfLevelRequest = exports.PsfLevel = exports.PsfMoneyView = exports.PsfOurShare = exports.PSF_NO_FEE_KINDS = exports.PsfFeeKinds = exports.PSF_FEE_KIND_LABEL = exports.PSF_FEE_KINDS = exports.PsfFeeLine = exports.PsfMoneyQuery = exports.PsfSplitRateView = exports.SetPsfSplitRateRequest = void 0;
exports.psfSplitOf = psfSplitOf;
exports.psfFeeLinesAdded = psfFeeLinesAdded;
exports.psfFeeKindsOf = psfFeeKindsOf;
exports.psfFeeTotal = psfFeeTotal;
exports.psfFeeShown = psfFeeShown;
exports.psfBandOverlap = psfBandOverlap;
exports.psfBandName = psfBandName;
exports.psfCodeFrom = psfCodeFrom;
exports.psfFormDefaults = psfFormDefaults;
exports.psfExtraAnswerProblem = psfExtraAnswerProblem;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * PSF's own setup (2026-11-06, the owner): what the National Manager changes without a release.
 * The split between districts and headquarters, the levels and bands, and the public form's fields.
 */
// ---------------------------------------------------------------------------
// The split
// ---------------------------------------------------------------------------
exports.SetPsfSplitRateRequest = zod_1.z.object({
    districtPercent: zod_1.z.number().int().min(0, "Give a share from 0 to 100.").max(100, "Give a share from 0 to 100."),
});
exports.PsfSplitRateView = zod_1.z.object({
    districtPercent: zod_1.z.number().int(),
    headquartersPercent: zod_1.z.number().int(),
    canEdit: zod_1.z.boolean(),
    history: zod_1.z.array(zod_1.z.object({ districtPercent: zod_1.z.number().int(), setByName: zod_1.z.string().nullable(), at: zod_1.z.string() })),
});
/** A fee's split: the district's share rounded down, the rest, rounding included, headquarters. */
function psfSplitOf(amountRwf, districtPercent) {
    const districtRwf = Math.floor((amountRwf * districtPercent) / 100);
    return { districtRwf, headquartersRwf: amountRwf - districtRwf };
}
// ---------------------------------------------------------------------------
// The money page
// ---------------------------------------------------------------------------
const day = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.");
exports.PsfMoneyQuery = zod_1.z.object({ from: day.optional(), to: day.optional() });
/** One amount and who it is for (2026-11-06): the whole fee, the district's share, headquarters' share. */
exports.PsfFeeLine = zod_1.z.object({ totalRwf: zod_1.z.number(), districtRwf: zod_1.z.number(), headquartersRwf: zod_1.z.number() });
exports.PSF_FEE_KINDS = ["application", "renewal", "upgrade"];
exports.PSF_FEE_KIND_LABEL = { application: "New memberships", renewal: "Renewals", upgrade: "Upgrades" };
const NO_FEES = { totalRwf: 0, districtRwf: 0, headquartersRwf: 0 };
/** What came in, by what it was paid for. */
exports.PsfFeeKinds = zod_1.z.object({ application: exports.PsfFeeLine, renewal: exports.PsfFeeLine, upgrade: exports.PsfFeeLine });
exports.PSF_NO_FEE_KINDS = { application: NO_FEES, renewal: NO_FEES, upgrade: NO_FEES };
/** Whose revenue "our revenue" is: headquarters for the National Manager, the district's for everyone else. */
exports.PsfOurShare = zod_1.z.enum(["headquarters", "district"]);
function psfFeeLinesAdded(lines) {
    return lines.reduce((sum, l) => ({ totalRwf: sum.totalRwf + l.totalRwf, districtRwf: sum.districtRwf + l.districtRwf, headquartersRwf: sum.headquartersRwf + l.headquartersRwf }), NO_FEES);
}
/** Rows of a fee ledger, rolled up by what they were paid for. */
function psfFeeKindsOf(rows) {
    const of = (kind) => psfFeeLinesAdded(rows.filter((r) => r.kind === kind));
    return { application: of("application"), renewal: of("renewal"), upgrade: of("upgrade") };
}
function psfFeeTotal(kinds) {
    return psfFeeLinesAdded([kinds.application, kinds.renewal, kinds.upgrade]);
}
/** The amount to show for a line, in the view picked. */
function psfFeeShown(line, view, ours) {
    if (view === "all")
        return line.totalRwf;
    return ours === "headquarters" ? line.headquartersRwf : line.districtRwf;
}
const MoneyLine = zod_1.z.object({
    totalRwf: zod_1.z.number(),
    districtRwf: zod_1.z.number(),
    headquartersRwf: zod_1.z.number(),
    /** The same amounts, by what they were paid for. */
    kinds: exports.PsfFeeKinds,
    /** Payments in the period. */
    payments: zod_1.z.number().int(),
    /** Members in good standing today. */
    members: zod_1.z.number().int(),
});
exports.PsfMoneyView = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    /** The level this officer reads at: a National Manager sees it all. */
    level: zod_1.z.enum(["country", "province", "district"]),
    districtPercent: zod_1.z.number().int(),
    ourShare: exports.PsfOurShare,
    totals: MoneyLine,
    byRegion: zod_1.z.array(MoneyLine.extend({ provinceId: zod_1.z.number().int(), provinceName: zod_1.z.string() })),
    byDistrict: zod_1.z.array(MoneyLine.extend({ districtId: zod_1.z.number().int(), districtName: zod_1.z.string(), provinceId: zod_1.z.number().int(), provinceName: zod_1.z.string() })),
});
// ---------------------------------------------------------------------------
// Levels and bands
// ---------------------------------------------------------------------------
exports.PsfLevel = zod_1.z.object({
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    blurb: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
});
exports.CreatePsfLevelRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Give the level a name.").max(60),
    blurb: zod_1.z.string().trim().max(200).nullable().optional(),
});
exports.UpdatePsfLevelRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Give the level a name.").max(60).optional(),
    blurb: zod_1.z.string().trim().max(200).nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    active: zod_1.z.boolean().optional(),
});
exports.PsfBand = zod_1.z.object({
    code: zod_1.z.string(),
    level: zod_1.z.string(),
    name: zod_1.z.string(),
    /** The least a member pays in this band. */
    minRwf: primitives_1.RwfAmount.nullable(),
    /** The most; null is "and up". */
    maxRwf: primitives_1.RwfAmount.nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
    /** What the membership card's ribbon says, like Bronze. */
    cardBadge: zod_1.z.string().nullable().default(null),
    /** Members on it today: they keep it until they renew or upgrade. */
    members: zod_1.z.number().int(),
});
const bandRange = (v, ctx) => {
    if (v.minRwf !== undefined && v.minRwf <= 0)
        ctx.addIssue({ code: "custom", path: ["minRwf"], message: "A band starts above zero." });
    if (v.minRwf !== undefined && v.maxRwf !== undefined && v.maxRwf !== null && v.maxRwf <= v.minRwf) {
        ctx.addIssue({ code: "custom", path: ["maxRwf"], message: "The most must be above the least." });
    }
};
exports.CreatePsfBandRequest = zod_1.z
    .object({
    level: zod_1.z.string().trim().min(1, "Pick a level."),
    /** Empty is the usual name: "Indatwa, 10,000 to 19,999". */
    name: zod_1.z.string().trim().max(80).optional(),
    cardBadge: zod_1.z.string().trim().max(20).nullable().optional(),
    minRwf: primitives_1.RwfAmount,
    maxRwf: primitives_1.RwfAmount.nullable(),
})
    .superRefine(bandRange);
exports.UpdatePsfBandRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().max(80).optional(),
    cardBadge: zod_1.z.string().trim().max(20).nullable().optional(),
    minRwf: primitives_1.RwfAmount.optional(),
    maxRwf: primitives_1.RwfAmount.nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    active: zod_1.z.boolean().optional(),
})
    .superRefine(bandRange);
exports.PsfBandsView = zod_1.z.object({
    levels: zod_1.z.array(exports.PsfLevel),
    bands: zod_1.z.array(exports.PsfBand),
    canEdit: zod_1.z.boolean(),
    /** Said once after a save, like the district prices a new range cleared. */
    note: zod_1.z.string().nullable().default(null),
});
/** The band a new range collides with, if any. Bands PSF prices by quote carry no range and never collide. */
function psfBandOverlap(bands, range) {
    const high = range.maxRwf ?? Number.POSITIVE_INFINITY;
    return (bands.find((b) => {
        if (!b.active || b.code === range.code || b.minRwf === null)
            return false;
        return range.minRwf <= (b.maxRwf ?? Number.POSITIVE_INFINITY) && b.minRwf <= high;
    }) ?? null);
}
/** The usual name of a band. */
function psfBandName(levelName, minRwf, maxRwf) {
    const n = (v) => v.toLocaleString("en-US");
    return maxRwf === null ? `${levelName}, ${n(minRwf)} and up` : `${levelName}, ${n(minRwf)} to ${n(maxRwf)}`;
}
/** A short code from a name: `Silver circle` is `silver_circle`. */
function psfCodeFrom(name) {
    const code = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
    return /^[a-z]/.test(code) ? code : `x_${code}`;
}
// ---------------------------------------------------------------------------
// The public form
// ---------------------------------------------------------------------------
exports.PSF_FORM_STEPS = ["business", "place", "you", "membership"];
exports.PsfFormStep = zod_1.z.enum(exports.PSF_FORM_STEPS);
exports.PSF_FORM_STEP_LABEL = {
    business: "Your business",
    place: "Where it trades",
    you: "You",
    membership: "Membership",
};
/**
 * Every built-in field of the public form. `locked` fields keep showing and stay required, because the
 * system runs on them: the certificate, the District Manager a business goes to, the price, the texts,
 * the records PSF's reports count. PSF can still change their wording and order.
 */
exports.PSF_FORM_FIELDS = [
    { key: "registrationKind", step: "business", label: "How is it registered?", help: "A TIN is not required to join PSF.", required: true, locked: true },
    { key: "tin", step: "business", label: "TIN", help: null, required: true, locked: true },
    { key: "registrationNumber", step: "business", label: "Registration number", help: "As printed on the certificate.", required: true, locked: true },
    { key: "companyType", step: "business", label: "Kind of company", help: null, required: true, locked: true },
    { key: "ownership", step: "business", label: "Ownership", help: null, required: true, locked: true },
    { key: "legalName", step: "business", label: "Business name", help: "As your customers and your certificate know it. Every branch goes by this name too.", required: true, locked: true },
    { key: "website", step: "business", label: "Website", help: null, required: false, locked: false },
    { key: "clusterCode", step: "business", label: "Your sector", help: "PSF groups its members by sector. Pick yours, then the association you belong to.", required: true, locked: true },
    { key: "subsectorId", step: "business", label: "Kind of business", help: null, required: true, locked: true },
    { key: "associationCode", step: "business", label: "Association", help: null, required: true, locked: true },
    { key: "businessActivity", step: "business", label: "What does the business do?", help: null, required: true, locked: false },
    { key: "ownerGroups", step: "business", label: "Who owns it", help: null, required: false, locked: false },
    { key: "province", step: "place", label: "Province", help: null, required: true, locked: true },
    { key: "district", step: "place", label: "District", help: null, required: true, locked: true },
    { key: "sector", step: "place", label: "Sector", help: null, required: true, locked: true },
    { key: "cell", step: "place", label: "Cell", help: null, required: true, locked: false },
    { key: "village", step: "place", label: "Village", help: null, required: true, locked: false },
    { key: "street", step: "place", label: "Street address", help: null, required: false, locked: false },
    { key: "tradeDirection", step: "place", label: "Do you export or import?", help: null, required: true, locked: true },
    { key: "nationalId", step: "you", label: "National ID number", help: "16 digits, as printed on your ID.", required: true, locked: true },
    { key: "role", step: "you", label: "Your role in the business", help: null, required: true, locked: true },
    { key: "gender", step: "you", label: "Gender", help: null, required: true, locked: true },
    { key: "photo", step: "you", label: "Passport photo", help: "Printed on your membership card and certificate. Anyone who checks your card sees it. JPEG or PNG, up to 2 MB.", required: true, locked: false },
    { key: "phone", step: "you", label: "Phone", help: null, required: true, locked: true },
    { key: "email", step: "you", label: "Email", help: null, required: false, locked: false },
    { key: "logo", step: "membership", label: "Logo", help: "Printed on your membership certificate. PNG, JPEG or WebP, up to 2 MB.", required: false, locked: false },
];
/** One built-in field as it stands: PSF's settings over the form's own wording. */
exports.PsfFormFieldSetting = zod_1.z.object({
    key: zod_1.z.string(),
    step: exports.PsfFormStep,
    label: zod_1.z.string(),
    help: zod_1.z.string().nullable(),
    required: zod_1.z.boolean(),
    visible: zod_1.z.boolean(),
    locked: zod_1.z.boolean(),
    sortOrder: zod_1.z.number().int(),
});
exports.UpdatePsfFormFieldSettingRequest = zod_1.z.object({
    label: zod_1.z.string().trim().min(1, "Give the field a label.").max(120).optional(),
    help: zod_1.z.string().trim().max(400).nullable().optional(),
    required: zod_1.z.boolean().optional(),
    visible: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
});
/** An extra question PSF added. */
exports.PsfFormExtra = zod_1.z.object({
    id: zod_1.z.string(),
    key: zod_1.z.string(),
    step: exports.PsfFormStep,
    label: zod_1.z.string(),
    help: zod_1.z.string().nullable(),
    fieldType: zod_1.z.enum(["text", "textarea", "number", "boolean", "select"]),
    required: zod_1.z.boolean(),
    options: zod_1.z.array(zod_1.z.string()),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
});
/** `GET /psf/form-config`: what the public form asks. Hidden fields and retired questions are left to the form to skip. */
exports.PsfFormConfig = zod_1.z.object({
    fields: zod_1.z.array(exports.PsfFormFieldSetting),
    extras: zod_1.z.array(exports.PsfFormExtra),
});
exports.PsfFormSetupView = exports.PsfFormConfig.extend({ canEdit: zod_1.z.boolean() });
/** The form's own settings, for before the API answers and for a field PSF never touched. */
function psfFormDefaults() {
    return exports.PSF_FORM_FIELDS.map((f, i) => ({
        key: f.key,
        step: f.step,
        label: f.label,
        help: f.help,
        required: f.required,
        visible: true,
        locked: f.locked,
        sortOrder: (i + 1) * 10,
    }));
}
/** The answers to PSF's extra questions, as the form sends them. */
exports.PsfExtraAnswers = zod_1.z.record(zod_1.z.string().max(40), zod_1.z.union([zod_1.z.string().max(2000), zod_1.z.number(), zod_1.z.boolean()])).default({});
/** The problem with one answer to an extra question, or null. Shared by the form and the API. */
function psfExtraAnswerProblem(field, value) {
    const blank = value === undefined || value === null || value === "" || value === false;
    if (blank)
        return field.required ? `Answer “${field.label}”.` : null;
    if (field.fieldType === "number" && typeof value !== "number")
        return `“${field.label}” must be a number.`;
    if (field.fieldType === "boolean" && typeof value !== "boolean")
        return `Answer “${field.label}”.`;
    if ((field.fieldType === "text" || field.fieldType === "textarea") && typeof value !== "string")
        return `Answer “${field.label}”.`;
    if (field.fieldType === "select" && !field.options.includes(String(value)))
        return `Pick one of the answers to “${field.label}”.`;
    return null;
}
/** Catalogue: a sector and an association, added or changed by the National Manager. */
exports.AddPsfSectorRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Give the sector a name.").max(80),
    description: zod_1.z.string().trim().max(300).nullable().optional(),
});
exports.ChangePsfSectorRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80).optional(),
    description: zod_1.z.string().trim().max(300).nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    active: zod_1.z.boolean().optional(),
});
exports.AddPsfAssociationRequest = zod_1.z.object({
    clusterCode: zod_1.z.string().trim().min(1, "Pick the sector."),
    name: zod_1.z.string().trim().min(2, "Give the association a name.").max(120),
    acronym: zod_1.z.string().trim().max(20).nullable().optional(),
});
exports.ChangePsfAssociationRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(120).optional(),
    acronym: zod_1.z.string().trim().max(20).nullable().optional(),
    active: zod_1.z.boolean().optional(),
});
exports.CreatePsfFormExtraRequest = zod_1.z
    .object({
    step: exports.PsfFormStep,
    label: zod_1.z.string().trim().min(2, "Write the question.").max(120),
    help: zod_1.z.string().trim().max(400).nullable().optional(),
    fieldType: exports.PsfFormExtra.shape.fieldType,
    required: zod_1.z.boolean().default(false),
    options: zod_1.z.array(zod_1.z.string().trim().min(1).max(80)).max(50).default([]),
})
    .superRefine((v, ctx) => {
    if (v.fieldType === "select" && v.options.length < 2)
        ctx.addIssue({ code: "custom", path: ["options"], message: "A pick list needs at least two answers." });
});
exports.UpdatePsfFormExtraRequest = zod_1.z.object({
    step: exports.PsfFormStep.optional(),
    label: zod_1.z.string().trim().min(2).max(120).optional(),
    help: zod_1.z.string().trim().max(400).nullable().optional(),
    required: zod_1.z.boolean().optional(),
    options: zod_1.z.array(zod_1.z.string().trim().min(1).max(80)).max(50).optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    active: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=psf-setup.js.map