import { z } from "zod";
/**
 * Support assistant wire contract (ADR-061, F-S16).
 *
 * `POST /api/v1/assistant/messages` is a PUBLIC write, like the support
 * intake: a signed-out visitor may ask too. So every string is capped, unknown
 * keys are refused (`.strict()`), and nothing about who is asking comes from
 * the body. The asker is the session, or the anonymous conversation cookie the
 * API sets; neither is ever a field here.
 *
 * The caps are exported so every surface sets the same `maxLength` and the two
 * ends cannot disagree about what fits.
 */
/** Longest message accepted: a detailed question, not a document. */
export declare const ASSISTANT_MESSAGE_MAX = 2000;
/** Longest page path recorded with a message (Phase 2 context, stored only). */
export declare const ASSISTANT_PAGE_PATH_MAX = 200;
/** User turns in one conversation before the user is asked to start a new one. */
export declare const ASSISTANT_TURN_LIMIT = 40;
/** Which surface a conversation was started on. */
export declare const AssistantSurface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
export type AssistantSurface = z.infer<typeof AssistantSurface>;
export declare const SendAssistantMessageInput: z.ZodObject<{
    message: z.ZodString;
    surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
    pagePath: z.ZodOptional<z.ZodString>;
    startNew: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    message: string;
    surface: "admin" | "web" | "app" | "mobile";
    pagePath?: string | undefined;
    startNew?: boolean | undefined;
}, {
    message: string;
    surface: "admin" | "web" | "app" | "mobile";
    pagePath?: string | undefined;
    startNew?: boolean | undefined;
}>;
export type SendAssistantMessageInput = z.infer<typeof SendAssistantMessageInput>;
/**
 * Where an answer came from. The assistant may only cite what a tool returned
 * in the same turn; the API drops any citation it cannot trace to one.
 */
