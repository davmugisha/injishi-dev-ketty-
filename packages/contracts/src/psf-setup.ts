import { z } from "zod";

import { RwfAmount } from "./primitives";

/**
 * PSF's own setup (2026-11-06, the owner): what the National Manager changes without a release.
 * The split between districts and headquarters, the levels and bands, and the public form's fields.
 */

// ---------------------------------------------------------------------------
// The split
// ---------------------------------------------------------------------------

export const SetPsfSplitRateRequest = z.object({
    districtPercent: z.number().int().min(0, "Give a share from 0 to 100.").max(100, "Give a share from 0 to 100."),
});
export type SetPsfSplitRateRequest = z.infer<typeof SetPsfSplitRateRequest>;

export const PsfSplitRateView = z.object({
    districtPercent: z.number().int(),
    headquartersPercent: z.number().int(),
    canEdit: z.boolean(),
    history: z.array(z.object({ districtPercent: z.number().int(), setByName: z.string().nullable(), at: z.string() })),
});
export type PsfSplitRateView = z.infer<typeof PsfSplitRateView>;

/** A fee's split: the district's share rounded down, the rest, rounding included, headquarters. */
export function psfSplitOf(amountRwf: number, districtPercent: number): { districtRwf: number; headquartersRwf: number } {
    const districtRwf = Math.floor((amountRwf * districtPercent) / 100);
    return { districtRwf, headquartersRwf: amountRwf - districtRwf };
}

// ---------------------------------------------------------------------------
// The money page
// ---------------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.");
export const PsfMoneyQuery = z.object({ from: day.optional(), to: day.optional() });
export type PsfMoneyQuery = z.infer<typeof PsfMoneyQuery>;

/** One amount and who it is for (2026-11-06): the whole fee, the district's share, headquarters' share. */
export const PsfFeeLine = z.object({ totalRwf: z.number(), districtRwf: z.number(), headquartersRwf: z.number() });
export type PsfFeeLine = z.infer<typeof PsfFeeLine>;

export const PSF_FEE_KINDS = ["application", "renewal", "upgrade"] as const;
export type PsfFeeKind = (typeof PSF_FEE_KINDS)[number];
export const PSF_FEE_KIND_LABEL: Record<PsfFeeKind, string> = { application: "New memberships", renewal: "Renewals", upgrade: "Upgrades" };

const NO_FEES: PsfFeeLine = { totalRwf: 0, districtRwf: 0, headquartersRwf: 0 };

/** What came in, by what it was paid for. */
export const PsfFeeKinds = z.object({ application: PsfFeeLine, renewal: PsfFeeLine, upgrade: PsfFeeLine });
export type PsfFeeKinds = z.infer<typeof PsfFeeKinds>;
export const PSF_NO_FEE_KINDS: PsfFeeKinds = { application: NO_FEES, renewal: NO_FEES, upgrade: NO_FEES };

/** Whose revenue "our revenue" is: headquarters for the National Manager, the district's for everyone else. */
export const PsfOurShare = z.enum(["headquarters", "district"]);
export type PsfOurShare = z.infer<typeof PsfOurShare>;

/** Which amounts a screen shows: the whole fee, or the viewer's own share of it. */
export type PsfFeeView = "all" | "ours";

export function psfFeeLinesAdded(lines: readonly PsfFeeLine[]): PsfFeeLine {
  return lines.reduce<PsfFeeLine>(
    (sum, l) => ({ totalRwf: sum.totalRwf + l.totalRwf, districtRwf: sum.districtRwf + l.districtRwf, headquartersRwf: sum.headquartersRwf + l.headquartersRwf }),
    NO_FEES,
  );
}

/** Rows of a fee ledger, rolled up by what they were paid for. */
export function psfFeeKindsOf(rows: readonly (PsfFeeLine & { kind: PsfFeeKind })[]): PsfFeeKinds {
  const of = (kind: PsfFeeKind): PsfFeeLine => psfFeeLinesAdded(rows.filter((r) => r.kind === kind));
  return { application: of("application"), renewal: of("renewal"), upgrade: of("upgrade") };
}

