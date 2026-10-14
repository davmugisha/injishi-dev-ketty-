import { z } from "zod";
/**
 * Waitlist wire contract (ADR-048) — `POST /api/v1/waitlist/signups`.
 *
 * This is a PUBLIC write on an unlaunched domain, so it carries the same three
 * rules the support intake carries and for the same reasons: every string is
 * capped, every choice is a closed set, and unknown keys are refused. An
 * uncapped field on an anonymous write is a storage bill a stranger can run up.
 *
 * THE SHAPE IS A DISCRIMINATED UNION ON `audience`, not one object with seven
 * optional fields. An owner row is complete or it does not exist (the database
 * says so too, in `waitlist_owner_complete`), and a union is what makes that a
 * type level fact instead of a runtime hope: a handler holding an `owner` input
 * cannot read `businessName` as `string | undefined`.
 *
 * THE PROPERTY TYPES ARE DELIBERATELY NAMED `WaitlistPropertyType`, never
 * `PropertyType`. The listing module will define the product's real taxonomy;
 * naming this one after the surface it serves is what stops a pre launch
 * dropdown from quietly becoming the data model (ADR-048, Consequences).
 */
/** RFC 5321's limit on a forward path; no deliverable address is longer. */
export declare const WAITLIST_EMAIL_MAX = 254;
/** Room for a full name in any script, not for a paragraph posing as one. */
export declare const WAITLIST_NAME_MAX = 120;
/** E.164 is 15 digits; the rest is room for spaces, brackets and a `+`. */
export declare const WAITLIST_PHONE_MAX = 32;
/** A trading name, not a description of the business. */
export declare const WAITLIST_BUSINESS_NAME_MAX = 160;
export declare const WaitlistAudience: z.ZodEnum<["traveller", "owner"]>;
export type WaitlistAudience = z.infer<typeof WaitlistAudience>;
export declare const WaitlistPropertyType: z.ZodEnum<["hotel", "guest_house", "apartment", "lodge", "villa", "hostel", "homestay", "campsite"]>;
export type WaitlistPropertyType = z.infer<typeof WaitlistPropertyType>;
export declare const WaitlistSizeBand: z.ZodEnum<["1_5", "6_20", "21_50", "50_plus"]>;
export type WaitlistSizeBand = z.infer<typeof WaitlistSizeBand>;
/** The labels the form renders, from ADR-048 copy.md §3. One list, both ends. */
export declare const WAITLIST_PROPERTY_TYPE_LABEL: Readonly<Record<WaitlistPropertyType, string>>;
export declare const WAITLIST_SIZE_BAND_LABEL: Readonly<Record<WaitlistSizeBand, string>>;
export declare const WaitlistSignupInput: z.ZodDiscriminatedUnion<"audience", [z.ZodObject<{
    audience: z.ZodLiteral<"traveller">;
    email: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    marketingOptIn: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strict", z.ZodTypeAny, {
    fullName: string;
    email: string;
    audience: "traveller";
    marketingOptIn: boolean;
    phone?: string | undefined;
}, {
    fullName: string;
    email: string;
    audience: "traveller";
    phone?: string | undefined;
    marketingOptIn?: boolean | undefined;
}>, z.ZodObject<{
    audience: z.ZodLiteral<"owner">;
    email: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    businessName: z.ZodString;
    districtId: z.ZodNumber;
    propertyType: z.ZodEnum<["hotel", "guest_house", "apartment", "lodge", "villa", "hostel", "homestay", "campsite"]>;
    sizeBand: z.ZodEnum<["1_5", "6_20", "21_50", "50_plus"]>;
    marketingOptIn: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strict", z.ZodTypeAny, {
    districtId: number;
    fullName: string;
    email: string;
    businessName: string;
    audience: "owner";
    phone: string;
    marketingOptIn: boolean;
    propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite";
    sizeBand: "1_5" | "6_20" | "21_50" | "50_plus";
}, {
    districtId: number;
    fullName: string;
    email: string;
    businessName: string;
    audience: "owner";
    phone: string;
    propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite";
    sizeBand: "1_5" | "6_20" | "21_50" | "50_plus";
    marketingOptIn?: boolean | undefined;
}>]>;
export type WaitlistSignupInput = z.infer<typeof WaitlistSignupInput>;
/**
 * What a submission returns: the row id, and whether the address was already
 * stored. Nothing the caller sent is echoed back (AC-9).
 */
export declare const WaitlistSignupResult: z.ZodObject<{
    id: z.ZodString;
    alreadyJoined: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    alreadyJoined: boolean;
}, {
    id: string;
    alreadyJoined: boolean;
}>;
export type WaitlistSignupResult = z.infer<typeof WaitlistSignupResult>;
/**
 * Unsubscribing answers the same way for a known token, an unknown one and one
 * already spent (AC-12). There is no failure shape, on purpose: a 404 here
 * would tell a stranger whether an address is on the list.
 */
