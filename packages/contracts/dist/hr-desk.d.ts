import { z } from "zod";
/**
 * The staff help desk and the things a business lends its staff (058-staff-services).
 *
 * A person asks HR or IT a question from Me or the staff phone; HR answers in the same thread and
 * closes it. Keys, uniforms, phones and tools a person signs out are recorded against them until
 * they come back, so a leaver's last day can list what is still out.
 */
export declare const HrTicketTopic: z.ZodEnum<["pay", "leave", "documents", "uniform", "it", "other"]>;
export type HrTicketTopic = z.infer<typeof HrTicketTopic>;
export declare const HrTicketStatus: z.ZodEnum<["open", "answered", "closed"]>;
export type HrTicketStatus = z.infer<typeof HrTicketStatus>;
export declare const HrTicketMessage: z.ZodObject<{
    id: z.ZodString;
    /** The person who asked, or HR answering. */
    fromStaff: z.ZodBoolean;
    authorName: z.ZodNullable<z.ZodString>;
    body: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    authorName: string | null;
    body: string;
    fromStaff: boolean;
}, {
    id: string;
    createdAt: string;
    authorName: string | null;
    body: string;
    fromStaff: boolean;
}>;
export type HrTicketMessage = z.infer<typeof HrTicketMessage>;
export declare const HrTicket: z.ZodObject<{
    id: z.ZodString;
    /** "HD-0007": what a person quotes when they ask about it. */
    reference: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    topic: z.ZodEnum<["pay", "leave", "documents", "uniform", "it", "other"]>;
    subject: z.ZodString;
    status: z.ZodEnum<["open", "answered", "closed"]>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The person who asked, or HR answering. */
        fromStaff: z.ZodBoolean;
        authorName: z.ZodNullable<z.ZodString>;
        body: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fromStaff: boolean;
    }, {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fromStaff: boolean;
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "answered";
    id: string;
    reference: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    updatedAt: string;
    topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
    messages: {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fromStaff: boolean;
    }[];
    closedAt: string | null;
    subject: string;
}, {
    status: "open" | "closed" | "answered";
    id: string;
    reference: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    updatedAt: string;
    topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
    messages: {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fromStaff: boolean;
    }[];
    closedAt: string | null;
    subject: string;
}>;
export type HrTicket = z.infer<typeof HrTicket>;
export declare const HrTicketList: z.ZodObject<{
    tickets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** "HD-0007": what a person quotes when they ask about it. */
        reference: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
            displayName: z.ZodString;
            jobPositionTitle: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }>;
        topic: z.ZodEnum<["pay", "leave", "documents", "uniform", "it", "other"]>;
        subject: z.ZodString;
        status: z.ZodEnum<["open", "answered", "closed"]>;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            /** The person who asked, or HR answering. */
            fromStaff: z.ZodBoolean;
            authorName: z.ZodNullable<z.ZodString>;
            body: z.ZodString;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }, {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed" | "answered";
        id: string;
        reference: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        updatedAt: string;
        topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
        messages: {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }[];
        closedAt: string | null;
        subject: string;
    }, {
        status: "open" | "closed" | "answered";
        id: string;
        reference: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        updatedAt: string;
        topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
        messages: {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }[];
        closedAt: string | null;
        subject: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tickets: {
        status: "open" | "closed" | "answered";
        id: string;
        reference: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        updatedAt: string;
        topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
        messages: {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }[];
        closedAt: string | null;
        subject: string;
    }[];
}, {
    tickets: {
        status: "open" | "closed" | "answered";
        id: string;
        reference: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        updatedAt: string;
        topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
        messages: {
            id: string;
            createdAt: string;
            authorName: string | null;
            body: string;
            fromStaff: boolean;
        }[];
        closedAt: string | null;
        subject: string;
    }[];
}>;
export type HrTicketList = z.infer<typeof HrTicketList>;
/** `POST /me/work/:employeeId/tickets`. */
export declare const CreateHrTicketRequest: z.ZodObject<{
    topic: z.ZodEnum<["pay", "leave", "documents", "uniform", "it", "other"]>;
    subject: z.ZodString;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
    topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
    subject: string;
}, {
    body: string;
    topic: "other" | "documents" | "pay" | "it" | "leave" | "uniform";
    subject: string;
}>;
export type CreateHrTicketRequest = z.infer<typeof CreateHrTicketRequest>;
/** `POST /me/work/:employeeId/tickets/:id/messages` and `POST /ops/hr-tickets/:id/reply`. */
export declare const ReplyHrTicketRequest: z.ZodObject<{
    body: z.ZodString;
    /** HR only: close the ticket with this answer. */
    close: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    body: string;
    close?: boolean | undefined;
}, {
    body: string;
    close?: boolean | undefined;
}>;
export type ReplyHrTicketRequest = z.infer<typeof ReplyHrTicketRequest>;
export declare const AssetKind: z.ZodEnum<["key", "uniform", "phone", "laptop", "tool", "other"]>;
export type AssetKind = z.infer<typeof AssetKind>;
export declare const AssetLoan: z.ZodObject<{
    id: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    /** Whether the person still works here: a leaver with something out is the reminder. */
    employeeActive: z.ZodBoolean;
    kind: z.ZodEnum<["key", "uniform", "phone", "laptop", "tool", "other"]>;
    name: z.ZodString;
    /** A serial or asset number. */
    tag: z.ZodNullable<z.ZodString>;
    issuedOn: z.ZodString;
    dueBackOn: z.ZodNullable<z.ZodString>;
    returnedOn: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    issuedByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    employeeActive: boolean;
    tag: string | null;
    dueBackOn: string | null;
    returnedOn: string | null;
    issuedByName: string | null;
}, {
    name: string;
    id: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    employeeActive: boolean;
    tag: string | null;
    dueBackOn: string | null;
    returnedOn: string | null;
    issuedByName: string | null;
}>;
export type AssetLoan = z.infer<typeof AssetLoan>;
export declare const AssetLoanList: z.ZodObject<{
    loans: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
            displayName: z.ZodString;
            jobPositionTitle: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }, {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        }>;
        /** Whether the person still works here: a leaver with something out is the reminder. */
        employeeActive: z.ZodBoolean;
        kind: z.ZodEnum<["key", "uniform", "phone", "laptop", "tool", "other"]>;
        name: z.ZodString;
        /** A serial or asset number. */
        tag: z.ZodNullable<z.ZodString>;
        issuedOn: z.ZodString;
        dueBackOn: z.ZodNullable<z.ZodString>;
        returnedOn: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        issuedByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
        issuedOn: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        employeeActive: boolean;
        tag: string | null;
        dueBackOn: string | null;
        returnedOn: string | null;
        issuedByName: string | null;
    }, {
        name: string;
        id: string;
        kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
        issuedOn: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        employeeActive: boolean;
        tag: string | null;
        dueBackOn: string | null;
        returnedOn: string | null;
        issuedByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    loans: {
        name: string;
        id: string;
        kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
        issuedOn: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        employeeActive: boolean;
        tag: string | null;
        dueBackOn: string | null;
        returnedOn: string | null;
        issuedByName: string | null;
    }[];
}, {
    loans: {
        name: string;
        id: string;
        kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
        issuedOn: string;
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        employeeActive: boolean;
        tag: string | null;
        dueBackOn: string | null;
        returnedOn: string | null;
        issuedByName: string | null;
    }[];
}>;
export type AssetLoanList = z.infer<typeof AssetLoanList>;
/** `POST /ops/asset-loans`. */
export declare const CreateAssetLoanRequest: z.ZodEffects<z.ZodObject<{
    employeeId: z.ZodString;
    kind: z.ZodEnum<["key", "uniform", "phone", "laptop", "tool", "other"]>;
    name: z.ZodString;
    tag: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    issuedOn: z.ZodString;
    dueBackOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    employeeId: string;
    note?: string | null | undefined;
    tag?: string | null | undefined;
    dueBackOn?: string | null | undefined;
}, {
    name: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    employeeId: string;
    note?: string | null | undefined;
    tag?: string | null | undefined;
    dueBackOn?: string | null | undefined;
}>, {
    name: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    employeeId: string;
    note?: string | null | undefined;
    tag?: string | null | undefined;
    dueBackOn?: string | null | undefined;
}, {
    name: string;
    kind: "other" | "key" | "phone" | "tool" | "uniform" | "laptop";
    issuedOn: string;
    employeeId: string;
    note?: string | null | undefined;
    tag?: string | null | undefined;
    dueBackOn?: string | null | undefined;
}>;
export type CreateAssetLoanRequest = z.infer<typeof CreateAssetLoanRequest>;
/** `POST /ops/asset-loans/:id/return`. */
export declare const ReturnAssetLoanRequest: z.ZodObject<{
    returnedOn: z.ZodString;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    returnedOn: string;
    note?: string | null | undefined;
}, {
    returnedOn: string;
    note?: string | null | undefined;
}>;
export type ReturnAssetLoanRequest = z.infer<typeof ReturnAssetLoanRequest>;
//# sourceMappingURL=hr-desk.d.ts.map