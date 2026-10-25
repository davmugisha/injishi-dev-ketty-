import { z } from "zod";
/** Longest message accepted. */
export declare const LEASE_MESSAGE_MAX_CHARS = 4000;
/** The most files one message carries. */
export declare const LEASE_MESSAGE_FILES_MAX = 10;
/** A photo, before it is fitted and re-encoded. */
export declare const LEASE_MESSAGE_IMAGE_MAX_BYTES: number;
/** A document (a receipt, a scanned contract). */
export declare const LEASE_MESSAGE_FILE_MAX_BYTES: number;
/** The longest voice note, in seconds (the database holds it to this too). */
export declare const VOICE_NOTE_MAX_S = 120;
/** A voice note's size: two minutes of speech is well under 2 MB in any browser's codec. */
export declare const VOICE_NOTE_MAX_BYTES: number;
/** Minutes a message waits unread before its reader is emailed. */
export declare const MESSAGE_DIGEST_DELAY_MIN = 5;
/** Minutes between two digests to the same reader for the same conversation. */
export declare const MESSAGE_DIGEST_COOLDOWN_MIN = 30;
/** A page of a conversation. */
export declare const LEASE_MESSAGE_PAGE = 50;
/** Photos a message may carry: the bytes are checked, not the name. */
export declare const MESSAGE_IMAGE_MIMES: readonly ["image/jpeg", "image/png", "image/webp"];
/** Documents a message may carry. */
export declare const MESSAGE_DOCUMENT_MIMES: readonly ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv"];
/** Voice notes, as browsers record them: Chrome and Firefox WebM or Ogg Opus, Safari MP4 (AAC). */
export declare const MESSAGE_AUDIO_MIMES: readonly ["audio/webm", "audio/ogg", "audio/mp4"];
/** What the composer's file picker offers. */
export declare const MESSAGE_ACCEPT: string;
export type MessageFileKind = "image" | "file" | "audio";
/**
 * How a file is drawn, from its type: a photo, a document card, or a voice
 * player. Null for a type a message may not carry.
 */
export declare function messageFileKind(mime: string): MessageFileKind | null;
/** The largest a file of this kind may be. */
export declare function messageFileMaxBytes(kind: MessageFileKind): number;
/**
 * What is wrong with a message's files, in words, or null. The same rule the
 * composer checks before it sends and the API checks again: up to ten files,
 * each of a known type and size, and at most one voice note, which travels
 * alone (no photos or documents beside it) with its length.
 */