export declare const AssistantSourceKind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
export type AssistantSourceKind = z.infer<typeof AssistantSourceKind>;
export declare const AssistantSource: z.ZodObject<{
    kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
    id: z.ZodString;
    title: z.ZodString;
    /** A path on the surface that opens it, or null when there is none. */
    href: z.ZodNullable<z.ZodString>;
    /**
     * A listing's card details, when the source is a published property: what
     * a surface draws on its card. Absent on other kinds and on answers stored
     * before cards existed.
     */
    listing: z.ZodOptional<z.ZodObject<{
        district: z.ZodNullable<z.ZodString>;
        /** The lowest base nightly rate, before any date specific price. */
        fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
        maxGuests: z.ZodNullable<z.ZodNumber>;
        roomTypes: z.ZodNumber;
        /** The cover photo's URL, or null when the property has none. */
        photoUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        fromNightlyRateRwf: number | null;
        maxGuests: number | null;
        roomTypes: number;
        photoUrl: string | null;
    }, {
        district: string | null;
        fromNightlyRateRwf: number | null;
        maxGuests: number | null;
        roomTypes: number;
        photoUrl: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    kind: "listing" | "article" | "task" | "tutorial" | "record";
    id: string;
    title: string;
    href: string | null;
    listing?: {
        district: string | null;
        fromNightlyRateRwf: number | null;
        maxGuests: number | null;
        roomTypes: number;
        photoUrl: string | null;
    } | undefined;
}, {
    kind: "listing" | "article" | "task" | "tutorial" | "record";
    id: string;
    title: string;
    href: string | null;
    listing?: {
        district: string | null;
        fromNightlyRateRwf: number | null;
        maxGuests: number | null;
        roomTypes: number;
        photoUrl: string | null;
    } | undefined;
}>;
export type AssistantSource = z.infer<typeof AssistantSource>;
/**
 * A question the person can send with one tap. `label` is what the chip
 * says; `message` is what is sent, exactly as if typed.
 */
export declare const AssistantSuggestion: z.ZodObject<{
    label: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    label: string;
}, {
    message: string;
    label: string;
}>;
export type AssistantSuggestion = z.infer<typeof AssistantSuggestion>;
/**
 * A change the assistant prepared and the person has not yet approved
 * (ADR-061 D-k). The surface draws its approval card from THIS, the stored
 * row, never from the model's words: what the person approves is exactly what
 * will be executed.
 */
export declare const AssistantProposalKind: z.ZodEnum<["room_type.price"]>;
export type AssistantProposalKind = z.infer<typeof AssistantProposalKind>;
export declare const AssistantProposalState: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
export type AssistantProposalState = z.infer<typeof AssistantProposalState>;
export declare const AssistantProposal: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["room_type.price"]>;
    /** What changes, e.g. "Double room: price per night". */
    title: z.ZodString;
    /** The value the card shows as current, formatted for people. */
    current: z.ZodString;
    /** The value approval would set, formatted for people. */
    proposed: z.ZodString;
    state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
    expiresAt: z.ZodString;
    /** Why it failed or could not be approved, when it did not execute. */
    error: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "room_type.price";
    id: string;
    current: string;
    title: string;
    state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
    proposed: string;
    expiresAt: string;
    error: string | null;
}, {
    kind: "room_type.price";
    id: string;
    current: string;
    title: string;
    state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
    proposed: string;
    expiresAt: string;
    error: string | null;
}>;
export type AssistantProposal = z.infer<typeof AssistantProposal>;
/** `POST /api/v1/assistant/actions/:id/approve` and `/reject`. */
export declare const AssistantProposalResult: z.ZodObject<{
    proposal: z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["room_type.price"]>;
        /** What changes, e.g. "Double room: price per night". */
        title: z.ZodString;
        /** The value the card shows as current, formatted for people. */
        current: z.ZodString;
        /** The value approval would set, formatted for people. */
        proposed: z.ZodString;
        state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
        expiresAt: z.ZodString;
        /** Why it failed or could not be approved, when it did not execute. */
        error: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }, {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    proposal: {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    };
}, {
    proposal: {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    };
}>;
export type AssistantProposalResult = z.infer<typeof AssistantProposalResult>;
export declare const AssistantRole: z.ZodEnum<["user", "assistant"]>;
export type AssistantRole = z.infer<typeof AssistantRole>;
export declare const AssistantMessage: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<["user", "assistant"]>;
    text: z.ZodString;
    sources: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
        id: z.ZodString;
        title: z.ZodString;
        /** A path on the surface that opens it, or null when there is none. */
        href: z.ZodNullable<z.ZodString>;
        /**
         * A listing's card details, when the source is a published property: what
         * a surface draws on its card. Absent on other kinds and on answers stored
         * before cards existed.
         */
        listing: z.ZodOptional<z.ZodObject<{
            district: z.ZodNullable<z.ZodString>;
            /** The lowest base nightly rate, before any date specific price. */
            fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
            maxGuests: z.ZodNullable<z.ZodNumber>;
            roomTypes: z.ZodNumber;
            /** The cover photo's URL, or null when the property has none. */
            photoUrl: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        }, {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        kind: "listing" | "article" | "task" | "tutorial" | "record";
        id: string;
        title: string;
        href: string | null;
        listing?: {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        } | undefined;
    }, {
        kind: "listing" | "article" | "task" | "tutorial" | "record";
        id: string;
        title: string;
        href: string | null;
        listing?: {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        } | undefined;
    }>, "many">;
    /** Changes this answer prepared, each awaiting the person's own approval. */
    proposals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["room_type.price"]>;
        /** What changes, e.g. "Double room: price per night". */
        title: z.ZodString;
        /** The value the card shows as current, formatted for people. */
        current: z.ZodString;
        /** The value approval would set, formatted for people. */
        proposed: z.ZodString;
        state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
        expiresAt: z.ZodString;
        /** Why it failed or could not be approved, when it did not execute. */
        error: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }, {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }>, "many">;
    /**
     * Set when this answer offers human support (ADR-061 D-l): the surface
     * shows a "Send to Injishi support" button. The person sends it; the model
     * never does.
     */
    escalation: z.ZodNullable<z.ZodObject<{
        topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
    }, "strip", z.ZodTypeAny, {
        topic: "other" | "payment" | "booking" | "listing";
    }, {
        topic: "other" | "payment" | "booking" | "listing";
    }>>;
    /** Whether the person marked this answer helpful; null until they do. */
    helpful: z.ZodNullable<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "user" | "assistant";
    id: string;
    createdAt: string;
    text: string;
    sources: {
        kind: "listing" | "article" | "task" | "tutorial" | "record";
        id: string;
        title: string;
        href: string | null;
        listing?: {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        } | undefined;
    }[];
    proposals: {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }[];
    escalation: {
        topic: "other" | "payment" | "booking" | "listing";
    } | null;
    helpful: boolean | null;
}, {
    role: "user" | "assistant";
    id: string;
    createdAt: string;
    text: string;
    sources: {
        kind: "listing" | "article" | "task" | "tutorial" | "record";
        id: string;
        title: string;
        href: string | null;
        listing?: {
            district: string | null;
            fromNightlyRateRwf: number | null;
            maxGuests: number | null;
            roomTypes: number;
            photoUrl: string | null;
        } | undefined;
    }[];
    proposals: {
        kind: "room_type.price";
        id: string;
        current: string;
        title: string;
        state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
        proposed: string;
        expiresAt: string;
        error: string | null;
    }[];
    escalation: {
        topic: "other" | "payment" | "booking" | "listing";
    } | null;
    helpful: boolean | null;
}>;
export type AssistantMessage = z.infer<typeof AssistantMessage>;
export declare const AssistantConversation: z.ZodObject<{
    id: z.ZodString;
    surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
    /** True while no account owns it (ADR-061 D-c). */
    anonymous: z.ZodBoolean;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<["user", "assistant"]>;
        text: z.ZodString;
        sources: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
            id: z.ZodString;
            title: z.ZodString;
            /** A path on the surface that opens it, or null when there is none. */
            href: z.ZodNullable<z.ZodString>;
            /**
             * A listing's card details, when the source is a published property: what
             * a surface draws on its card. Absent on other kinds and on answers stored
             * before cards existed.
             */
            listing: z.ZodOptional<z.ZodObject<{
                district: z.ZodNullable<z.ZodString>;
                /** The lowest base nightly rate, before any date specific price. */
                fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
                maxGuests: z.ZodNullable<z.ZodNumber>;
                roomTypes: z.ZodNumber;
                /** The cover photo's URL, or null when the property has none. */
                photoUrl: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            }, {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            }>>;
        }, "strip", z.ZodTypeAny, {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }, {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }>, "many">;
        /** Changes this answer prepared, each awaiting the person's own approval. */
        proposals: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["room_type.price"]>;
            /** What changes, e.g. "Double room: price per night". */
            title: z.ZodString;
            /** The value the card shows as current, formatted for people. */
            current: z.ZodString;
            /** The value approval would set, formatted for people. */
            proposed: z.ZodString;
            state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
            expiresAt: z.ZodString;
            /** Why it failed or could not be approved, when it did not execute. */
            error: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }, {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }>, "many">;
        /**
         * Set when this answer offers human support (ADR-061 D-l): the surface
         * shows a "Send to Injishi support" button. The person sends it; the model
         * never does.
         */
        escalation: z.ZodNullable<z.ZodObject<{
            topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
        }, "strip", z.ZodTypeAny, {
            topic: "other" | "payment" | "booking" | "listing";
        }, {
            topic: "other" | "payment" | "booking" | "listing";
        }>>;
        /** Whether the person marked this answer helpful; null until they do. */
        helpful: z.ZodNullable<z.ZodBoolean>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        id: string;
        createdAt: string;
        text: string;
        sources: {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }[];
        proposals: {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }[];
        escalation: {
            topic: "other" | "payment" | "booking" | "listing";
        } | null;
        helpful: boolean | null;
    }, {
        role: "user" | "assistant";
        id: string;
        createdAt: string;
        text: string;
        sources: {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }[];
        proposals: {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }[];
        escalation: {
            topic: "other" | "payment" | "booking" | "listing";
        } | null;
        helpful: boolean | null;
    }>, "many">;
    /** User turns left before the conversation is full. */
    turnsLeft: z.ZodNumber;
    /** When it is deleted if nothing more is said (ADR-061 D-d). */
    expiresAt: z.ZodString;
    /** What the person may want to ask next, after the latest answer. */
    suggestions: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        label: string;
    }, {
        message: string;
        label: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    surface: "admin" | "web" | "app" | "mobile";
    expiresAt: string;
    anonymous: boolean;
    messages: {
        role: "user" | "assistant";
        id: string;
        createdAt: string;
        text: string;
        sources: {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }[];
        proposals: {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }[];
        escalation: {
            topic: "other" | "payment" | "booking" | "listing";
        } | null;
        helpful: boolean | null;
    }[];
    turnsLeft: number;
    suggestions: {
        message: string;
        label: string;
    }[];
}, {
    id: string;
    surface: "admin" | "web" | "app" | "mobile";
    expiresAt: string;
    anonymous: boolean;
    messages: {
        role: "user" | "assistant";
        id: string;
        createdAt: string;
        text: string;
        sources: {
            kind: "listing" | "article" | "task" | "tutorial" | "record";
            id: string;
            title: string;
            href: string | null;
            listing?: {
                district: string | null;
                fromNightlyRateRwf: number | null;
                maxGuests: number | null;
                roomTypes: number;
                photoUrl: string | null;
            } | undefined;
        }[];
        proposals: {
            kind: "room_type.price";
            id: string;
            current: string;
            title: string;
            state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
            proposed: string;
            expiresAt: string;
            error: string | null;
        }[];
        escalation: {
            topic: "other" | "payment" | "booking" | "listing";
        } | null;
        helpful: boolean | null;
    }[];
    turnsLeft: number;
    suggestions: {
        message: string;
        label: string;
    }[];
}>;
export type AssistantConversation = z.infer<typeof AssistantConversation>;
/** `POST /api/v1/assistant/messages`: the conversation as it now stands. */
export declare const SendAssistantMessageResult: z.ZodObject<{
    conversation: z.ZodObject<{
        id: z.ZodString;
        surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
        /** True while no account owns it (ADR-061 D-c). */
        anonymous: z.ZodBoolean;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<["user", "assistant"]>;
            text: z.ZodString;
            sources: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
                id: z.ZodString;
                title: z.ZodString;
                /** A path on the surface that opens it, or null when there is none. */
                href: z.ZodNullable<z.ZodString>;
                /**
                 * A listing's card details, when the source is a published property: what
                 * a surface draws on its card. Absent on other kinds and on answers stored
                 * before cards existed.
                 */
                listing: z.ZodOptional<z.ZodObject<{
                    district: z.ZodNullable<z.ZodString>;
                    /** The lowest base nightly rate, before any date specific price. */
                    fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
                    maxGuests: z.ZodNullable<z.ZodNumber>;
                    roomTypes: z.ZodNumber;
                    /** The cover photo's URL, or null when the property has none. */
                    photoUrl: z.ZodNullable<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }>>;
            }, "strip", z.ZodTypeAny, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }>, "many">;
            /** Changes this answer prepared, each awaiting the person's own approval. */
            proposals: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                kind: z.ZodEnum<["room_type.price"]>;
                /** What changes, e.g. "Double room: price per night". */
                title: z.ZodString;
                /** The value the card shows as current, formatted for people. */
                current: z.ZodString;
                /** The value approval would set, formatted for people. */
                proposed: z.ZodString;
                state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
                expiresAt: z.ZodString;
                /** Why it failed or could not be approved, when it did not execute. */
                error: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }>, "many">;
            /**
             * Set when this answer offers human support (ADR-061 D-l): the surface
             * shows a "Send to Injishi support" button. The person sends it; the model
             * never does.
             */
            escalation: z.ZodNullable<z.ZodObject<{
                topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
            }, "strip", z.ZodTypeAny, {
                topic: "other" | "payment" | "booking" | "listing";
            }, {
                topic: "other" | "payment" | "booking" | "listing";
            }>>;
            /** Whether the person marked this answer helpful; null until they do. */
            helpful: z.ZodNullable<z.ZodBoolean>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }>, "many">;
        /** User turns left before the conversation is full. */
        turnsLeft: z.ZodNumber;
        /** When it is deleted if nothing more is said (ADR-061 D-d). */
        expiresAt: z.ZodString;
        /** What the person may want to ask next, after the latest answer. */
        suggestions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            label: string;
        }, {
            message: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }>;
    /**
     * The anonymous token of a conversation this request STARTED, returned only
     * to a native client (`x-assistant-client: native`, ADR-061 D-c), which keeps
     * it in the keychain and sends it back as `x-assistant-token`. A web page
     * never receives it: there it rides in the `HttpOnly` cookie.
     */
    anonToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    };
    anonToken?: string | undefined;
}, {
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    };
    anonToken?: string | undefined;
}>;
export type SendAssistantMessageResult = z.infer<typeof SendAssistantMessageResult>;
/**
 * `GET /api/v1/assistant/conversations/current`. `enabled` is false when the
 * API runs with the assistant off, and a surface then draws no entry point.
 */
