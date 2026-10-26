import { z } from "zod";
import { Uuid } from "../primitives";

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
export const LEASE_MESSAGE_MAX_CHARS = 4000;
/** The most files one message carries. */
export const LEASE_MESSAGE_FILES_MAX = 10;
/** A photo, before it is fitted and re-encoded. */
export const LEASE_MESSAGE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** A document (a receipt, a scanned contract). */
export const LEASE_MESSAGE_FILE_MAX_BYTES = 16 * 1024 * 1024;
/** The longest voice note, in seconds (the database holds it to this too). */
export const VOICE_NOTE_MAX_S = 120;
/** A voice note's size: two minutes of speech is well under 2 MB in any browser's codec. */
export const VOICE_NOTE_MAX_BYTES = 5 * 1024 * 1024;
/** Minutes a message waits unread before its reader is emailed. */
export const MESSAGE_DIGEST_DELAY_MIN = 5;
/** Minutes between two digests to the same reader for the same conversation. */
export const MESSAGE_DIGEST_COOLDOWN_MIN = 30;
/** A page of a conversation. */
export const LEASE_MESSAGE_PAGE = 50;

/** Photos a message may carry: the bytes are checked, not the name. */
export const MESSAGE_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Documents a message may carry. */
export const MESSAGE_DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;
/** Voice notes, as browsers record them: Chrome and Firefox WebM or Ogg Opus, Safari MP4 (AAC). */
export const MESSAGE_AUDIO_MIMES = ["audio/webm", "audio/ogg", "audio/mp4"] as const;

/** What the composer's file picker offers. */
export const MESSAGE_ACCEPT = [
  ...MESSAGE_IMAGE_MIMES,
  ...MESSAGE_DOCUMENT_MIMES,
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
].join(",");

export type MessageFileKind = "image" | "file" | "audio";

/**
 * How a file is drawn, from its type: a photo, a document card, or a voice
 * player. Null for a type a message may not carry.
 */
export function messageFileKind(mime: string): MessageFileKind | null {
  const m = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if ((MESSAGE_IMAGE_MIMES as readonly string[]).includes(m)) return "image";
  if ((MESSAGE_DOCUMENT_MIMES as readonly string[]).includes(m)) return "file";
  if ((MESSAGE_AUDIO_MIMES as readonly string[]).includes(m) || m === "video/webm") return "audio";
  return null;
}

/** The largest a file of this kind may be. */
export function messageFileMaxBytes(kind: MessageFileKind): number {
  return kind === "image" ? LEASE_MESSAGE_IMAGE_MAX_BYTES : kind === "audio" ? VOICE_NOTE_MAX_BYTES : LEASE_MESSAGE_FILE_MAX_BYTES;
}

/**
 * What is wrong with a message's files, in words, or null. The same rule the
 * composer checks before it sends and the API checks again: up to ten files,
 * each of a known type and size, and at most one voice note, which travels
 * alone (no photos or documents beside it) with its length.
 */
export function messageFilesProblem(
  files: readonly { mime: string; sizeBytes: number; name?: string }[],
  voiceDurationS?: number | null,
): string | null {
  if (files.length > LEASE_MESSAGE_FILES_MAX) return `Send up to ${LEASE_MESSAGE_FILES_MAX} files at once.`;
  let voices = 0;
  for (const f of files) {
    const kind = messageFileKind(f.mime);
    const what = f.name ? `"${f.name}"` : "That file";
    if (!kind) return `${what} can't be sent. Send a photo (JPEG, PNG, WebP), a PDF, Word, Excel or text file.`;
    if (f.sizeBytes <= 0) return `${what} is empty.`;
    const max = messageFileMaxBytes(kind);
    if (f.sizeBytes > max) {
      const mb = Math.round(max / (1024 * 1024));
      return kind === "audio" ? `A voice note must be ${mb} MB or smaller.` : `${what} is too large. The limit is ${mb} MB.`;
    }
    if (kind === "audio") voices += 1;
  }
  if (voices > 1) return "Send one voice note at a time.";
  if (voices === 1 && files.length > 1) return "Send a voice note on its own.";
  if (voices === 1) {
    if (voiceDurationS == null) return "The voice note's length is missing. Record it again.";
    if (voiceDurationS > VOICE_NOTE_MAX_S) return `A voice note can be up to ${VOICE_NOTE_MAX_S / 60} minutes.`;
  }
  return null;
}

