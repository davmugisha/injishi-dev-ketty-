import { z } from "zod";
/**
 * Training, live attendance and the digital certificate (ADR-049, F-S15).
 *
 * THE ONE THING THIS DOMAIN CLAIMS. A certificate here says "this named person
 * attended this live session of this module on this date" and nothing more. No
 * assessment happens, so no shape below carries a score, a pass mark, a grade
 * or a completion percentage, and AC-31 forbids the words qualified, passed and
 * certified competent from every surface that renders one. If a future change
 * wants the credential to mean more than attendance, it needs an assessment
 * first and its own decision record.
 *
 * THERE IS NO ONLINE SESSION. Deliberately, and structurally: no schema below
 * has a mode, a joining link, a meeting id or a recording url, and neither do
 * the tables. A session is a time, a venue and a trainer. Adding an online
 * session is a migration and a decision, never a field somebody slips in.
 *
 * PRICE WITHOUT COLLECTION. Every session carries `feeRwf` and every
 * registration copies it, and nothing in this build collects a franc:
 * `paid_at` is never written, and no shape here reports a payment state. The
 * public surface must therefore say in words that nothing is being charged
 * yet, because a price nobody is asked to pay is otherwise read as a price
 * already paid. ADR-049's follow-up owns deciding how it is collected.
 */
/**
 * A session's life (schema `training_session_status`).
 *
 * `draft` is a trainer's proposal and is invisible to the public. `published`
 * is the only state `/training` ever shows. `cancelled` is terminal.
 * `completed` is what closing the roster leaves behind.
 */
export declare const TrainingSessionStatus: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
export type TrainingSessionStatus = z.infer<typeof TrainingSessionStatus>;
/**
 * A registration's life (schema `training_registration_status`).
 *
 * `released` and `withdrawn` are different facts and must stay different
 * words: `withdrawn` is the learner pulling out, `released` is the company
 * cancelling the session under them. Reading one as the other would tell a
 * person they changed their mind when they did not.
 */
export declare const TrainingRegistrationStatus: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
export type TrainingRegistrationStatus = z.infer<typeof TrainingRegistrationStatus>;
/** How a registration came to exist (schema `training_registration_source`). */
export declare const TrainingRegistrationSource: z.ZodEnum<["self", "walk_in"]>;
export type TrainingRegistrationSource = z.infer<typeof TrainingRegistrationSource>;
/**
 * One trainer's decision about one registrant (schema
 * `training_attendance_decision`).
 *
 * Only two values, and no `unknown`: a registrant with no decision has no row,
 * which is not the same as a row saying nothing. Closing the roster is what
 * turns every absence of a row into an `absent` row.
 */
export declare const TrainingAttendanceDecision: z.ZodEnum<["present", "absent"]>;
export type TrainingAttendanceDecision = z.infer<typeof TrainingAttendanceDecision>;
/**
 * A place training happens, as any reader of a session sees it.
 *
 * Carries the district AND the province name, because "Musanze" is only useful
 * to somebody who already knows which province it is in, and the person
 * deciding whether to travel is exactly the person who might not.
 */
export declare const TrainingVenueSummary: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    address: z.ZodString;
    districtId: z.ZodNumber;
    districtName: z.ZodString;
    provinceId: z.ZodNumber;
    provinceName: z.ZodString;
    /** The Injishi office is one row in the venue list, flagged, not special-cased. */
    isOffice: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    districtName: string;
    provinceId: number;
    districtId: number;
    address: string;
    provinceName: string;
    isOffice: boolean;
}, {
    name: string;
    id: string;
    districtName: string;
    provinceId: number;
    districtId: number;
    address: string;
    provinceName: string;
    isOffice: boolean;
}>;
export type TrainingVenueSummary = z.infer<typeof TrainingVenueSummary>;
/**
 * A published session as `/training` shows it.
 *
 * `seatsRemaining` may go NEGATIVE, and that is the honest rendering of an
 * advisory seat count (AC-5): registration past the count succeeds, so a
 * clamped zero would hide an over-subscribed session from the only person who
 * needs to know about it. The page warns before the commit; nothing prevents.
 */