export declare const AssistantCurrentConversation: z.ZodObject<{
    enabled: z.ZodBoolean;
    conversation: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
        /** True while no account owns it (ADR-061 D-c). */
        anonymous: z.ZodBoolean;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<["user", "assistant"]>;
            text: z.ZodString;
            sources: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
                id: z.ZodString;
                title: z.ZodString;
                /** A path on the surface that opens it, or null when there is none. */
                href: z.ZodNullable<z.ZodString>;
                /**
                 * A listing's card details, when the source is a published property: what
                 * a surface draws on its card. Absent on other kinds and on answers stored
                 * before cards existed.
                 */
                listing: z.ZodOptional<z.ZodObject<{
                    district: z.ZodNullable<z.ZodString>;
                    /** The lowest base nightly rate, before any date specific price. */
                    fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
                    maxGuests: z.ZodNullable<z.ZodNumber>;
                    roomTypes: z.ZodNumber;
                    /** The cover photo's URL, or null when the property has none. */
                    photoUrl: z.ZodNullable<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }>>;
            }, "strip", z.ZodTypeAny, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }>, "many">;
            /** Changes this answer prepared, each awaiting the person's own approval. */
            proposals: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                kind: z.ZodEnum<["room_type.price"]>;
                /** What changes, e.g. "Double room: price per night". */
                title: z.ZodString;
                /** The value the card shows as current, formatted for people. */
                current: z.ZodString;
                /** The value approval would set, formatted for people. */
                proposed: z.ZodString;
                state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
                expiresAt: z.ZodString;
                /** Why it failed or could not be approved, when it did not execute. */
                error: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }>, "many">;
            /**
             * Set when this answer offers human support (ADR-061 D-l): the surface
             * shows a "Send to Injishi support" button. The person sends it; the model
             * never does.
             */
            escalation: z.ZodNullable<z.ZodObject<{
                topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
            }, "strip", z.ZodTypeAny, {
                topic: "other" | "payment" | "booking" | "listing";
            }, {
                topic: "other" | "payment" | "booking" | "listing";
            }>>;
            /** Whether the person marked this answer helpful; null until they do. */
            helpful: z.ZodNullable<z.ZodBoolean>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }>, "many">;
        /** User turns left before the conversation is full. */
        turnsLeft: z.ZodNumber;
        /** When it is deleted if nothing more is said (ADR-061 D-d). */
        expiresAt: z.ZodString;
        /** What the person may want to ask next, after the latest answer. */
        suggestions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            label: string;
        }, {
            message: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }>>;
    /**
     * True when a signed in caller still carries an anonymous conversation that
     * can be attached to their account (ADR-061 D-e). The surface then calls
     * `POST /api/v1/assistant/conversations/claim`.
     */
    claimable: z.ZodBoolean;
    /**
     * How the assistant opens a new conversation for this caller and surface,
     * and the questions it offers first: the kinds asked most, among what this
     * caller may ask. Shown when there is no conversation, or after "New
     * conversation".
     */
    greeting: z.ZodString;
    suggestions: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        label: string;
    }, {
        message: string;
        label: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    suggestions: {
        message: string;
        label: string;
    }[];
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    } | null;
    enabled: boolean;
    claimable: boolean;
    greeting: string;
}, {
    suggestions: {
        message: string;
        label: string;
    }[];
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    } | null;
    enabled: boolean;
    claimable: boolean;
    greeting: string;
}>;
export type AssistantCurrentConversation = z.infer<typeof AssistantCurrentConversation>;
/**
 * `POST /api/v1/assistant/conversations/claim`. `claimed` is false when there
 * was nothing to attach: no cookie, an expired conversation, or one that
 * already belongs to an account. Either way the anonymous cookie is cleared.
 */