export declare const WaitlistUnsubscribeResult: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    ok: true;
}, {
    ok: true;
}>;
export type WaitlistUnsubscribeResult = z.infer<typeof WaitlistUnsubscribeResult>;
/** Offset pagination, capped so one call cannot pull the whole list. */
export declare const AdminWaitlistQuery: z.ZodObject<{
    audience: z.ZodOptional<z.ZodEnum<["traveller", "owner"]>>;
    districtId: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    offset: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    offset: number;
    limit: number;
    districtId?: number | undefined;
    audience?: "owner" | "traveller" | undefined;
}, {
    districtId?: number | undefined;
    audience?: "owner" | "traveller" | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
}>;
export type AdminWaitlistQuery = z.infer<typeof AdminWaitlistQuery>;
/** The filter alone. The export streams every matching row, so it takes no page. */
export declare const AdminWaitlistExportQuery: z.ZodObject<{
    audience: z.ZodOptional<z.ZodEnum<["traveller", "owner"]>>;
    districtId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    districtId?: number | undefined;
    audience?: "owner" | "traveller" | undefined;
}, {
    districtId?: number | undefined;
    audience?: "owner" | "traveller" | undefined;
}>;
export type AdminWaitlistExportQuery = z.infer<typeof AdminWaitlistExportQuery>;
export declare const AdminWaitlistRow: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<["traveller", "owner"]>;
    email: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    businessName: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    propertyType: z.ZodNullable<z.ZodEnum<["hotel", "guest_house", "apartment", "lodge", "villa", "hostel", "homestay", "campsite"]>>;
    sizeBand: z.ZodNullable<z.ZodEnum<["1_5", "6_20", "21_50", "50_plus"]>>;
    marketingOptIn: z.ZodBoolean;
    invitedAt: z.ZodNullable<z.ZodString>;
    unsubscribedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    fullName: string;
    email: string;
    id: string;
    districtName: string | null;
    businessName: string | null;
    createdAt: string;
    audience: "owner" | "traveller";
    phone: string | null;
    invitedAt: string | null;
    marketingOptIn: boolean;
    propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
    sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
    unsubscribedAt: string | null;
}, {
    districtId: number | null;
    fullName: string;
    email: string;
    id: string;
    districtName: string | null;
    businessName: string | null;
    createdAt: string;
    audience: "owner" | "traveller";
    phone: string | null;
    invitedAt: string | null;
    marketingOptIn: boolean;
    propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
    sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
    unsubscribedAt: string | null;
}>;
export type AdminWaitlistRow = z.infer<typeof AdminWaitlistRow>;
export declare const AdminWaitlistPage: z.ZodObject<{
    total: z.ZodNumber;
    rows: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<["traveller", "owner"]>;
        email: z.ZodString;
        fullName: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        businessName: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        propertyType: z.ZodNullable<z.ZodEnum<["hotel", "guest_house", "apartment", "lodge", "villa", "hostel", "homestay", "campsite"]>>;
        sizeBand: z.ZodNullable<z.ZodEnum<["1_5", "6_20", "21_50", "50_plus"]>>;
        marketingOptIn: z.ZodBoolean;
        invitedAt: z.ZodNullable<z.ZodString>;
        unsubscribedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        fullName: string;
        email: string;
        id: string;
        districtName: string | null;
        businessName: string | null;
        createdAt: string;
        audience: "owner" | "traveller";
        phone: string | null;
        invitedAt: string | null;
        marketingOptIn: boolean;
        propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
        sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
        unsubscribedAt: string | null;
    }, {
        districtId: number | null;
        fullName: string;
        email: string;
        id: string;
        districtName: string | null;
        businessName: string | null;
        createdAt: string;
        audience: "owner" | "traveller";
        phone: string | null;
        invitedAt: string | null;
        marketingOptIn: boolean;
        propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
        sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
        unsubscribedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    total: number;
    rows: {
        districtId: number | null;
        fullName: string;
        email: string;
        id: string;
        districtName: string | null;
        businessName: string | null;
        createdAt: string;
        audience: "owner" | "traveller";
        phone: string | null;
        invitedAt: string | null;
        marketingOptIn: boolean;
        propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
        sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
        unsubscribedAt: string | null;
    }[];
}, {
    total: number;
    rows: {
        districtId: number | null;
        fullName: string;
        email: string;
        id: string;
        districtName: string | null;
        businessName: string | null;
        createdAt: string;
        audience: "owner" | "traveller";
        phone: string | null;
        invitedAt: string | null;
        marketingOptIn: boolean;
        propertyType: "hotel" | "guest_house" | "apartment" | "lodge" | "villa" | "hostel" | "homestay" | "campsite" | null;
        sizeBand: "1_5" | "6_20" | "21_50" | "50_plus" | null;
        unsubscribedAt: string | null;
    }[];
}>;
export type AdminWaitlistPage = z.infer<typeof AdminWaitlistPage>;
/**
 * Marking somebody invited is idempotent: the value records when they were
 * FIRST invited, so a second click returns the timestamp already there rather
 * than rewriting history or answering 409 (ADR-048, API surface).
 */
export declare const AdminWaitlistInviteResult: z.ZodObject<{
    invitedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    invitedAt: string;
}, {
    invitedAt: string;
}>;
export type AdminWaitlistInviteResult = z.infer<typeof AdminWaitlistInviteResult>;
//# sourceMappingURL=waitlist.d.ts.map