export declare const TrainingPublicSession: z.ZodObject<{
    id: z.ZodString;
    courseId: z.ZodString;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    venue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
        /** The Injishi office is one row in the venue list, flagged, not special-cased. */
        isOffice: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    }, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    }>;
    feeRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
    seatCount: z.ZodNumber;
    registrationCount: z.ZodNumber;
    seatsRemaining: z.ZodNumber;
    /** True once `registrationCount` has reached `seatCount`. The page's warning. */
    isOverSubscribed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    currency: "RWF";
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    };
    courseId: string;
    seatCount: number;
    registrationCount: number;
    seatsRemaining: number;
    isOverSubscribed: boolean;
}, {
    id: string;
    currency: "RWF";
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    };
    courseId: string;
    seatCount: number;
    registrationCount: number;
    seatsRemaining: number;
    isOverSubscribed: boolean;
}>;
export type TrainingPublicSession = z.infer<typeof TrainingPublicSession>;
/** A published course and every published, not cancelled session under it. */
export declare const TrainingPublicCourse: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    version: z.ZodNumber;
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        courseId: z.ZodString;
        startsAt: z.ZodString;
        endsAt: z.ZodString;
        venue: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            address: z.ZodString;
            districtId: z.ZodNumber;
            districtName: z.ZodString;
            provinceId: z.ZodNumber;
            provinceName: z.ZodString;
            /** The Injishi office is one row in the venue list, flagged, not special-cased. */
            isOffice: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        }, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        }>;
        feeRwf: z.ZodNumber;
        currency: z.ZodLiteral<"RWF">;
        seatCount: z.ZodNumber;
        registrationCount: z.ZodNumber;
        seatsRemaining: z.ZodNumber;
        /** True once `registrationCount` has reached `seatCount`. The page's warning. */
        isOverSubscribed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        currency: "RWF";
        feeRwf: number;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
        courseId: string;
        seatCount: number;
        registrationCount: number;
        seatsRemaining: number;
        isOverSubscribed: boolean;
    }, {
        id: string;
        currency: "RWF";
        feeRwf: number;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
        courseId: string;
        seatCount: number;
        registrationCount: number;
        seatsRemaining: number;
        isOverSubscribed: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string;
    title: string;
    version: number;
    summary: string;
    sessions: {
        id: string;
        currency: "RWF";
        feeRwf: number;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
        courseId: string;
        seatCount: number;
        registrationCount: number;
        seatsRemaining: number;
        isOverSubscribed: boolean;
    }[];
}, {
    id: string;
    slug: string;
    title: string;
    version: number;
    summary: string;
    sessions: {
        id: string;
        currency: "RWF";
        feeRwf: number;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
        courseId: string;
        seatCount: number;
        registrationCount: number;
        seatsRemaining: number;
        isOverSubscribed: boolean;
    }[];
}>;
export type TrainingPublicCourse = z.infer<typeof TrainingPublicCourse>;
/** Query params for `GET /api/v1/training/courses`. */
export declare const TrainingCourseListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type TrainingCourseListQuery = z.infer<typeof TrainingCourseListQuery>;
export declare const TrainingCourseListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        summary: z.ZodString;
        version: z.ZodNumber;
        sessions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            courseId: z.ZodString;
            startsAt: z.ZodString;
            endsAt: z.ZodString;
            venue: z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                address: z.ZodString;
                districtId: z.ZodNumber;
                districtName: z.ZodString;
                provinceId: z.ZodNumber;
                provinceName: z.ZodString;
                /** The Injishi office is one row in the venue list, flagged, not special-cased. */
                isOffice: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            }, {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            }>;
            feeRwf: z.ZodNumber;
            currency: z.ZodLiteral<"RWF">;
            seatCount: z.ZodNumber;
            registrationCount: z.ZodNumber;
            seatsRemaining: z.ZodNumber;
            /** True once `registrationCount` has reached `seatCount`. The page's warning. */
            isOverSubscribed: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }, {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
        sessions: {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }[];
    }, {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
        sessions: {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }[];
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
        sessions: {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }[];
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
        sessions: {
            id: string;
            currency: "RWF";
            feeRwf: number;
            startsAt: string;
            endsAt: string;
            venue: {
                name: string;
                id: string;
                districtName: string;
                provinceId: number;
                districtId: number;
                address: string;
                provinceName: string;
                isOffice: boolean;
            };
            courseId: string;
            seatCount: number;
            registrationCount: number;
            seatsRemaining: number;
            isOverSubscribed: boolean;
        }[];
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type TrainingCourseListResponse = z.infer<typeof TrainingCourseListResponse>;
/** What `GET /api/v1/training/sessions/:id` answers. Unpublished is a 404. */
export declare const TrainingSessionDetail: z.ZodObject<{
    id: z.ZodString;
    courseId: z.ZodString;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    venue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
        /** The Injishi office is one row in the venue list, flagged, not special-cased. */
        isOffice: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    }, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    }>;
    feeRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
    seatCount: z.ZodNumber;
    registrationCount: z.ZodNumber;
    seatsRemaining: z.ZodNumber;
    /** True once `registrationCount` has reached `seatCount`. The page's warning. */
    isOverSubscribed: z.ZodBoolean;
} & {
    course: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        summary: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
    }, {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    currency: "RWF";
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    };
    courseId: string;
    seatCount: number;
    registrationCount: number;
    seatsRemaining: number;
    isOverSubscribed: boolean;
    course: {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
    };
}, {
    id: string;
    currency: "RWF";
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        isOffice: boolean;
    };
    courseId: string;
    seatCount: number;
    registrationCount: number;
    seatsRemaining: number;
    isOverSubscribed: boolean;
    course: {
        id: string;
        slug: string;
        title: string;
        version: number;
        summary: string;
    };
}>;
export type TrainingSessionDetail = z.infer<typeof TrainingSessionDetail>;
/**
 * What a person sends to register (`POST /api/v1/training/registrations`).
 *
 * NO `email` FIELD, on purpose. The address is taken from the Better Auth
 * session, because an address typed into a form is an address the sender does
 * not have to own, and this request is what a certificate eventually hangs
 * from. The registration still stores what it resolved, as a record of the day
 * (AC-3); every mail goes to the account's address as it stands at send time
 * (AC-20), never to that snapshot.
 *
 * The business is named exactly one way, and the refinement below is the
 * client-side half of a database CHECK, never a replacement for it.
 */
export declare const CreateTrainingRegistration: z.ZodEffects<z.ZodObject<{
    sessionId: z.ZodString;
    fullName: z.ZodString;
    /** E.164. Normalised by the caller through `@injishi/auth`'s helper. */
    phone: z.ZodString;
    /** An org the caller already holds, from `GET /api/v1/me/workspaces`. */
    orgId: z.ZodOptional<z.ZodString>;
    /** Free text, for somebody whose business is not on the platform. */
    businessName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    phone: string;
    sessionId: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}, {
    fullName: string;
    phone: string;
    sessionId: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}>, {
    fullName: string;
    phone: string;
    sessionId: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}, {
    fullName: string;
    phone: string;
    sessionId: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}>;
export type CreateTrainingRegistration = z.infer<typeof CreateTrainingRegistration>;
/**
 * What registering answers.
 *
 * `alreadyRegistered` is carried rather than inferred from a status code
 * because AC-4 makes the second attempt a SUCCESS that returns the first
 * registration. A caller that cannot tell the two apart either says "you are
 * registered" twice or reports an error for a thing that worked.
 */
export declare const TrainingRegistrationResult: z.ZodObject<{
    registrationId: z.ZodString;
    status: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
    alreadyRegistered: z.ZodBoolean;
    /** Copied from the session at registration. Collected by nothing yet. */
    feeRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
}, "strip", z.ZodTypeAny, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    currency: "RWF";
    feeRwf: number;
    registrationId: string;
    alreadyRegistered: boolean;
}, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    currency: "RWF";
    feeRwf: number;
    registrationId: string;
    alreadyRegistered: boolean;
}>;
export type TrainingRegistrationResult = z.infer<typeof TrainingRegistrationResult>;
/** One of my registrations, as `GET /api/v1/training/me` lists it. */
export declare const TrainingMyRegistration: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
    source: z.ZodEnum<["self", "walk_in"]>;
    registeredAt: z.ZodString;
    feeRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
    session: z.ZodObject<{
        id: z.ZodString;
        startsAt: z.ZodString;
        endsAt: z.ZodString;
        status: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
        venue: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            address: z.ZodString;
            districtId: z.ZodNumber;
            districtName: z.ZodString;
            provinceId: z.ZodNumber;
            provinceName: z.ZodString;
            /** The Injishi office is one row in the venue list, flagged, not special-cased. */
            isOffice: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        }, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
    }, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
    }>;
    course: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        slug: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string;
        title: string;
    }, {
        id: string;
        slug: string;
        title: string;
    }>;
    /** Set only once a trainer ticked them present. */
    certificateId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    id: string;
    currency: "RWF";
    source: "self" | "walk_in";
    feeRwf: number;
    registeredAt: string;
    course: {
        id: string;
        slug: string;
        title: string;
    };
    session: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
    };
    certificateId: string | null;
}, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    id: string;
    currency: "RWF";
    source: "self" | "walk_in";
    feeRwf: number;
    registeredAt: string;
    course: {
        id: string;
        slug: string;
        title: string;
    };
    session: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        startsAt: string;
        endsAt: string;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            isOffice: boolean;
        };
    };
    certificateId: string | null;
}>;
export type TrainingMyRegistration = z.infer<typeof TrainingMyRegistration>;
/**
 * One of my certificates.
 *
 * Every field is read off the certificate row, never joined to a live profile
 * (AC-14). A person who changes their name keeps a certificate naming who
 * attended on the day, which is the only claim it was ever making.
 */