/** The text fields of a message (the files ride beside them in the form). */
export const SendLeaseMessageFields = z
  .object({
    body: z
      .string()
      .trim()
      .max(LEASE_MESSAGE_MAX_CHARS, "That message is too long to send.")
      .optional(),
    voiceDurationS: z.coerce.number().int().min(1).max(VOICE_NOTE_MAX_S).optional(),
  })
  .strict();
export type SendLeaseMessageFields = z.infer<typeof SendLeaseMessageFields>;

/** Who wrote a line, as the reader sees it. */
export const MessageSide = z.enum(["landlord", "tenant", "broker", "system"]);
export type MessageSide = z.infer<typeof MessageSide>;

/** One file on a message, behind a short-lived link. */
export const LeaseMessageAttachment = z.object({
  id: Uuid,
  kind: z.enum(["image", "file", "audio"]),
  url: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().nullable(),
  filename: z.string().nullable(),
});
export type LeaseMessageAttachment = z.infer<typeof LeaseMessageAttachment>;

/** The fault a line is about (a report or a reply on it), with where to open it. */
export const LeaseMessageFault = z.object({
  id: Uuid,
  reference: z.string().nullable(),
  title: z.string(),
  status: z.string(),
});
export type LeaseMessageFault = z.infer<typeof LeaseMessageFault>;

export const LeaseMessage = z.object({
  id: Uuid,
  side: MessageSide,
  senderName: z.string().nullable(),
  fromMe: z.boolean(),
  bodyType: z.enum(["text", "image", "voice", "system", "file"]),
  body: z.string().nullable(),
  attachments: z.array(LeaseMessageAttachment),
  voiceDurationS: z.number().int().nullable(),
  fault: LeaseMessageFault.nullable(),
  createdAt: z.string(),
  /**
   * For the reader's own lines: `read` once the other side has opened the
   * conversation after it, else `delivered`. Null on the other side's lines.
   */
  receipt: z.enum(["delivered", "read"]).nullable(),
});
export type LeaseMessage = z.infer<typeof LeaseMessage>;

/** A conversation as either side opens it: its lease, its people and a page of messages, oldest first. */
export const LeaseThreadView = z.object({
  leaseId: Uuid,
  threadId: Uuid.nullable(),
  reference: z.string(),
  leaseStatus: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  /** The other side: the tenant's name for the landlord, the business's for the tenant. */
  counterpartName: z.string(),
  /** Writable while the lease is live; read only once it ended or was cancelled. */
  writable: z.boolean(),
  /** When this reader last opened it before now (the unread divider sits after it). */
  myLastReadAt: z.string().nullable(),
  /** When the other side last opened it (read receipts). */
  otherLastReadAt: z.string().nullable(),
  messages: z.array(LeaseMessage),
  /** Older messages exist: pass this as `before` to read them. */
  olderCursor: z.string().nullable(),
});
export type LeaseThreadView = z.infer<typeof LeaseThreadView>;

/** One row of the conversation list. */
export const LeaseThreadSummary = z.object({
  leaseId: Uuid,
  threadId: Uuid.nullable(),
  reference: z.string(),
  leaseStatus: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  counterpartName: z.string(),
  lastMessageAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageFromMe: z.boolean(),
  unreadCount: z.number().int(),
  writable: z.boolean(),
});
export type LeaseThreadSummary = z.infer<typeof LeaseThreadSummary>;

export const LeaseThreadList = z.object({
  threads: z.array(LeaseThreadSummary),
  unreadTotal: z.number().int(),
});
export type LeaseThreadList = z.infer<typeof LeaseThreadList>;

