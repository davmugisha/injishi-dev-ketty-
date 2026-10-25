"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_APP_PATHS = exports.REALTIME_PATH = exports.MessageUnread = exports.LeaseThreadList = exports.LeaseThreadSummary = exports.LeaseThreadView = exports.LeaseMessage = exports.LeaseMessageFault = exports.LeaseMessageAttachment = exports.MessageSide = exports.SendLeaseMessageFields = exports.MESSAGE_ACCEPT = exports.MESSAGE_AUDIO_MIMES = exports.MESSAGE_DOCUMENT_MIMES = exports.MESSAGE_IMAGE_MIMES = exports.LEASE_MESSAGE_PAGE = exports.MESSAGE_DIGEST_COOLDOWN_MIN = exports.MESSAGE_DIGEST_DELAY_MIN = exports.VOICE_NOTE_MAX_BYTES = exports.VOICE_NOTE_MAX_S = exports.LEASE_MESSAGE_FILE_MAX_BYTES = exports.LEASE_MESSAGE_IMAGE_MAX_BYTES = exports.LEASE_MESSAGE_FILES_MAX = exports.LEASE_MESSAGE_MAX_CHARS = void 0;
exports.messageFileKind = messageFileKind;
exports.messageFileMaxBytes = messageFileMaxBytes;
exports.messageFilesProblem = messageFilesProblem;
exports.messagePreview = messagePreview;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
// ===========================================================================
// Messages between a landlord and a tenant (P3.4, blueprint 1.2, 2.3, 3.5)
// ===========================================================================
//
// One conversation per lease (`threads.lease_id`, unique), made when the
// lease is signed or on the first message, whichever comes first. A message
// is text, photos, documents or one voice note, or a mix of text and files.
// The files are sent with the message (multipart), stored as
// `message_attachment` objects and read back through short-lived links.
// Both sides see when the other read the conversation (read receipts), and a
// person who has not read a message for a few minutes gets one email for
// everything waiting, never one per message.
/** Longest message accepted. */
exports.LEASE_MESSAGE_MAX_CHARS = 4000;
/** The most files one message carries. */
exports.LEASE_MESSAGE_FILES_MAX = 10;
/** A photo, before it is fitted and re-encoded. */
exports.LEASE_MESSAGE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** A document (a receipt, a scanned contract). */
exports.LEASE_MESSAGE_FILE_MAX_BYTES = 16 * 1024 * 1024;
/** The longest voice note, in seconds (the database holds it to this too). */
exports.VOICE_NOTE_MAX_S = 120;
/** A voice note's size: two minutes of speech is well under 2 MB in any browser's codec. */
exports.VOICE_NOTE_MAX_BYTES = 5 * 1024 * 1024;
/** Minutes a message waits unread before its reader is emailed. */
exports.MESSAGE_DIGEST_DELAY_MIN = 5;
/** Minutes between two digests to the same reader for the same conversation. */
exports.MESSAGE_DIGEST_COOLDOWN_MIN = 30;
/** A page of a conversation. */
exports.LEASE_MESSAGE_PAGE = 50;
/** Photos a message may carry: the bytes are checked, not the name. */
exports.MESSAGE_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
/** Documents a message may carry. */
exports.MESSAGE_DOCUMENT_MIMES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
];
/** Voice notes, as browsers record them: Chrome and Firefox WebM or Ogg Opus, Safari MP4 (AAC). */
exports.MESSAGE_AUDIO_MIMES = ["audio/webm", "audio/ogg", "audio/mp4"];
/** What the composer's file picker offers. */
exports.MESSAGE_ACCEPT = [
    ...exports.MESSAGE_IMAGE_MIMES,
    ...exports.MESSAGE_DOCUMENT_MIMES,
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".csv",
].join(",");
/**
 * How a file is drawn, from its type: a photo, a document card, or a voice
 * player. Null for a type a message may not carry.
 */
function messageFileKind(mime) {
    const m = mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (exports.MESSAGE_IMAGE_MIMES.includes(m))
        return "image";
    if (exports.MESSAGE_DOCUMENT_MIMES.includes(m))
        return "file";
    if (exports.MESSAGE_AUDIO_MIMES.includes(m) || m === "video/webm")
        return "audio";
    return null;
}
/** The largest a file of this kind may be. */
function messageFileMaxBytes(kind) {
    return kind === "image" ? exports.LEASE_MESSAGE_IMAGE_MAX_BYTES : kind === "audio" ? exports.VOICE_NOTE_MAX_BYTES : exports.LEASE_MESSAGE_FILE_MAX_BYTES;
}
/**
 * What is wrong with a message's files, in words, or null. The same rule the
 * composer checks before it sends and the API checks again: up to ten files,
 * each of a known type and size, and at most one voice note, which travels
 * alone (no photos or documents beside it) with its length.
 */