export declare const TrainingMyCertificate: z.ZodObject<{
    id: z.ZodString;
    serial: z.ZodString;
    /** The absolute URL a stranger scans. Also what the QR on the PDF encodes. */
    verifyUrl: z.ZodString;
    courseTitle: z.ZodString;
    courseVersion: z.ZodNumber;
    holderName: z.ZodString;
    sessionDate: z.ZodString;
    venueName: z.ZodString;
    districtName: z.ZodString;
    leadTrainerName: z.ZodString;
    issuedAt: z.ZodString;
    revokedAt: z.ZodNullable<z.ZodString>;
    revocationReason: z.ZodNullable<z.ZodString>;
    /** False when the PDF is still being rendered or failed to store. */
    hasPdf: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    districtName: string;
    serial: string;
    verifyUrl: string;
    courseTitle: string;
    courseVersion: number;
    holderName: string;
    sessionDate: string;
    venueName: string;
    leadTrainerName: string;
    issuedAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    hasPdf: boolean;
}, {
    id: string;
    districtName: string;
    serial: string;
    verifyUrl: string;
    courseTitle: string;
    courseVersion: number;
    holderName: string;
    sessionDate: string;
    venueName: string;
    leadTrainerName: string;
    issuedAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    hasPdf: boolean;
}>;
export type TrainingMyCertificate = z.infer<typeof TrainingMyCertificate>;
/** Query params for `GET /api/v1/training/me`. */
export declare const TrainingMeQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type TrainingMeQuery = z.infer<typeof TrainingMeQuery>;
/** What `GET /api/v1/training/me` answers. Both halves page. */
export declare const TrainingMeResponse: z.ZodObject<{
    registrations: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
            source: z.ZodEnum<["self", "walk_in"]>;
            registeredAt: z.ZodString;
            feeRwf: z.ZodNumber;
            currency: z.ZodLiteral<"RWF">;
            session: z.ZodObject<{
                id: z.ZodString;
                startsAt: z.ZodString;
                endsAt: z.ZodString;
                status: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
                venue: z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    address: z.ZodString;
                    districtId: z.ZodNumber;
                    districtName: z.ZodString;
                    provinceId: z.ZodNumber;
                    provinceName: z.ZodString;
                    /** The Injishi office is one row in the venue list, flagged, not special-cased. */
                    isOffice: z.ZodBoolean;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                }, {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                }>;
            }, "strip", z.ZodTypeAny, {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            }, {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            }>;
            course: z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
                slug: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                id: string;
                slug: string;
                title: string;
            }, {
                id: string;
                slug: string;
                title: string;
            }>;
            /** Set only once a trainer ticked them present. */
            certificateId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }, {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }>, "many">;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total: number;
            page: number;
            pageSize: number;
        }, {
            total: number;
            page: number;
            pageSize: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        items: {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    }, {
        items: {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    }>;
    certificates: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            serial: z.ZodString;
            /** The absolute URL a stranger scans. Also what the QR on the PDF encodes. */
            verifyUrl: z.ZodString;
            courseTitle: z.ZodString;
            courseVersion: z.ZodNumber;
            holderName: z.ZodString;
            sessionDate: z.ZodString;
            venueName: z.ZodString;
            districtName: z.ZodString;
            leadTrainerName: z.ZodString;
            issuedAt: z.ZodString;
            revokedAt: z.ZodNullable<z.ZodString>;
            revocationReason: z.ZodNullable<z.ZodString>;
            /** False when the PDF is still being rendered or failed to store. */
            hasPdf: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }, {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }>, "many">;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total: number;
            page: number;
            pageSize: number;
        }, {
            total: number;
            page: number;
            pageSize: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        items: {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    }, {
        items: {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    certificates: {
        items: {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    };
    registrations: {
        items: {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    };
}, {
    certificates: {
        items: {
            id: string;
            districtName: string;
            serial: string;
            verifyUrl: string;
            courseTitle: string;
            courseVersion: number;
            holderName: string;
            sessionDate: string;
            venueName: string;
            leadTrainerName: string;
            issuedAt: string;
            revokedAt: string | null;
            revocationReason: string | null;
            hasPdf: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    };
    registrations: {
        items: {
            status: "released" | "withdrawn" | "registered" | "attended" | "absent";
            id: string;
            currency: "RWF";
            source: "self" | "walk_in";
            feeRwf: number;
            registeredAt: string;
            course: {
                id: string;
                slug: string;
                title: string;
            };
            session: {
                status: "cancelled" | "draft" | "published" | "completed";
                id: string;
                startsAt: string;
                endsAt: string;
                venue: {
                    name: string;
                    id: string;
                    districtName: string;
                    provinceId: number;
                    districtId: number;
                    address: string;
                    provinceName: string;
                    isOffice: boolean;
                };
            };
            certificateId: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            pageSize: number;
        };
    };
}>;
export type TrainingMeResponse = z.infer<typeof TrainingMeResponse>;
/**
 * What `GET /api/v1/training/certificates/:id/pdf` answers.
 *
 * A URL with an expiry, never the bytes. `expiresInSeconds` is reported so a
 * client can re-ask rather than hand a stale link to a download that starts a
 * minute later; AC-13 caps it at 900.
 */
export declare const TrainingCertificatePdfLink: z.ZodObject<{
    url: z.ZodString;
    expiresInSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    url: string;
    expiresInSeconds: number;
}, {
    url: string;
    expiresInSeconds: number;
}>;
export type TrainingCertificatePdfLink = z.infer<typeof TrainingCertificatePdfLink>;
/** Whether the code names a live certificate, a withdrawn one, or nothing. */
export declare const TrainingVerificationStatus: z.ZodEnum<["valid", "revoked", "unknown"]>;
export type TrainingVerificationStatus = z.infer<typeof TrainingVerificationStatus>;
/**
 * What `GET /api/v1/verify/:token` answers, to anybody, with no session.
 *
 * ONE SHAPE FOR ALL THREE ANSWERS (AC-16). A valid token, a revoked token and
 * a token that never existed all return 200 and this object. That is not
 * tidiness: a 404 for an unknown token turns this endpoint into an oracle
 * confirming which tokens are real, and somebody working through a list of
 * guesses only needs to know which ones landed. So the shape never varies and
 * only `status` says anything.
 *
 * The descriptive fields are null when there is nothing to describe, and a
 * client must render its answer from `status` alone rather than from which
 * fields came back empty.
 *
 * NO BUSINESS NAME, ever (AC-12). The certificate is about a person attending;
 * naming their employer to every stranger who scans a piece of paper is a
 * disclosure the credential does not need to make.
 */
export declare const TrainingVerification: z.ZodObject<{
    status: z.ZodEnum<["valid", "revoked", "unknown"]>;
    serial: z.ZodNullable<z.ZodString>;
    holderName: z.ZodNullable<z.ZodString>;
    courseTitle: z.ZodNullable<z.ZodString>;
    courseVersion: z.ZodNullable<z.ZodNumber>;
    sessionDate: z.ZodNullable<z.ZodString>;
    venueName: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    leadTrainerName: z.ZodNullable<z.ZodString>;
    issuedAt: z.ZodNullable<z.ZodString>;
    revokedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "valid" | "unknown" | "revoked";
    districtName: string | null;
    serial: string | null;
    courseTitle: string | null;
    courseVersion: number | null;
    holderName: string | null;
    sessionDate: string | null;
    venueName: string | null;
    leadTrainerName: string | null;
    issuedAt: string | null;
    revokedAt: string | null;
}, {
    status: "valid" | "unknown" | "revoked";
    districtName: string | null;
    serial: string | null;
    courseTitle: string | null;
    courseVersion: number | null;
    holderName: string | null;
    sessionDate: string | null;
    venueName: string | null;
    leadTrainerName: string | null;
    issuedAt: string | null;
    revokedAt: string | null;
}>;
export type TrainingVerification = z.infer<typeof TrainingVerification>;
/** The one answer for a code that names nothing. Defined once so it cannot drift. */
export declare const UNKNOWN_TRAINING_VERIFICATION: TrainingVerification;
/** A course as staff see it, drafts included. */
export declare const AdminTrainingCourse: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    version: z.ZodNumber;
    isPublished: z.ZodBoolean;
    sessionCount: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string;
    title: string;
    createdAt: string;
    version: number;
    summary: string;
    updatedAt: string;
    isPublished: boolean;
    sessionCount: number;
}, {
    id: string;
    slug: string;
    title: string;
    createdAt: string;
    version: number;
    summary: string;
    updatedAt: string;
    isPublished: boolean;
    sessionCount: number;
}>;
export type AdminTrainingCourse = z.infer<typeof AdminTrainingCourse>;
export declare const AdminTrainingCourseListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AdminTrainingCourseListQuery = z.infer<typeof AdminTrainingCourseListQuery>;
export declare const AdminTrainingCourseListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        summary: z.ZodString;
        version: z.ZodNumber;
        isPublished: z.ZodBoolean;
        sessionCount: z.ZodNumber;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string;
        title: string;
        createdAt: string;
        version: number;
        summary: string;
        updatedAt: string;
        isPublished: boolean;
        sessionCount: number;
    }, {
        id: string;
        slug: string;
        title: string;
        createdAt: string;
        version: number;
        summary: string;
        updatedAt: string;
        isPublished: boolean;
        sessionCount: number;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        slug: string;
        title: string;
        createdAt: string;
        version: number;
        summary: string;
        updatedAt: string;
        isPublished: boolean;
        sessionCount: number;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        id: string;
        slug: string;
        title: string;
        createdAt: string;
        version: number;
        summary: string;
        updatedAt: string;
        isPublished: boolean;
        sessionCount: number;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminTrainingCourseListResponse = z.infer<typeof AdminTrainingCourseListResponse>;
/**
 * Creating a course.
 *
 * The slug is the stable public handle and is taken rather than derived from
 * the title, because a title gets corrected and a URL somebody printed must
 * not move when it does.
 */
export declare const CreateAdminTrainingCourse: z.ZodObject<{
    slug: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    slug: string;
    title: string;
    summary: string;
}, {
    slug: string;
    title: string;
    summary: string;
}>;
export type CreateAdminTrainingCourse = z.infer<typeof CreateAdminTrainingCourse>;
/**
 * Editing a course.
 *
 * `bumpVersion` is explicit rather than automatic on any edit. The version is
 * printed on certificates and means "this is the syllabus they sat through",
 * so fixing a typo must not claim a new one was taught. Whoever edits decides
 * which kind of change they just made.
 */
export declare const UpdateAdminTrainingCourse: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    bumpVersion: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    summary?: string | undefined;
    bumpVersion?: boolean | undefined;
}, {
    title?: string | undefined;
    summary?: string | undefined;
    bumpVersion?: boolean | undefined;
}>;
export type UpdateAdminTrainingCourse = z.infer<typeof UpdateAdminTrainingCourse>;
/** Publishing or unpublishing a course. Several may be published at once (AC-30). */
export declare const PublishAdminTrainingCourse: z.ZodObject<{
    published: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    published: boolean;
}, {
    published: boolean;
}>;
export type PublishAdminTrainingCourse = z.infer<typeof PublishAdminTrainingCourse>;
/** A venue as staff see it, retired ones included when asked for. */
export declare const AdminTrainingVenue: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    address: z.ZodString;
    districtId: z.ZodNumber;
    districtName: z.ZodString;
    provinceId: z.ZodNumber;
    provinceName: z.ZodString;
    /** The Injishi office is one row in the venue list, flagged, not special-cased. */
    isOffice: z.ZodBoolean;
} & {
    retiredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    districtName: string;
    provinceId: number;
    districtId: number;
    address: string;
    provinceName: string;
    createdAt: string;
    isOffice: boolean;
    retiredAt: string | null;
}, {
    name: string;
    id: string;
    districtName: string;
    provinceId: number;
    districtId: number;
    address: string;
    provinceName: string;
    createdAt: string;
    isOffice: boolean;
    retiredAt: string | null;
}>;
export type AdminTrainingVenue = z.infer<typeof AdminTrainingVenue>;
export declare const AdminTrainingVenueListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    includeRetired: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
    includeRetired?: boolean | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    includeRetired?: boolean | undefined;
}>;
export type AdminTrainingVenueListQuery = z.infer<typeof AdminTrainingVenueListQuery>;
export declare const AdminTrainingVenueListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
        /** The Injishi office is one row in the venue list, flagged, not special-cased. */
        isOffice: z.ZodBoolean;
    } & {
        retiredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminTrainingVenueListResponse = z.infer<typeof AdminTrainingVenueListResponse>;
/**
 * Creating a venue.
 *
 * `districtId` is an integer smart code from the geography reference data (D11)
 * and carries its province, so no province is sent: accepting both would let a
 * caller claim a district is somewhere it is not.
 */
export declare const CreateAdminTrainingVenue: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodString;
    districtId: z.ZodNumber;
    isOffice: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    districtId: number;
    address: string;
    isOffice?: boolean | undefined;
}, {
    name: string;
    districtId: number;
    address: string;
    isOffice?: boolean | undefined;
}>;
export type CreateAdminTrainingVenue = z.infer<typeof CreateAdminTrainingVenue>;
export declare const UpdateAdminTrainingVenue: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    districtId: z.ZodOptional<z.ZodNumber>;
    isOffice: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    districtId?: number | undefined;
    address?: string | undefined;
    isOffice?: boolean | undefined;
}, {
    name?: string | undefined;
    districtId?: number | undefined;
    address?: string | undefined;
    isOffice?: boolean | undefined;
}>;
export type UpdateAdminTrainingVenue = z.infer<typeof UpdateAdminTrainingVenue>;
/**
 * What retiring a venue answers.
 *
 * `draftsNowBlocked` is counted and reported because retiring is one way and
 * would otherwise be silent: the person retiring a hall should be told, then
 * and there, that three drafted sessions can no longer be published at it.
 */