export function psfFeeTotal(kinds: PsfFeeKinds): PsfFeeLine {
  return psfFeeLinesAdded([kinds.application, kinds.renewal, kinds.upgrade]);
}

/** The amount to show for a line, in the view picked. */
export function psfFeeShown(line: PsfFeeLine, view: PsfFeeView, ours: PsfOurShare): number {
  if (view === "all") return line.totalRwf;
  return ours === "headquarters" ? line.headquartersRwf : line.districtRwf;
}

const MoneyLine = z.object({
    totalRwf: z.number(),
    districtRwf: z.number(),
    headquartersRwf: z.number(),
    /** The same amounts, by what they were paid for. */
    kinds: PsfFeeKinds,
    /** Payments in the period. */
    payments: z.number().int(),
    /** Members in good standing today. */
    members: z.number().int(),
});
export const PsfMoneyView = z.object({
    from: z.string(),
    to: z.string(),
    /** The level this officer reads at: a National Manager sees it all. */
    level: z.enum(["country", "province", "district"]),
    districtPercent: z.number().int(),
    ourShare: PsfOurShare,
    totals: MoneyLine,
    byRegion: z.array(MoneyLine.extend({ provinceId: z.number().int(), provinceName: z.string() })),
    byDistrict: z.array(MoneyLine.extend({ districtId: z.number().int(), districtName: z.string(), provinceId: z.number().int(), provinceName: z.string() })),
});
export type PsfMoneyView = z.infer<typeof PsfMoneyView>;

// ---------------------------------------------------------------------------
// Levels and bands
// ---------------------------------------------------------------------------

export const PsfLevel = z.object({
    code: z.string(),
    name: z.string(),
    blurb: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
});
export type PsfLevel = z.infer<typeof PsfLevel>;

export const CreatePsfLevelRequest = z.object({
    name: z.string().trim().min(2, "Give the level a name.").max(60),
    blurb: z.string().trim().max(200).nullable().optional(),
});
export type CreatePsfLevelRequest = z.infer<typeof CreatePsfLevelRequest>;

export const UpdatePsfLevelRequest = z.object({
    name: z.string().trim().min(2, "Give the level a name.").max(60).optional(),
    blurb: z.string().trim().max(200).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    active: z.boolean().optional(),
});
export type UpdatePsfLevelRequest = z.infer<typeof UpdatePsfLevelRequest>;

export const PsfBand = z.object({
    code: z.string(),
    level: z.string(),
    name: z.string(),
    /** The least a member pays in this band. */
    minRwf: RwfAmount.nullable(),
    /** The most; null is "and up". */
    maxRwf: RwfAmount.nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
    /** What the membership card's ribbon says, like Bronze. */
    cardBadge: z.string().nullable().default(null),
    /** Members on it today: they keep it until they renew or upgrade. */
    members: z.number().int(),
});
export type PsfBand = z.infer<typeof PsfBand>;

const bandRange = (v: { minRwf?: number; maxRwf?: number | null }, ctx: z.RefinementCtx): void => {
    if (v.minRwf !== undefined && v.minRwf <= 0) ctx.addIssue({ code: "custom", path: ["minRwf"], message: "A band starts above zero." });
    if (v.minRwf !== undefined && v.maxRwf !== undefined && v.maxRwf !== null && v.maxRwf <= v.minRwf) {
        ctx.addIssue({ code: "custom", path: ["maxRwf"], message: "The most must be above the least." });
    }
};

export const CreatePsfBandRequest = z
    .object({
        level: z.string().trim().min(1, "Pick a level."),
        /** Empty is the usual name: "Indatwa, 10,000 to 19,999". */
        name: z.string().trim().max(80).optional(),
        cardBadge: z.string().trim().max(20).nullable().optional(),
        minRwf: RwfAmount,
        maxRwf: RwfAmount.nullable(),
    })
    .superRefine(bandRange);