export declare const ClaimAssistantConversationInput: z.ZodObject<{
    surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
    discard: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    surface: "admin" | "web" | "app" | "mobile";
    discard?: boolean | undefined;
}, {
    surface: "admin" | "web" | "app" | "mobile";
    discard?: boolean | undefined;
}>;
export type ClaimAssistantConversationInput = z.infer<typeof ClaimAssistantConversationInput>;
export declare const ClaimAssistantConversationResult: z.ZodObject<{
    claimed: z.ZodBoolean;
    conversation: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
        /** True while no account owns it (ADR-061 D-c). */
        anonymous: z.ZodBoolean;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<["user", "assistant"]>;
            text: z.ZodString;
            sources: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<["article", "task", "tutorial", "listing", "record"]>;
                id: z.ZodString;
                title: z.ZodString;
                /** A path on the surface that opens it, or null when there is none. */
                href: z.ZodNullable<z.ZodString>;
                /**
                 * A listing's card details, when the source is a published property: what
                 * a surface draws on its card. Absent on other kinds and on answers stored
                 * before cards existed.
                 */
                listing: z.ZodOptional<z.ZodObject<{
                    district: z.ZodNullable<z.ZodString>;
                    /** The lowest base nightly rate, before any date specific price. */
                    fromNightlyRateRwf: z.ZodNullable<z.ZodNumber>;
                    maxGuests: z.ZodNullable<z.ZodNumber>;
                    roomTypes: z.ZodNumber;
                    /** The cover photo's URL, or null when the property has none. */
                    photoUrl: z.ZodNullable<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }, {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                }>>;
            }, "strip", z.ZodTypeAny, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }, {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }>, "many">;
            /** Changes this answer prepared, each awaiting the person's own approval. */
            proposals: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                kind: z.ZodEnum<["room_type.price"]>;
                /** What changes, e.g. "Double room: price per night". */
                title: z.ZodString;
                /** The value the card shows as current, formatted for people. */
                current: z.ZodString;
                /** The value approval would set, formatted for people. */
                proposed: z.ZodString;
                state: z.ZodEnum<["proposed", "approved", "executed", "failed", "rejected", "expired"]>;
                expiresAt: z.ZodString;
                /** Why it failed or could not be approved, when it did not execute. */
                error: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }, {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }>, "many">;
            /**
             * Set when this answer offers human support (ADR-061 D-l): the surface
             * shows a "Send to Injishi support" button. The person sends it; the model
             * never does.
             */
            escalation: z.ZodNullable<z.ZodObject<{
                topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
            }, "strip", z.ZodTypeAny, {
                topic: "other" | "payment" | "booking" | "listing";
            }, {
                topic: "other" | "payment" | "booking" | "listing";
            }>>;
            /** Whether the person marked this answer helpful; null until they do. */
            helpful: z.ZodNullable<z.ZodBoolean>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }, {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }>, "many">;
        /** User turns left before the conversation is full. */
        turnsLeft: z.ZodNumber;
        /** When it is deleted if nothing more is said (ADR-061 D-d). */
        expiresAt: z.ZodString;
        /** What the person may want to ask next, after the latest answer. */
        suggestions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            label: string;
        }, {
            message: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }, {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    }>>;
}, "strip", z.ZodTypeAny, {
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    } | null;
    claimed: boolean;
}, {
    conversation: {
        id: string;
        surface: "admin" | "web" | "app" | "mobile";
        expiresAt: string;
        anonymous: boolean;
        messages: {
            role: "user" | "assistant";
            id: string;
            createdAt: string;
            text: string;
            sources: {
                kind: "listing" | "article" | "task" | "tutorial" | "record";
                id: string;
                title: string;
                href: string | null;
                listing?: {
                    district: string | null;
                    fromNightlyRateRwf: number | null;
                    maxGuests: number | null;
                    roomTypes: number;
                    photoUrl: string | null;
                } | undefined;
            }[];
            proposals: {
                kind: "room_type.price";
                id: string;
                current: string;
                title: string;
                state: "approved" | "rejected" | "failed" | "expired" | "proposed" | "executed";
                proposed: string;
                expiresAt: string;
                error: string | null;
            }[];
            escalation: {
                topic: "other" | "payment" | "booking" | "listing";
            } | null;
            helpful: boolean | null;
        }[];
        turnsLeft: number;
        suggestions: {
            message: string;
            label: string;
        }[];
    } | null;
    claimed: boolean;
}>;
export type ClaimAssistantConversationResult = z.infer<typeof ClaimAssistantConversationResult>;
/** The stable `code` on an assistant error body. */
export declare const AssistantErrorCode: z.ZodEnum<["assistant_off", "conversation_full", "conversation_busy", "model_unavailable", "proposal_closed", "proposal_expired", "proposal_stale"]>;
export type AssistantErrorCode = z.infer<typeof AssistantErrorCode>;
/**
 * `POST /api/v1/assistant/escalations`: the person sends their conversation
 * to Injishi support (ADR-061 D-l). A signed in requester comes from the
 * session; signed out, `email` is required, typed by the person, because the
 * model never sees or supplies an address. Throttled like the support intake.
 */