export declare const RetireAdminTrainingVenueResult: z.ZodObject<{
    venue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
        /** The Injishi office is one row in the venue list, flagged, not special-cased. */
        isOffice: z.ZodBoolean;
    } & {
        retiredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }>;
    draftsNowBlocked: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    };
    draftsNowBlocked: number;
}, {
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    };
    draftsNowBlocked: number;
}>;
export type RetireAdminTrainingVenueResult = z.infer<typeof RetireAdminTrainingVenueResult>;
/** A trainer on a session. The lead's name is what a certificate prints. */
export declare const TrainingSessionTrainer: z.ZodObject<{
    userId: z.ZodString;
    name: z.ZodString;
    isLead: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    userId: string;
    isLead: boolean;
}, {
    name: string;
    userId: string;
    isLead: boolean;
}>;
export type TrainingSessionTrainer = z.infer<typeof TrainingSessionTrainer>;
/**
 * A person a session form may offer as a lead or co trainer: live staff
 * holding the `trainer` role (AC-7, AC-24).
 *
 * THREE FIELDS AND NO MORE. The list is readable with `training.view`, which a
 * trainer holds, so one trainer can read every other trainer's entry. What a
 * picker needs to tell two people apart is a name and an email; phone, roles,
 * grant history and anything else from `admin_users` stay out of the shape, so
 * widening what is disclosed is a contract change somebody has to make on
 * purpose rather than a column a query happened to select.
 *
 * `name` is nullable because `users.name` is until a profile is filled in. It
 * is passed through as null rather than replaced with the email, because the
 * email is already beside it and a screen can choose its own fallback.
 */
