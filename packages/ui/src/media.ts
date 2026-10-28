/**
 * The checks a browser makes on a photo or a video before it is sent, as plain functions (no DOM), for
 * `PhotoUploader` and `VideoField`, checked by `tests/media.test.ts`. The API checks the type and size
 * again; a video's length can only be read by a player, so `VideoField` reads it and these word it.
 */

/** What a check needs from a `File`. */
export interface FileFacts {
  name: string;
  type: string;
  size: number;
}

export const MB = 1024 * 1024;

/** Photos: JPEG, PNG or WebP. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The `accept` attribute for a photo picker. */
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
/** The upload limit for one photo (server actions take 10 MB). */
export const PHOTO_MAX_BYTES = 10 * MB;

/** Videos: MP4, MOV or WebM. */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const VIDEO_ACCEPT = VIDEO_TYPES.join(",");
/** A video tour's size limit. */
export const VIDEO_MAX_BYTES = 100 * MB;
/** A video tour runs 1 second to 3 minutes. */
export const VIDEO_MIN_SECONDS = 1;
export const VIDEO_MAX_SECONDS = 180;

/** "830 KB", "2.4 MB", "12 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}

const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;

/** Why a photo can't be added, or null when it can. A file with no type is judged by its name. */
export function photoFileProblem(file: FileFacts, maxBytes: number = PHOTO_MAX_BYTES): string | null {
  const type = file.type.toLowerCase();
  const known = (PHOTO_TYPES as readonly string[]).includes(type) || (type === "" && PHOTO_EXT.test(file.name));
  if (!known) return `${file.name} isn't a JPEG, PNG or WebP photo.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > maxBytes)
    return `${file.name} is ${formatFileSize(file.size)}. The most is ${formatFileSize(maxBytes)}.`;
  return null;
}

/** Why a video can't be used, before it is opened, or null when it may go. */
export function videoFileProblem(file: FileFacts, maxBytes: number = VIDEO_MAX_BYTES): string | null {
  const type = file.type.toLowerCase();
  const known = (VIDEO_TYPES as readonly string[]).includes(type) || (type === "" && VIDEO_EXT.test(file.name));
  if (!known) return "That isn't a video we can show. Use an MP4, MOV or WebM file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxBytes)
    return `That video is ${formatFileSize(file.size)}. The most is ${formatFileSize(maxBytes)}.`;
  return null;
}

/** 42 gives "0:42", 125 gives "2:05". */
export function videoLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "3 minutes", "90 seconds", "1 minute 30 seconds". */
export function durationWords(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  const mins = m === 1 ? "1 minute" : `${m} minutes`;
  const secs = s === 1 ? "1 second" : `${s} seconds`;
  if (m === 0) return secs;
  return s === 0 ? mins : `${mins} ${secs}`;
}

/** Why a video's length is not allowed, or null. Half a second of slack either way, as players round. */
export function videoDurationProblem(
  seconds: number,
  min: number = VIDEO_MIN_SECONDS,
  max: number = VIDEO_MAX_SECONDS,
): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0)
    return "We couldn't play that video here. Try an MP4 recorded on a phone.";
  if (seconds > max + 0.5) return `That video runs ${videoLength(seconds)}. Keep it to ${durationWords(max)} or less.`;
  if (seconds < min - 0.5) return `That video is too short. Use one of at least ${durationWords(min)}.`;
  return null;
}

/**
 * Split picked files into the ones that fit (`room` places left) and the rest, keeping the order they
 * were picked in.
 */
export function takeRoom<T>(files: readonly T[], room: number): { taken: T[]; left: T[] } {
  const n = Math.max(0, room);
  return { taken: files.slice(0, n), left: files.slice(n) };
}

/** Move one item from `from` to `to` (both indexes in `items`), returning a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