export declare const SendAssistantEscalationInput: z.ZodObject<{
    surface: z.ZodEnum<["web", "app", "admin", "mobile"]>;
    topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
    email: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    topic: "other" | "payment" | "booking" | "listing";
    surface: "admin" | "web" | "app" | "mobile";
    name?: string | undefined;
    email?: string | undefined;
}, {
    topic: "other" | "payment" | "booking" | "listing";
    surface: "admin" | "web" | "app" | "mobile";
    name?: string | undefined;
    email?: string | undefined;
}>;
export type SendAssistantEscalationInput = z.infer<typeof SendAssistantEscalationInput>;
export declare const SendAssistantEscalationResult: z.ZodObject<{
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
}, {
    ticketId: string;
}>;
export type SendAssistantEscalationResult = z.infer<typeof SendAssistantEscalationResult>;
/** `POST /api/v1/assistant/messages/:id/feedback` (ADR-061 D-m). */
export declare const AssistantFeedbackInput: z.ZodObject<{
    helpful: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    helpful: boolean;
}, {
    helpful: boolean;
}>;
export type AssistantFeedbackInput = z.infer<typeof AssistantFeedbackInput>;
export declare const AssistantFeedbackResult: z.ZodObject<{
    messageId: z.ZodString;
    helpful: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    helpful: boolean;
    messageId: string;
}, {
    helpful: boolean;
    messageId: string;
}>;
export type AssistantFeedbackResult = z.infer<typeof AssistantFeedbackResult>;
/**
 * `GET /api/v1/admin/assistant/usage?month=YYYY-MM` (ADR-061 D-s), staff with
 * `admin.analytics.view`. A month is a UTC calendar month; unset means the
 * current one. Aggregates only: no person, conversation or text is returned.
 */