export declare const AdminTrainingTrainer: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    id: string;
    email: string;
}, {
    name: string | null;
    id: string;
    email: string;
}>;
export type AdminTrainingTrainer = z.infer<typeof AdminTrainingTrainer>;
export declare const AdminTrainingTrainerListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AdminTrainingTrainerListQuery = z.infer<typeof AdminTrainingTrainerListQuery>;
export declare const AdminTrainingTrainerListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        email: string;
    }, {
        name: string | null;
        id: string;
        email: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        name: string | null;
        id: string;
        email: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        name: string | null;
        id: string;
        email: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminTrainingTrainerListResponse = z.infer<typeof AdminTrainingTrainerListResponse>;
/** A session as staff see it, drafts and cancellations included. */
export declare const AdminTrainingSession: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
    course: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        slug: z.ZodString;
        version: z.ZodNumber;
        isPublished: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slug: string;
        title: string;
        version: number;
        isPublished: boolean;
    }, {
        id: string;
        slug: string;
        title: string;
        version: number;
        isPublished: boolean;
    }>;
    venue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        provinceId: z.ZodNumber;
        provinceName: z.ZodString;
        /** The Injishi office is one row in the venue list, flagged, not special-cased. */
        isOffice: z.ZodBoolean;
    } & {
        retiredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }, {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    }>;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    feeRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
    seatCount: z.ZodNumber;
    registrationCount: z.ZodNumber;
    trainers: z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodString;
        isLead: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string;
        isLead: boolean;
    }, {
        name: string;
        userId: string;
        isLead: boolean;
    }>, "many">;
    publishedAt: z.ZodNullable<z.ZodString>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    cancellationReason: z.ZodNullable<z.ZodString>;
    rescheduledFrom: z.ZodNullable<z.ZodString>;
    rosterClosedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "draft" | "published" | "completed";
    id: string;
    publishedAt: string | null;
    currency: "RWF";
    feeRwf: number;
    createdAt: string;
    startsAt: string;
    endsAt: string;
    cancelledAt: string | null;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    };
    seatCount: number;
    registrationCount: number;
    course: {
        id: string;
        slug: string;
        title: string;
        version: number;
        isPublished: boolean;
    };
    trainers: {
        name: string;
        userId: string;
        isLead: boolean;
    }[];
    cancellationReason: string | null;
    rescheduledFrom: string | null;
    rosterClosedAt: string | null;
}, {
    status: "cancelled" | "draft" | "published" | "completed";
    id: string;
    publishedAt: string | null;
    currency: "RWF";
    feeRwf: number;
    createdAt: string;
    startsAt: string;
    endsAt: string;
    cancelledAt: string | null;
    venue: {
        name: string;
        id: string;
        districtName: string;
        provinceId: number;
        districtId: number;
        address: string;
        provinceName: string;
        createdAt: string;
        isOffice: boolean;
        retiredAt: string | null;
    };
    seatCount: number;
    registrationCount: number;
    course: {
        id: string;
        slug: string;
        title: string;
        version: number;
        isPublished: boolean;
    };
    trainers: {
        name: string;
        userId: string;
        isLead: boolean;
    }[];
    cancellationReason: string | null;
    rescheduledFrom: string | null;
    rosterClosedAt: string | null;
}>;
export type AdminTrainingSession = z.infer<typeof AdminTrainingSession>;
export declare const AdminTrainingSessionListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["draft", "published", "cancelled", "completed"]>>;
    courseId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "cancelled" | "draft" | "published" | "completed" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    courseId?: string | undefined;
}, {
    status?: "cancelled" | "draft" | "published" | "completed" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    courseId?: string | undefined;
}>;
export type AdminTrainingSessionListQuery = z.infer<typeof AdminTrainingSessionListQuery>;
export declare const AdminTrainingSessionListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
        course: z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            slug: z.ZodString;
            version: z.ZodNumber;
            isPublished: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        }, {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        }>;
        venue: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            address: z.ZodString;
            districtId: z.ZodNumber;
            districtName: z.ZodString;
            provinceId: z.ZodNumber;
            provinceName: z.ZodString;
            /** The Injishi office is one row in the venue list, flagged, not special-cased. */
            isOffice: z.ZodBoolean;
        } & {
            retiredAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        }, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        }>;
        startsAt: z.ZodString;
        endsAt: z.ZodString;
        feeRwf: z.ZodNumber;
        currency: z.ZodLiteral<"RWF">;
        seatCount: z.ZodNumber;
        registrationCount: z.ZodNumber;
        trainers: z.ZodArray<z.ZodObject<{
            userId: z.ZodString;
            name: z.ZodString;
            isLead: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            userId: string;
            isLead: boolean;
        }, {
            name: string;
            userId: string;
            isLead: boolean;
        }>, "many">;
        publishedAt: z.ZodNullable<z.ZodString>;
        cancelledAt: z.ZodNullable<z.ZodString>;
        cancellationReason: z.ZodNullable<z.ZodString>;
        rescheduledFrom: z.ZodNullable<z.ZodString>;
        rosterClosedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminTrainingSessionListResponse = z.infer<typeof AdminTrainingSessionListResponse>;