export type CreatePsfBandRequest = z.infer<typeof CreatePsfBandRequest>;

export const UpdatePsfBandRequest = z
    .object({
        name: z.string().trim().max(80).optional(),
        cardBadge: z.string().trim().max(20).nullable().optional(),
        minRwf: RwfAmount.optional(),
        maxRwf: RwfAmount.nullable().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
        active: z.boolean().optional(),
    })
    .superRefine(bandRange);
export type UpdatePsfBandRequest = z.infer<typeof UpdatePsfBandRequest>;

export const PsfBandsView = z.object({
    levels: z.array(PsfLevel),
    bands: z.array(PsfBand),
    canEdit: z.boolean(),
    /** Said once after a save, like the district prices a new range cleared. */
    note: z.string().nullable().default(null),
});
export type PsfBandsView = z.infer<typeof PsfBandsView>;

/** The band a new range collides with, if any. Bands PSF prices by quote carry no range and never collide. */
export function psfBandOverlap<T extends { code: string; minRwf: number | null; maxRwf: number | null; active: boolean }>(
    bands: readonly T[],
    range: { code?: string; minRwf: number; maxRwf: number | null },
): T | null {
    const high = range.maxRwf ?? Number.POSITIVE_INFINITY;
    return (
        bands.find((b) => {
            if (!b.active || b.code === range.code || b.minRwf === null) return false;
            return range.minRwf <= (b.maxRwf ?? Number.POSITIVE_INFINITY) && b.minRwf <= high;
        }) ?? null
    );
}

/** The usual name of a band. */
export function psfBandName(levelName: string, minRwf: number, maxRwf: number | null): string {
    const n = (v: number): string => v.toLocaleString("en-US");
    return maxRwf === null ? `${levelName}, ${n(minRwf)} and up` : `${levelName}, ${n(minRwf)} to ${n(maxRwf)}`;
}