/** Unread messages, for the sidebar. */
export const MessageUnread = z.object({
  total: z.number().int(),
  byLease: z.record(z.string(), z.number().int()),
  /** Broker conversations (2026-10-26), by placement; in `total` too. */
  byPlacement: z.record(z.string(), z.number().int()).optional(),
});
export type MessageUnread = z.infer<typeof MessageUnread>;

/** The events the live line carries: only ids, the screen reads the rest over HTTP. */
export const REALTIME_PATH = "/api/realtime";
export interface MessageEvent {
  /** A lease conversation's event carries its lease; a broker conversation's, its placement. */
  leaseId?: string;
  placementId?: string;
  threadId: string;
}

/** The app's pages a message mail opens. */
export const MESSAGE_APP_PATHS = {
  landlord: (leaseId: string): string => `/messages?lease=${encodeURIComponent(leaseId)}`,
  tenant: (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}/messages`,
  /** A broker conversation: the broker and the landlord both read it on /messages. */
  placement: (placementId: string): string => `/messages?placement=${encodeURIComponent(placementId)}`,
} as const;

/** A one-line preview of a message for a list or a mail. */
export function messagePreview(m: {
  body: string | null;
  bodyType: string;
  attachments: readonly { kind: MessageFileKind }[];
  voiceDurationS?: number | null;
}): string {
  const text = m.body?.replace(/\s+/g, " ").trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  if (m.bodyType === "voice" || m.attachments.some((a) => a.kind === "audio")) return "Voice note";
  const photos = m.attachments.filter((a) => a.kind === "image").length;
  const files = m.attachments.length - photos;
  if (photos && !files) return photos === 1 ? "Photo" : `${photos} photos`;
  if (files && !photos) return files === 1 ? "Document" : `${files} documents`;
  if (photos || files) return `${m.attachments.length} files`;
  return "";
}

// ===========================================================================
// A broker and a landlord about a placement (2026-10-26)
// ===========================================================================
//
// One conversation per placement (`threads.placement_id`, unique), made the
// first time either side opens it. Two sides: the broker's own account, and
// the landlord business's team (anyone with `lease.manage` or
// `message.send`). The tenant never sees it. Lines are the same as a lease
// conversation's (`LeaseMessage`): text, photos, documents, voice notes,
// read receipts, the unread email.

/** Writable while the placement is open or became a lease; read only once it was dropped. */
export function placementThreadWritable(status: string): boolean {
  return status === "initiated" || status === "converted";
}

/** What a closed broker conversation says. */
export const PLACEMENT_THREAD_CLOSED = "This placement was closed, so its conversation is read only.";

/** A broker conversation as either side opens it: the placement, its people and a page of messages, oldest first. */
export const PlacementThreadView = z.object({
  placementId: Uuid,
  threadId: Uuid.nullable(),
  placementStatus: z.string(),
  unitLabel: z.string().nullable(),
  propertyName: z.string().nullable(),
  /** Who the broker said they bring. */
  tenantName: z.string().nullable(),
  /** The other side: the landlord business for the broker, the broker for the landlord. */
  counterpartName: z.string(),
  writable: z.boolean(),
  myLastReadAt: z.string().nullable(),
  otherLastReadAt: z.string().nullable(),
  messages: z.array(LeaseMessage),
  olderCursor: z.string().nullable(),
});
export type PlacementThreadView = z.infer<typeof PlacementThreadView>;

export const PlacementThreadSummary = z.object({
  placementId: Uuid,
  threadId: Uuid.nullable(),
  placementStatus: z.string(),
  unitLabel: z.string().nullable(),
  propertyName: z.string().nullable(),
  tenantName: z.string().nullable(),
  counterpartName: z.string(),
  lastMessageAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageFromMe: z.boolean(),
  unreadCount: z.number().int(),
  writable: z.boolean(),
});
export type PlacementThreadSummary = z.infer<typeof PlacementThreadSummary>;

export const PlacementThreadList = z.object({
  threads: z.array(PlacementThreadSummary),
  unreadTotal: z.number().int(),
});
export type PlacementThreadList = z.infer<typeof PlacementThreadList>;