/**
 * Drafting a session.
 *
 * `venueId` is PICKED from the active venue list and never typed (AC-32), and
 * `leadTrainerId` is required here rather than defaulted to the caller: a
 * platform admin drafts sessions they will not teach, and a session whose lead
 * is whoever happened to fill the form is a certificate signed by the wrong
 * name.
 */
export declare const CreateAdminTrainingSession: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    courseId: z.ZodString;
    venueId: z.ZodString;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    feeRwf: z.ZodNumber;
    seatCount: z.ZodNumber;
    leadTrainerId: z.ZodString;
    coTrainerIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}>, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}>, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}, {
    feeRwf: number;
    startsAt: string;
    endsAt: string;
    courseId: string;
    seatCount: number;
    venueId: string;
    leadTrainerId: string;
    coTrainerIds?: string[] | undefined;
}>;
export type CreateAdminTrainingSession = z.infer<typeof CreateAdminTrainingSession>;
/**
 * Editing a session.
 *
 * Moving `startsAt` on a PUBLISHED session is a reschedule and needs a reason,
 * because every registrant is mailed it. The API enforces that pairing; this
 * shape only carries it.
 */
export declare const UpdateAdminTrainingSession: z.ZodObject<{
    venueId: z.ZodOptional<z.ZodString>;
    startsAt: z.ZodOptional<z.ZodString>;
    endsAt: z.ZodOptional<z.ZodString>;
    feeRwf: z.ZodOptional<z.ZodNumber>;
    seatCount: z.ZodOptional<z.ZodNumber>;
    leadTrainerId: z.ZodOptional<z.ZodString>;
    coTrainerIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    rescheduleReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    feeRwf?: number | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    seatCount?: number | undefined;
    venueId?: string | undefined;
    leadTrainerId?: string | undefined;
    coTrainerIds?: string[] | undefined;
    rescheduleReason?: string | undefined;
}, {
    feeRwf?: number | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    seatCount?: number | undefined;
    venueId?: string | undefined;
    leadTrainerId?: string | undefined;
    coTrainerIds?: string[] | undefined;
    rescheduleReason?: string | undefined;
}>;
export type UpdateAdminTrainingSession = z.infer<typeof UpdateAdminTrainingSession>;
/** Cancelling a session. The reason is required and is mailed to every registrant. */
export declare const CancelAdminTrainingSession: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CancelAdminTrainingSession = z.infer<typeof CancelAdminTrainingSession>;
/**
 * What cancelling answers.
 *
 * `releasedCount` excludes anybody already marked present (AC-21). Somebody
 * who attended a session that was later cancelled still attended it, and still
 * holds their certificate.
 */
export declare const CancelAdminTrainingSessionResult: z.ZodObject<{
    session: z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["draft", "published", "cancelled", "completed"]>;
        course: z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            slug: z.ZodString;
            version: z.ZodNumber;
            isPublished: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        }, {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        }>;
        venue: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            address: z.ZodString;
            districtId: z.ZodNumber;
            districtName: z.ZodString;
            provinceId: z.ZodNumber;
            provinceName: z.ZodString;
            /** The Injishi office is one row in the venue list, flagged, not special-cased. */
            isOffice: z.ZodBoolean;
        } & {
            retiredAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        }, {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        }>;
        startsAt: z.ZodString;
        endsAt: z.ZodString;
        feeRwf: z.ZodNumber;
        currency: z.ZodLiteral<"RWF">;
        seatCount: z.ZodNumber;
        registrationCount: z.ZodNumber;
        trainers: z.ZodArray<z.ZodObject<{
            userId: z.ZodString;
            name: z.ZodString;
            isLead: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            userId: string;
            isLead: boolean;
        }, {
            name: string;
            userId: string;
            isLead: boolean;
        }>, "many">;
        publishedAt: z.ZodNullable<z.ZodString>;
        cancelledAt: z.ZodNullable<z.ZodString>;
        cancellationReason: z.ZodNullable<z.ZodString>;
        rescheduledFrom: z.ZodNullable<z.ZodString>;
        rosterClosedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }, {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    }>;
    releasedCount: z.ZodNumber;
    keptAttendedCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    session: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    };
    releasedCount: number;
    keptAttendedCount: number;
}, {
    session: {
        status: "cancelled" | "draft" | "published" | "completed";
        id: string;
        publishedAt: string | null;
        currency: "RWF";
        feeRwf: number;
        createdAt: string;
        startsAt: string;
        endsAt: string;
        cancelledAt: string | null;
        venue: {
            name: string;
            id: string;
            districtName: string;
            provinceId: number;
            districtId: number;
            address: string;
            provinceName: string;
            createdAt: string;
            isOffice: boolean;
            retiredAt: string | null;
        };
        seatCount: number;
        registrationCount: number;
        course: {
            id: string;
            slug: string;
            title: string;
            version: number;
            isPublished: boolean;
        };
        trainers: {
            name: string;
            userId: string;
            isLead: boolean;
        }[];
        cancellationReason: string | null;
        rescheduledFrom: string | null;
        rosterClosedAt: string | null;
    };
    releasedCount: number;
    keptAttendedCount: number;
}>;
export type CancelAdminTrainingSessionResult = z.infer<typeof CancelAdminTrainingSessionResult>;
/**
 * One registrant on a roster, with the decision that currently stands.
 *
 * `latestDecision` is the newest row of an append-only table, never a column
 * that got overwritten (AC-11). `decisionCount` is carried so a trainer can see
 * that a person was ticked twice and the second tick won, rather than
 * wondering whether the first one registered at all.
 */