function messageFilesProblem(files, voiceDurationS) {
    if (files.length > exports.LEASE_MESSAGE_FILES_MAX)
        return `Send up to ${exports.LEASE_MESSAGE_FILES_MAX} files at once.`;
    let voices = 0;
    for (const f of files) {
        const kind = messageFileKind(f.mime);
        const what = f.name ? `"${f.name}"` : "That file";
        if (!kind)
            return `${what} can't be sent. Send a photo (JPEG, PNG, WebP), a PDF, Word, Excel or text file.`;
        if (f.sizeBytes <= 0)
            return `${what} is empty.`;
        const max = messageFileMaxBytes(kind);
        if (f.sizeBytes > max) {
            const mb = Math.round(max / (1024 * 1024));
            return kind === "audio" ? `A voice note must be ${mb} MB or smaller.` : `${what} is too large. The limit is ${mb} MB.`;
        }
        if (kind === "audio")
            voices += 1;
    }
    if (voices > 1)
        return "Send one voice note at a time.";
    if (voices === 1 && files.length > 1)
        return "Send a voice note on its own.";
    if (voices === 1) {
        if (voiceDurationS == null)
            return "The voice note's length is missing. Record it again.";
        if (voiceDurationS > exports.VOICE_NOTE_MAX_S)
            return `A voice note can be up to ${exports.VOICE_NOTE_MAX_S / 60} minutes.`;
    }
    return null;
}
/** The text fields of a message (the files ride beside them in the form). */
exports.SendLeaseMessageFields = zod_1.z
    .object({
    body: zod_1.z
        .string()
        .trim()
        .max(exports.LEASE_MESSAGE_MAX_CHARS, "That message is too long to send.")
        .optional(),
    voiceDurationS: zod_1.z.coerce.number().int().min(1).max(exports.VOICE_NOTE_MAX_S).optional(),
})
    .strict();
/** Who wrote a line, as the reader sees it. */
exports.MessageSide = zod_1.z.enum(["landlord", "tenant", "system"]);
/** One file on a message, behind a short-lived link. */
exports.LeaseMessageAttachment = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.enum(["image", "file", "audio"]),
    url: zod_1.z.string(),
    mime: zod_1.z.string(),
    sizeBytes: zod_1.z.number().int().nullable(),
    filename: zod_1.z.string().nullable(),
});
/** The fault a line is about (a report or a reply on it), with where to open it. */
exports.LeaseMessageFault = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    status: zod_1.z.string(),
});
exports.LeaseMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    side: exports.MessageSide,
    senderName: zod_1.z.string().nullable(),
    fromMe: zod_1.z.boolean(),
    bodyType: zod_1.z.enum(["text", "image", "voice", "system", "file"]),
    body: zod_1.z.string().nullable(),
    attachments: zod_1.z.array(exports.LeaseMessageAttachment),
    voiceDurationS: zod_1.z.number().int().nullable(),
    fault: exports.LeaseMessageFault.nullable(),
    createdAt: zod_1.z.string(),
    /**
     * For the reader's own lines: `read` once the other side has opened the
     * conversation after it, else `delivered`. Null on the other side's lines.
     */
    receipt: zod_1.z.enum(["delivered", "read"]).nullable(),
});
/** A conversation as either side opens it: its lease, its people and a page of messages, oldest first. */
exports.LeaseThreadView = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    threadId: primitives_1.Uuid.nullable(),
    reference: zod_1.z.string(),
    leaseStatus: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    /** The other side: the tenant's name for the landlord, the business's for the tenant. */
    counterpartName: zod_1.z.string(),
    /** Writable while the lease is live; read only once it ended or was cancelled. */
    writable: zod_1.z.boolean(),
    /** When this reader last opened it before now (the unread divider sits after it). */
    myLastReadAt: zod_1.z.string().nullable(),
    /** When the other side last opened it (read receipts). */
    otherLastReadAt: zod_1.z.string().nullable(),
    messages: zod_1.z.array(exports.LeaseMessage),
    /** Older messages exist: pass this as `before` to read them. */
    olderCursor: zod_1.z.string().nullable(),
});
/** One row of the conversation list. */
exports.LeaseThreadSummary = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    threadId: primitives_1.Uuid.nullable(),
    reference: zod_1.z.string(),
    leaseStatus: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    counterpartName: zod_1.z.string(),
    lastMessageAt: zod_1.z.string().nullable(),
    lastMessagePreview: zod_1.z.string().nullable(),
    lastMessageFromMe: zod_1.z.boolean(),
    unreadCount: zod_1.z.number().int(),
    writable: zod_1.z.boolean(),
});
exports.LeaseThreadList = zod_1.z.object({
    threads: zod_1.z.array(exports.LeaseThreadSummary),
    unreadTotal: zod_1.z.number().int(),
});
/** Unread messages, for the sidebar. */
exports.MessageUnread = zod_1.z.object({
    total: zod_1.z.number().int(),
    byLease: zod_1.z.record(zod_1.z.string(), zod_1.z.number().int()),
});
/** The events the live line carries: only ids, the screen reads the rest over HTTP. */
exports.REALTIME_PATH = "/api/realtime";
/** The app's pages a message mail opens. */
exports.MESSAGE_APP_PATHS = {
    landlord: (leaseId) => `/messages?lease=${encodeURIComponent(leaseId)}`,
    tenant: (leaseId) => `/home/${encodeURIComponent(leaseId)}/messages`,
};
/** A one-line preview of a message for a list or a mail. */
function messagePreview(m) {
    const text = m.body?.replace(/\s+/g, " ").trim();
    if (text)
        return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    if (m.bodyType === "voice" || m.attachments.some((a) => a.kind === "audio"))
        return "Voice note";
    const photos = m.attachments.filter((a) => a.kind === "image").length;
    const files = m.attachments.length - photos;
    if (photos && !files)
        return photos === 1 ? "Photo" : `${photos} photos`;
    if (files && !photos)
        return files === 1 ? "Document" : `${files} documents`;
    if (photos || files)
        return `${m.attachments.length} files`;
    return "";
}
//# sourceMappingURL=messages.js.map