export declare function messageFilesProblem(files: readonly {
    mime: string;
    sizeBytes: number;
    name?: string;
}[], voiceDurationS?: number | null): string | null;
/** The text fields of a message (the files ride beside them in the form). */
export declare const SendLeaseMessageFields: z.ZodObject<{
    body: z.ZodOptional<z.ZodString>;
    voiceDurationS: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    body?: string | undefined;
    voiceDurationS?: number | undefined;
}, {
    body?: string | undefined;
    voiceDurationS?: number | undefined;
}>;
export type SendLeaseMessageFields = z.infer<typeof SendLeaseMessageFields>;
/** Who wrote a line, as the reader sees it. */
export declare const MessageSide: z.ZodEnum<["landlord", "tenant", "system"]>;
export type MessageSide = z.infer<typeof MessageSide>;
/** One file on a message, behind a short-lived link. */
export declare const LeaseMessageAttachment: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["image", "file", "audio"]>;
    url: z.ZodString;
    mime: z.ZodString;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    filename: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "image" | "file" | "audio";
    id: string;
    mime: string;
    sizeBytes: number | null;
    url: string;
    filename: string | null;
}, {
    kind: "image" | "file" | "audio";
    id: string;
    mime: string;
    sizeBytes: number | null;
    url: string;
    filename: string | null;
}>;
export type LeaseMessageAttachment = z.infer<typeof LeaseMessageAttachment>;
/** The fault a line is about (a report or a reply on it), with where to open it. */
export declare const LeaseMessageFault: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    status: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    id: string;
    title: string;
    reference: string | null;
}, {
    status: string;
    id: string;
    title: string;
    reference: string | null;
}>;
export type LeaseMessageFault = z.infer<typeof LeaseMessageFault>;
export declare const LeaseMessage: z.ZodObject<{
    id: z.ZodString;
    side: z.ZodEnum<["landlord", "tenant", "system"]>;
    senderName: z.ZodNullable<z.ZodString>;
    fromMe: z.ZodBoolean;
    bodyType: z.ZodEnum<["text", "image", "voice", "system", "file"]>;
    body: z.ZodNullable<z.ZodString>;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["image", "file", "audio"]>;
        url: z.ZodString;
        mime: z.ZodString;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        filename: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "image" | "file" | "audio";
        id: string;
        mime: string;
        sizeBytes: number | null;
        url: string;
        filename: string | null;
    }, {
        kind: "image" | "file" | "audio";
        id: string;
        mime: string;
        sizeBytes: number | null;
        url: string;
        filename: string | null;
    }>, "many">;
    voiceDurationS: z.ZodNullable<z.ZodNumber>;
    fault: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        title: string;
        reference: string | null;
    }, {
        status: string;
        id: string;
        title: string;
        reference: string | null;
    }>>;
    createdAt: z.ZodString;
    /**
     * For the reader's own lines: `read` once the other side has opened the
     * conversation after it, else `delivered`. Null on the other side's lines.
     */
    receipt: z.ZodNullable<z.ZodEnum<["delivered", "read"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    body: string | null;
    senderName: string | null;
    bodyType: "text" | "image" | "voice" | "system" | "file";
    voiceDurationS: number | null;
    side: "landlord" | "tenant" | "system";
    fromMe: boolean;
    attachments: {
        kind: "image" | "file" | "audio";
        id: string;
        mime: string;
        sizeBytes: number | null;
        url: string;
        filename: string | null;
    }[];
    fault: {
        status: string;
        id: string;
        title: string;
        reference: string | null;
    } | null;
    receipt: "delivered" | "read" | null;
}, {
    id: string;
    createdAt: string;
    body: string | null;
    senderName: string | null;
    bodyType: "text" | "image" | "voice" | "system" | "file";
    voiceDurationS: number | null;
    side: "landlord" | "tenant" | "system";
    fromMe: boolean;
    attachments: {
        kind: "image" | "file" | "audio";
        id: string;
        mime: string;
        sizeBytes: number | null;
        url: string;
        filename: string | null;
    }[];
    fault: {
        status: string;
        id: string;
        title: string;
        reference: string | null;
    } | null;
    receipt: "delivered" | "read" | null;
}>;
export type LeaseMessage = z.infer<typeof LeaseMessage>;
/** A conversation as either side opens it: its lease, its people and a page of messages, oldest first. */
export declare const LeaseThreadView: z.ZodObject<{
    leaseId: z.ZodString;
    threadId: z.ZodNullable<z.ZodString>;
    reference: z.ZodString;
    leaseStatus: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    /** The other side: the tenant's name for the landlord, the business's for the tenant. */
    counterpartName: z.ZodString;
    /** Writable while the lease is live; read only once it ended or was cancelled. */
    writable: z.ZodBoolean;
    /** When this reader last opened it before now (the unread divider sits after it). */
    myLastReadAt: z.ZodNullable<z.ZodString>;
    /** When the other side last opened it (read receipts). */
    otherLastReadAt: z.ZodNullable<z.ZodString>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        side: z.ZodEnum<["landlord", "tenant", "system"]>;
        senderName: z.ZodNullable<z.ZodString>;
        fromMe: z.ZodBoolean;
        bodyType: z.ZodEnum<["text", "image", "voice", "system", "file"]>;
        body: z.ZodNullable<z.ZodString>;
        attachments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["image", "file", "audio"]>;
            url: z.ZodString;
            mime: z.ZodString;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            filename: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }, {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }>, "many">;
        voiceDurationS: z.ZodNullable<z.ZodNumber>;
        fault: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodNullable<z.ZodString>;
            title: z.ZodString;
            status: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        }, {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        }>>;
        createdAt: z.ZodString;
        /**
         * For the reader's own lines: `read` once the other side has opened the
         * conversation after it, else `delivered`. Null on the other side's lines.
         */
        receipt: z.ZodNullable<z.ZodEnum<["delivered", "read"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        body: string | null;
        senderName: string | null;
        bodyType: "text" | "image" | "voice" | "system" | "file";
        voiceDurationS: number | null;
        side: "landlord" | "tenant" | "system";
        fromMe: boolean;
        attachments: {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }[];
        fault: {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        } | null;
        receipt: "delivered" | "read" | null;
    }, {
        id: string;
        createdAt: string;
        body: string | null;
        senderName: string | null;
        bodyType: "text" | "image" | "voice" | "system" | "file";
        voiceDurationS: number | null;
        side: "landlord" | "tenant" | "system";
        fromMe: boolean;
        attachments: {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }[];
        fault: {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        } | null;
        receipt: "delivered" | "read" | null;
    }>, "many">;
    /** Older messages exist: pass this as `before` to read them. */
    olderCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reference: string;
    propertyName: string;
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        senderName: string | null;
        bodyType: "text" | "image" | "voice" | "system" | "file";
        voiceDurationS: number | null;
        side: "landlord" | "tenant" | "system";
        fromMe: boolean;
        attachments: {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }[];
        fault: {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        } | null;
        receipt: "delivered" | "read" | null;
    }[];
    counterpartName: string;
    threadId: string | null;
    leaseId: string;
    unitLabel: string;
    leaseStatus: string;
    writable: boolean;
    myLastReadAt: string | null;
    otherLastReadAt: string | null;
    olderCursor: string | null;
}, {
    reference: string;
    propertyName: string;
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        senderName: string | null;
        bodyType: "text" | "image" | "voice" | "system" | "file";
        voiceDurationS: number | null;
        side: "landlord" | "tenant" | "system";
        fromMe: boolean;
        attachments: {
            kind: "image" | "file" | "audio";
            id: string;
            mime: string;
            sizeBytes: number | null;
            url: string;
            filename: string | null;
        }[];
        fault: {
            status: string;
            id: string;
            title: string;
            reference: string | null;
        } | null;
        receipt: "delivered" | "read" | null;
    }[];
    counterpartName: string;
    threadId: string | null;
    leaseId: string;
    unitLabel: string;
    leaseStatus: string;
    writable: boolean;
    myLastReadAt: string | null;
    otherLastReadAt: string | null;
    olderCursor: string | null;
}>;
export type LeaseThreadView = z.infer<typeof LeaseThreadView>;
/** One row of the conversation list. */
export declare const LeaseThreadSummary: z.ZodObject<{
    leaseId: z.ZodString;
    threadId: z.ZodNullable<z.ZodString>;
    reference: z.ZodString;
    leaseStatus: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    counterpartName: z.ZodString;
    lastMessageAt: z.ZodNullable<z.ZodString>;
    lastMessagePreview: z.ZodNullable<z.ZodString>;
    lastMessageFromMe: z.ZodBoolean;
    unreadCount: z.ZodNumber;
    writable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    reference: string;
    propertyName: string;
    counterpartName: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    threadId: string | null;
    leaseId: string;
    unitLabel: string;
    leaseStatus: string;
    unreadCount: number;
    writable: boolean;
    lastMessageFromMe: boolean;
}, {
    reference: string;
    propertyName: string;
    counterpartName: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    threadId: string | null;
    leaseId: string;
    unitLabel: string;
    leaseStatus: string;
    unreadCount: number;
    writable: boolean;
    lastMessageFromMe: boolean;
}>;
export type LeaseThreadSummary = z.infer<typeof LeaseThreadSummary>;
export declare const LeaseThreadList: z.ZodObject<{
    threads: z.ZodArray<z.ZodObject<{
        leaseId: z.ZodString;
        threadId: z.ZodNullable<z.ZodString>;
        reference: z.ZodString;
        leaseStatus: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        counterpartName: z.ZodString;
        lastMessageAt: z.ZodNullable<z.ZodString>;
        lastMessagePreview: z.ZodNullable<z.ZodString>;
        lastMessageFromMe: z.ZodBoolean;
        unreadCount: z.ZodNumber;
        writable: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        propertyName: string;
        counterpartName: string;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        threadId: string | null;
        leaseId: string;
        unitLabel: string;
        leaseStatus: string;
        unreadCount: number;
        writable: boolean;
        lastMessageFromMe: boolean;
    }, {
        reference: string;
        propertyName: string;
        counterpartName: string;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        threadId: string | null;
        leaseId: string;
        unitLabel: string;
        leaseStatus: string;
        unreadCount: number;
        writable: boolean;
        lastMessageFromMe: boolean;
    }>, "many">;
    unreadTotal: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    threads: {
        reference: string;
        propertyName: string;
        counterpartName: string;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        threadId: string | null;
        leaseId: string;
        unitLabel: string;
        leaseStatus: string;
        unreadCount: number;
        writable: boolean;
        lastMessageFromMe: boolean;
    }[];
    unreadTotal: number;
}, {
    threads: {
        reference: string;
        propertyName: string;
        counterpartName: string;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        threadId: string | null;
        leaseId: string;
        unitLabel: string;
        leaseStatus: string;
        unreadCount: number;
        writable: boolean;
        lastMessageFromMe: boolean;
    }[];
    unreadTotal: number;
}>;
export type LeaseThreadList = z.infer<typeof LeaseThreadList>;
/** Unread messages, for the sidebar. */
export declare const MessageUnread: z.ZodObject<{
    total: z.ZodNumber;
    byLease: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    total: number;
    byLease: Record<string, number>;
}, {
    total: number;
    byLease: Record<string, number>;
}>;
export type MessageUnread = z.infer<typeof MessageUnread>;
/** The events the live line carries: only ids, the screen reads the rest over HTTP. */
export declare const REALTIME_PATH = "/api/realtime";
export interface MessageEvent {
    leaseId: string;
    threadId: string;
}
/** The app's pages a message mail opens. */
export declare const MESSAGE_APP_PATHS: {
    readonly landlord: (leaseId: string) => string;
    readonly tenant: (leaseId: string) => string;
};
/** A one-line preview of a message for a list or a mail. */
export declare function messagePreview(m: {
    body: string | null;
    bodyType: string;
    attachments: readonly {
        kind: MessageFileKind;
    }[];
    voiceDurationS?: number | null;
}): string;
//# sourceMappingURL=messages.d.ts.map