export declare const TrainingRosterEntry: z.ZodObject<{
    registrationId: z.ZodString;
    userId: z.ZodString;
    fullName: z.ZodString;
    /** The address given at registration. A record of the day, not a mailbox. */
    email: z.ZodString;
    phone: z.ZodString;
    orgId: z.ZodNullable<z.ZodString>;
    businessName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
    source: z.ZodEnum<["self", "walk_in"]>;
    registeredAt: z.ZodString;
    latestDecision: z.ZodNullable<z.ZodEnum<["present", "absent"]>>;
    latestDecisionAt: z.ZodNullable<z.ZodString>;
    decisionCount: z.ZodNumber;
    certificateId: z.ZodNullable<z.ZodString>;
    certificateSerial: z.ZodNullable<z.ZodString>;
    certificateRevokedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    fullName: string;
    email: string;
    orgId: string | null;
    source: "self" | "walk_in";
    businessName: string | null;
    registeredAt: string;
    userId: string;
    phone: string;
    registrationId: string;
    certificateId: string | null;
    latestDecision: "absent" | "present" | null;
    latestDecisionAt: string | null;
    decisionCount: number;
    certificateSerial: string | null;
    certificateRevokedAt: string | null;
}, {
    status: "released" | "withdrawn" | "registered" | "attended" | "absent";
    fullName: string;
    email: string;
    orgId: string | null;
    source: "self" | "walk_in";
    businessName: string | null;
    registeredAt: string;
    userId: string;
    phone: string;
    registrationId: string;
    certificateId: string | null;
    latestDecision: "absent" | "present" | null;
    latestDecisionAt: string | null;
    decisionCount: number;
    certificateSerial: string | null;
    certificateRevokedAt: string | null;
}>;
export type TrainingRosterEntry = z.infer<typeof TrainingRosterEntry>;
export declare const TrainingRosterQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type TrainingRosterQuery = z.infer<typeof TrainingRosterQuery>;
export declare const TrainingRosterResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        registrationId: z.ZodString;
        userId: z.ZodString;
        fullName: z.ZodString;
        /** The address given at registration. A record of the day, not a mailbox. */
        email: z.ZodString;
        phone: z.ZodString;
        orgId: z.ZodNullable<z.ZodString>;
        businessName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
        source: z.ZodEnum<["self", "walk_in"]>;
        registeredAt: z.ZodString;
        latestDecision: z.ZodNullable<z.ZodEnum<["present", "absent"]>>;
        latestDecisionAt: z.ZodNullable<z.ZodString>;
        decisionCount: z.ZodNumber;
        certificateId: z.ZodNullable<z.ZodString>;
        certificateSerial: z.ZodNullable<z.ZodString>;
        certificateRevokedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "released" | "withdrawn" | "registered" | "attended" | "absent";
        fullName: string;
        email: string;
        orgId: string | null;
        source: "self" | "walk_in";
        businessName: string | null;
        registeredAt: string;
        userId: string;
        phone: string;
        registrationId: string;
        certificateId: string | null;
        latestDecision: "absent" | "present" | null;
        latestDecisionAt: string | null;
        decisionCount: number;
        certificateSerial: string | null;
        certificateRevokedAt: string | null;
    }, {
        status: "released" | "withdrawn" | "registered" | "attended" | "absent";
        fullName: string;
        email: string;
        orgId: string | null;
        source: "self" | "walk_in";
        businessName: string | null;
        registeredAt: string;
        userId: string;
        phone: string;
        registrationId: string;
        certificateId: string | null;
        latestDecision: "absent" | "present" | null;
        latestDecisionAt: string | null;
        decisionCount: number;
        certificateSerial: string | null;
        certificateRevokedAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "released" | "withdrawn" | "registered" | "attended" | "absent";
        fullName: string;
        email: string;
        orgId: string | null;
        source: "self" | "walk_in";
        businessName: string | null;
        registeredAt: string;
        userId: string;
        phone: string;
        registrationId: string;
        certificateId: string | null;
        latestDecision: "absent" | "present" | null;
        latestDecisionAt: string | null;
        decisionCount: number;
        certificateSerial: string | null;
        certificateRevokedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "released" | "withdrawn" | "registered" | "attended" | "absent";
        fullName: string;
        email: string;
        orgId: string | null;
        source: "self" | "walk_in";
        businessName: string | null;
        registeredAt: string;
        userId: string;
        phone: string;
        registrationId: string;
        certificateId: string | null;
        latestDecision: "absent" | "present" | null;
        latestDecisionAt: string | null;
        decisionCount: number;
        certificateSerial: string | null;
        certificateRevokedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type TrainingRosterResponse = z.infer<typeof TrainingRosterResponse>;
/**
 * Adding a walk-in.
 *
 * The email is typed HERE and only here, because the person it names is
 * standing in the room and has no session to read it from. It is matched
 * against existing accounts rather than used to make a new one (AC-8): a walk
 * in who already has an Injishi account must end up with one account, not two,
 * or their certificate lands on an identity they cannot sign in to.
 */
export declare const CreateTrainingWalkIn: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    orgId: z.ZodOptional<z.ZodString>;
    businessName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    phone: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}, {
    fullName: string;
    email: string;
    phone: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}>, {
    fullName: string;
    email: string;
    phone: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}, {
    fullName: string;
    email: string;
    phone: string;
    orgId?: string | undefined;
    businessName?: string | undefined;
}>;
export type CreateTrainingWalkIn = z.infer<typeof CreateTrainingWalkIn>;
export declare const TrainingWalkInResult: z.ZodObject<{
    registrationId: z.ZodString;
    source: z.ZodLiteral<"walk_in">;
    /** True when the email matched an account that already existed. */
    linkedExistingUser: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    source: "walk_in";
    registrationId: string;
    linkedExistingUser: boolean;
}, {
    source: "walk_in";
    registrationId: string;
    linkedExistingUser: boolean;
}>;
export type TrainingWalkInResult = z.infer<typeof TrainingWalkInResult>;
/**
 * The tick.
 *
 * `idempotencyKey` is REQUIRED, not optional (AC-9). Marking somebody present
 * mints a certificate, and a trainer on a bad connection taps twice. Without a
 * key the second tap issues a second certificate with its own serial, and a
 * serial is a thing that gets printed and read down a phone line, so there is
 * no tidying that up afterwards.
 */
export declare const RecordTrainingAttendance: z.ZodObject<{
    decision: z.ZodEnum<["present", "absent"]>;
    reason: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decision: "absent" | "present";
    idempotencyKey: string;
    reason?: string | undefined;
}, {
    decision: "absent" | "present";
    idempotencyKey: string;
    reason?: string | undefined;
}>;
export type RecordTrainingAttendance = z.infer<typeof RecordTrainingAttendance>;
/**
 * What the tick answers.
 *
 * `certificateId` is null for an absent decision and for a replayed present
 * decision that issued nothing new. `issuedNow` separates "there is a
 * certificate" from "this call made it", which is what lets a client confirm
 * once rather than on every retry.
 */