/** A short code from a name: `Silver circle` is `silver_circle`. */
export function psfCodeFrom(name: string): string {
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

export const PSF_FORM_STEPS = ["business", "place", "you", "membership"] as const;
export const PsfFormStep = z.enum(PSF_FORM_STEPS);
export type PsfFormStep = z.infer<typeof PsfFormStep>;
export const PSF_FORM_STEP_LABEL: Readonly<Record<PsfFormStep, string>> = {
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
export const PSF_FORM_FIELDS = [
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
] as const satisfies readonly { key: string; step: PsfFormStep; label: string; help: string | null; required: boolean; locked: boolean }[];
export type PsfFormFieldName = (typeof PSF_FORM_FIELDS)[number]["key"];

/** One built-in field as it stands: PSF's settings over the form's own wording. */
export const PsfFormFieldSetting = z.object({
    key: z.string(),
    step: PsfFormStep,
    label: z.string(),
    help: z.string().nullable(),
    required: z.boolean(),
    visible: z.boolean(),
    locked: z.boolean(),
    sortOrder: z.number().int(),
});
export type PsfFormFieldSetting = z.infer<typeof PsfFormFieldSetting>;

export const UpdatePsfFormFieldSettingRequest = z.object({
    label: z.string().trim().min(1, "Give the field a label.").max(120).optional(),
    help: z.string().trim().max(400).nullable().optional(),
    required: z.boolean().optional(),
    visible: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
});
export type UpdatePsfFormFieldSettingRequest = z.infer<typeof UpdatePsfFormFieldSettingRequest>;

/** An extra question PSF added. */
export const PsfFormExtra = z.object({
    id: z.string(),
    key: z.string(),
    step: PsfFormStep,
    label: z.string(),
    help: z.string().nullable(),
    fieldType: z.enum(["text", "textarea", "number", "boolean", "select"]),
    required: z.boolean(),
    options: z.array(z.string()),
    sortOrder: z.number().int(),
    active: z.boolean(),
});
export type PsfFormExtra = z.infer<typeof PsfFormExtra>;

/** `GET /psf/form-config`: what the public form asks. Hidden fields and retired questions are left to the form to skip. */
export const PsfFormConfig = z.object({
    fields: z.array(PsfFormFieldSetting),
    extras: z.array(PsfFormExtra),
});
export type PsfFormConfig = z.infer<typeof PsfFormConfig>;

export const PsfFormSetupView = PsfFormConfig.extend({ canEdit: z.boolean() });
export type PsfFormSetupView = z.infer<typeof PsfFormSetupView>;

/** The form's own settings, for before the API answers and for a field PSF never touched. */
export function psfFormDefaults(): PsfFormFieldSetting[] {
    return PSF_FORM_FIELDS.map((f, i) => ({
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
export const PsfExtraAnswers = z.record(z.string().max(40), z.union([z.string().max(2000), z.number(), z.boolean()])).default({});
export type PsfExtraAnswers = z.infer<typeof PsfExtraAnswers>;

/** The problem with one answer to an extra question, or null. Shared by the form and the API. */
export function psfExtraAnswerProblem(field: Pick<PsfFormExtra, "label" | "fieldType" | "required" | "options">, value: unknown): string | null {
    const blank = value === undefined || value === null || value === "" || value === false;
    if (blank) return field.required ? `Answer “${field.label}”.` : null;
    if (field.fieldType === "number" && typeof value !== "number") return `“${field.label}” must be a number.`;
    if (field.fieldType === "boolean" && typeof value !== "boolean") return `Answer “${field.label}”.`;
    if ((field.fieldType === "text" || field.fieldType === "textarea") && typeof value !== "string") return `Answer “${field.label}”.`;
    if (field.fieldType === "select" && !field.options.includes(String(value))) return `Pick one of the answers to “${field.label}”.`;
    return null;
}

/** Catalogue: a sector and an association, added or changed by the National Manager. */
export const AddPsfSectorRequest = z.object({
    name: z.string().trim().min(2, "Give the sector a name.").max(80),
    description: z.string().trim().max(300).nullable().optional(),
});
export type AddPsfSectorRequest = z.infer<typeof AddPsfSectorRequest>;
export const ChangePsfSectorRequest = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    active: z.boolean().optional(),
});
export type ChangePsfSectorRequest = z.infer<typeof ChangePsfSectorRequest>;
export const AddPsfAssociationRequest = z.object({
    clusterCode: z.string().trim().min(1, "Pick the sector."),
    name: z.string().trim().min(2, "Give the association a name.").max(120),
    acronym: z.string().trim().max(20).nullable().optional(),
});
export type AddPsfAssociationRequest = z.infer<typeof AddPsfAssociationRequest>;
export const ChangePsfAssociationRequest = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    acronym: z.string().trim().max(20).nullable().optional(),
    active: z.boolean().optional(),
});
export type ChangePsfAssociationRequest = z.infer<typeof ChangePsfAssociationRequest>;

export const CreatePsfFormExtraRequest = z
    .object({
        step: PsfFormStep,
        label: z.string().trim().min(2, "Write the question.").max(120),
        help: z.string().trim().max(400).nullable().optional(),
        fieldType: PsfFormExtra.shape.fieldType,
        required: z.boolean().default(false),
        options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    })
    .superRefine((v, ctx) => {
        if (v.fieldType === "select" && v.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "A pick list needs at least two answers." });
    });
export type CreatePsfFormExtraRequest = z.infer<typeof CreatePsfFormExtraRequest>;
export const UpdatePsfFormExtraRequest = z.object({
    step: PsfFormStep.optional(),
    label: z.string().trim().min(2).max(120).optional(),
    help: z.string().trim().max(400).nullable().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    active: z.boolean().optional(),
});
export type UpdatePsfFormExtraRequest = z.infer<typeof UpdatePsfFormExtraRequest>;