export declare const AssistantUsageMonth: z.ZodString;
export declare const AssistantUsageQuery: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    month?: string | undefined;
}, {
    month?: string | undefined;
}>;
export type AssistantUsageQuery = z.infer<typeof AssistantUsageQuery>;
export declare const AssistantCallerRole: z.ZodEnum<["anonymous", "signed_in", "operator", "staff"]>;
export type AssistantCallerRole = z.infer<typeof AssistantCallerRole>;
export declare const AssistantUsageReport: z.ZodObject<{
    month: z.ZodString;
    /** The month's first instant and the next month's, ISO 8601 in UTC. */
    from: z.ZodString;
    to: z.ZodString;
    /** US dollars per million tokens, as configured when the report was read. */
    prices: z.ZodObject<{
        inputPerMTokUsd: z.ZodNumber;
        outputPerMTokUsd: z.ZodNumber;
        cacheReadPerMTokUsd: z.ZodNumber;
        cacheWritePerMTokUsd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inputPerMTokUsd: number;
        outputPerMTokUsd: number;
        cacheReadPerMTokUsd: number;
        cacheWritePerMTokUsd: number;
    }, {
        inputPerMTokUsd: number;
        outputPerMTokUsd: number;
        cacheReadPerMTokUsd: number;
        cacheWritePerMTokUsd: number;
    }>;
    modelRequests: z.ZodNumber;
    tokens: z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    }, {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    }>;
    /** Each call priced when it was made, summed; an estimate, not an invoice. */
    estimatedCostUsd: z.ZodNumber;
    /** Stored answers by how they were produced (D-q, D-u). */
    answers: z.ZodObject<{
        direct: z.ZodNumber;
        ai: z.ZodNumber;
        fallback: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        direct: number;
        ai: number;
        fallback: number;
    }, {
        total: number;
        direct: number;
        ai: number;
        fallback: number;
    }>;
    /** Every user turn, one row each (D-s, D-x, D-y). */
    turns: z.ZodObject<{
        total: z.ZodNumber;
        /** How turns ended; `failed` stored nothing; `truncated` hit the output ceiling. */
        byOutcome: z.ZodObject<{
            answered: z.ZodNumber;
            fallback: z.ZodNumber;
            withheld: z.ZodNumber;
            truncated: z.ZodNumber;
            out_of_time: z.ZodNumber;
            step_limit: z.ZodNumber;
            refused: z.ZodNumber;
            failed: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        }, {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        }>;
        /** Model answered turns by the calls they took: one is the norm (D-x). */
        modelCallsPerModelTurn: z.ZodObject<{
            one: z.ZodNumber;
            two: z.ZodNumber;
            threeOrMore: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            one: number;
            two: number;
            threeOrMore: number;
        }, {
            one: number;
            two: number;
            threeOrMore: number;
        }>;
        /** Model answered turns where the gathered data was enough: candidates for a router rule. */
        modelTurnsWithoutOwnToolCalls: z.ZodNumber;
        tools: z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            runs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            tool: string;
            runs: number;
        }, {
            tool: string;
            runs: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        total: number;
        byOutcome: {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        };
        modelCallsPerModelTurn: {
            one: number;
            two: number;
            threeOrMore: number;
        };
        modelTurnsWithoutOwnToolCalls: number;
        tools: {
            tool: string;
            runs: number;
        }[];
    }, {
        total: number;
        byOutcome: {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        };
        modelCallsPerModelTurn: {
            one: number;
            two: number;
            threeOrMore: number;
        };
        modelTurnsWithoutOwnToolCalls: number;
        tools: {
            tool: string;
            runs: number;
        }[];
    }>;
    byRequestType: z.ZodArray<z.ZodObject<{
        modelRequests: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    } & {
        requestType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        requestType: string;
        modelRequests: number;
        estimatedCostUsd: number;
    }, {
        requestType: string;
        modelRequests: number;
        estimatedCostUsd: number;
    }>, "many">;
    byCallerRole: z.ZodArray<z.ZodObject<{
        modelRequests: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    } & {
        callerRole: z.ZodEnum<["anonymous", "signed_in", "operator", "staff"]>;
    }, "strip", z.ZodTypeAny, {
        modelRequests: number;
        estimatedCostUsd: number;
        callerRole: "anonymous" | "signed_in" | "operator" | "staff";
    }, {
        modelRequests: number;
        estimatedCostUsd: number;
        callerRole: "anonymous" | "signed_in" | "operator" | "staff";
    }>, "many">;
    byModel: z.ZodArray<z.ZodObject<{
        modelRequests: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    } & {
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        modelRequests: number;
        estimatedCostUsd: number;
        model: string;
    }, {
        modelRequests: number;
        estimatedCostUsd: number;
        model: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    from: string;
    month: string;
    modelRequests: number;
    estimatedCostUsd: number;
    to: string;
    prices: {
        inputPerMTokUsd: number;
        outputPerMTokUsd: number;
        cacheReadPerMTokUsd: number;
        cacheWritePerMTokUsd: number;
    };
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    answers: {
        total: number;
        direct: number;
        ai: number;
        fallback: number;
    };
    turns: {
        total: number;
        byOutcome: {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        };
        modelCallsPerModelTurn: {
            one: number;
            two: number;
            threeOrMore: number;
        };
        modelTurnsWithoutOwnToolCalls: number;
        tools: {
            tool: string;
            runs: number;
        }[];
    };
    byRequestType: {
        requestType: string;
        modelRequests: number;
        estimatedCostUsd: number;
    }[];
    byCallerRole: {
        modelRequests: number;
        estimatedCostUsd: number;
        callerRole: "anonymous" | "signed_in" | "operator" | "staff";
    }[];
    byModel: {
        modelRequests: number;
        estimatedCostUsd: number;
        model: string;
    }[];
}, {
    from: string;
    month: string;
    modelRequests: number;
    estimatedCostUsd: number;
    to: string;
    prices: {
        inputPerMTokUsd: number;
        outputPerMTokUsd: number;
        cacheReadPerMTokUsd: number;
        cacheWritePerMTokUsd: number;
    };
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    answers: {
        total: number;
        direct: number;
        ai: number;
        fallback: number;
    };
    turns: {
        total: number;
        byOutcome: {
            failed: number;
            fallback: number;
            answered: number;
            withheld: number;
            truncated: number;
            out_of_time: number;
            step_limit: number;
            refused: number;
        };
        modelCallsPerModelTurn: {
            one: number;
            two: number;
            threeOrMore: number;
        };
        modelTurnsWithoutOwnToolCalls: number;
        tools: {
            tool: string;
            runs: number;
        }[];
    };
    byRequestType: {
        requestType: string;
        modelRequests: number;
        estimatedCostUsd: number;
    }[];
    byCallerRole: {
        modelRequests: number;
        estimatedCostUsd: number;
        callerRole: "anonymous" | "signed_in" | "operator" | "staff";
    }[];
    byModel: {
        modelRequests: number;
        estimatedCostUsd: number;
        model: string;
    }[];
}>;
export type AssistantUsageReport = z.infer<typeof AssistantUsageReport>;
//# sourceMappingURL=assistant.d.ts.map