export declare const RecordTrainingAttendanceResult: z.ZodObject<{
    decisionId: z.ZodString;
    registrationStatus: z.ZodEnum<["registered", "attended", "absent", "withdrawn", "released"]>;
    certificateId: z.ZodNullable<z.ZodString>;
    certificateSerial: z.ZodNullable<z.ZodString>;
    issuedNow: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    registrationStatus: "released" | "withdrawn" | "registered" | "attended" | "absent";
    certificateId: string | null;
    certificateSerial: string | null;
    decisionId: string;
    issuedNow: boolean;
}, {
    registrationStatus: "released" | "withdrawn" | "registered" | "attended" | "absent";
    certificateId: string | null;
    certificateSerial: string | null;
    decisionId: string;
    issuedNow: boolean;
}>;
export type RecordTrainingAttendanceResult = z.infer<typeof RecordTrainingAttendanceResult>;
/** What closing a roster answers. One action, every undecided person (AC-10). */
export declare const CloseTrainingRosterResult: z.ZodObject<{
    markedAbsent: z.ZodNumber;
    rosterClosedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    rosterClosedAt: string;
    markedAbsent: number;
}, {
    rosterClosedAt: string;
    markedAbsent: number;
}>;
export type CloseTrainingRosterResult = z.infer<typeof CloseTrainingRosterResult>;
/**
 * Withdrawing a certificate.
 *
 * The reason is required and is written to the audit log (AC-22). A credential
 * that can be withdrawn silently is a credential nobody can rely on having
 * been withdrawn for cause.
 */
export declare const RevokeTrainingCertificate: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type RevokeTrainingCertificate = z.infer<typeof RevokeTrainingCertificate>;
/** A certificate as staff see it. The row is never deleted (AC-23). */
export declare const AdminTrainingCertificate: z.ZodObject<{
    id: z.ZodString;
    serial: z.ZodString;
    registrationId: z.ZodString;
    sessionId: z.ZodString;
    holderName: z.ZodString;
    holderUserId: z.ZodString;
    courseTitle: z.ZodString;
    courseVersion: z.ZodNumber;
    sessionDate: z.ZodString;
    venueName: z.ZodString;
    districtName: z.ZodString;
    leadTrainerName: z.ZodString;
    issuedAt: z.ZodString;
    issuedBy: z.ZodString;
    revokedAt: z.ZodNullable<z.ZodString>;
    revokedBy: z.ZodNullable<z.ZodString>;
    revocationReason: z.ZodNullable<z.ZodString>;
    hasPdf: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    districtName: string;
    issuedBy: string;
    sessionId: string;
    registrationId: string;
    serial: string;
    courseTitle: string;
    courseVersion: number;
    holderName: string;
    sessionDate: string;
    venueName: string;
    leadTrainerName: string;
    issuedAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    hasPdf: boolean;
    holderUserId: string;
    revokedBy: string | null;
}, {
    id: string;
    districtName: string;
    issuedBy: string;
    sessionId: string;
    registrationId: string;
    serial: string;
    courseTitle: string;
    courseVersion: number;
    holderName: string;
    sessionDate: string;
    venueName: string;
    leadTrainerName: string;
    issuedAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    hasPdf: boolean;
    holderUserId: string;
    revokedBy: string | null;
}>;
export type AdminTrainingCertificate = z.infer<typeof AdminTrainingCertificate>;
export declare const AdminTrainingCertificateListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sessionId?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sessionId?: string | undefined;
}>;
export type AdminTrainingCertificateListQuery = z.infer<typeof AdminTrainingCertificateListQuery>;
export declare const AdminTrainingCertificateListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serial: z.ZodString;
        registrationId: z.ZodString;
        sessionId: z.ZodString;
        holderName: z.ZodString;
        holderUserId: z.ZodString;
        courseTitle: z.ZodString;
        courseVersion: z.ZodNumber;
        sessionDate: z.ZodString;
        venueName: z.ZodString;
        districtName: z.ZodString;
        leadTrainerName: z.ZodString;
        issuedAt: z.ZodString;
        issuedBy: z.ZodString;
        revokedAt: z.ZodNullable<z.ZodString>;
        revokedBy: z.ZodNullable<z.ZodString>;
        revocationReason: z.ZodNullable<z.ZodString>;
        hasPdf: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        districtName: string;
        issuedBy: string;
        sessionId: string;
        registrationId: string;
        serial: string;
        courseTitle: string;
        courseVersion: number;
        holderName: string;
        sessionDate: string;
        venueName: string;
        leadTrainerName: string;
        issuedAt: string;
        revokedAt: string | null;
        revocationReason: string | null;
        hasPdf: boolean;
        holderUserId: string;
        revokedBy: string | null;
    }, {
        id: string;
        districtName: string;
        issuedBy: string;
        sessionId: string;
        registrationId: string;
        serial: string;
        courseTitle: string;
        courseVersion: number;
        holderName: string;
        sessionDate: string;
        venueName: string;
        leadTrainerName: string;
        issuedAt: string;
        revokedAt: string | null;
        revocationReason: string | null;
        hasPdf: boolean;
        holderUserId: string;
        revokedBy: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        districtName: string;
        issuedBy: string;
        sessionId: string;
        registrationId: string;
        serial: string;
        courseTitle: string;
        courseVersion: number;
        holderName: string;
        sessionDate: string;
        venueName: string;
        leadTrainerName: string;
        issuedAt: string;
        revokedAt: string | null;
        revocationReason: string | null;
        hasPdf: boolean;
        holderUserId: string;
        revokedBy: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        id: string;
        districtName: string;
        issuedBy: string;
        sessionId: string;
        registrationId: string;
        serial: string;
        courseTitle: string;
        courseVersion: number;
        holderName: string;
        sessionDate: string;
        venueName: string;
        leadTrainerName: string;
        issuedAt: string;
        revokedAt: string | null;
        revocationReason: string | null;
        hasPdf: boolean;
        holderUserId: string;
        revokedBy: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminTrainingCertificateListResponse = z.infer<typeof AdminTrainingCertificateListResponse>;
/**
 * The words a certificate is allowed to use about itself (AC-31).
 *
 * Held here rather than typed into three templates, because the constraint is
 * one fact about what the credential means and it has to hold on the PDF, the
 * holder's page and the public verification page at once. Nothing here reads
 * qualified, passed or certified competent: no assessment took place, and the
 * wording is the only thing keeping the paper honest about that.
 */
export declare const TRAINING_CREDENTIAL_WORDING: {
    /** The line under the holder's name on the PDF. */
    readonly pdfClaim: "attended this live training session";
    /** What the public page says about a certificate that stands. */
    readonly verifiedClaim: "This certificate is genuine. The person named attended the live session below.";
    /** What the public page says about one that was withdrawn. */
    readonly revokedClaim: "This certificate has been withdrawn and should not be relied on.";
    /** What the public page says about a code that names nothing. */
    readonly unknownClaim: "We cannot confirm a certificate from this code.";
    /** The honest label for a session price that nothing collects yet. */
    readonly feeNotice: "Nothing is collected online yet. The session fee is shown so you know what it is.";
};
/**
 * The words that must never appear on a training credential surface (AC-31).
 *
 * A list rather than a comment, so the wording pass can be checked mechanically
 * instead of read for. Every entry is a claim about competence, and this
 * credential is a claim about attendance.
 */
export declare const TRAINING_FORBIDDEN_CLAIMS: readonly string[];
//# sourceMappingURL=training.d.ts.map