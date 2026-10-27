import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { messageFileKind, messageFileMaxBytes, type MessageFileKind } from '@injishi/contracts';

import { storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { STORAGE_PORT, type StoragePort } from '../domain/storage-port';
import { normalisePhoto } from './photo-normaliser';

/** A file a message carries, once stored. */
export interface StoredMessageFile {
  id: string;
  objectKey: string;
  kind: MessageFileKind;
  mime: string;
  sizeBytes: number;
  filename: string;
}

/** The type a message file is, read from its bytes; the declared type only settles what bytes cannot. */
export type MessageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/plain'
  | 'text/csv'
  | 'audio/webm'
  | 'audio/ogg'
  | 'audio/mp4';

const EXTENSION: Readonly<Record<MessageMime, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

const MP4_AUDIO_BRANDS = new Set(['M4A ', 'M4B ', 'mp42', 'mp41', 'isom', 'iso2', 'iso5', 'iso6', 'dash', 'MSNV']);

function base(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

function looksLikeText(body: Buffer): boolean {
  // A binary file has NUL bytes early on; text (UTF-8, Latin-1 or a CSV export) has none.
  return !body.subarray(0, 8192).includes(0);
}

/**
 * What a message file IS, from its first bytes (never its name). The declared
 * type picks between formats the bytes cannot tell apart: a Word or Excel
 * file is a zip (or an OLE box) either way, and text is text. A WebM is taken
 * as a voice note only when it was sent as audio. Null for anything else.
 */
export function sniffMessageMime(body: Buffer, declared: string): MessageMime | null {
  const d = base(declared);
  const head4 = body.subarray(0, 4);
  if (body.length >= 5 && body.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.length >= 8 && body.readUInt32BE(0) === 0x89504e47 && body.readUInt32BE(4) === 0x0d0a1a0a) return 'image/png';
  if (body.length >= 12 && head4.toString('latin1') === 'RIFF' && body.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (body.length >= 4 && body.readUInt32BE(0) === 0x1a45dfa3) {
    return d === 'audio/webm' || d === 'video/webm' ? 'audio/webm' : null;
  }
  if (body.length >= 4 && head4.toString('latin1') === 'OggS') return 'audio/ogg';
  if (body.length >= 12 && body.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = body.subarray(8, 12).toString('latin1');
    return MP4_AUDIO_BRANDS.has(brand) && (d === 'audio/mp4' || d === 'audio/x-m4a' || d === 'audio/m4a') ? 'audio/mp4' : null;
  }
  if (body.length >= 4 && body.readUInt32BE(0) === 0x504b0304) {
    if (d === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return d;
    if (d === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return d;
    return null;
  }
  if (body.length >= 8 && body.readUInt32BE(0) === 0xd0cf11e0 && body.readUInt32BE(4) === 0xa1b11ae1) {
    if (d === 'application/msword' || d === 'application/vnd.ms-excel') return d;
    return null;
  }
  if ((d === 'text/plain' || d === 'text/csv') && looksLikeText(body)) return d;
  return null;
}

/**
 * A message's files (rentals P3.4): photos, documents and voice notes a
 * landlord and a tenant send each other. Kept in the storage module for the
 * reason `StorageService` gives: bytes and their `stored_objects` row are
 * written as one act. Every file is typed from its bytes and held to its
 * kind's size; a photo is turned upright, fitted to 2048 px and stripped of
 * its metadata (GPS included) on the way in, as a fault's photo is.
 */
@Injectable()
export class MessageFilesStorage {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /** Check a file and store it against the workspace. Refuses with words a person can act on. */
  async put(input: {
    body: Buffer;
    mime: string;
    filename: string;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<StoredMessageFile> {
    const name = cleanName(input.filename);
    if (input.body.byteLength === 0) throw new BadRequestException(`"${name}" is empty.`);
    const sniffed = sniffMessageMime(input.body, input.mime);
    const kind = sniffed ? messageFileKind(sniffed) : null;
    if (!sniffed || !kind) {
      throw new BadRequestException(`"${name}" can't be sent. Send a photo (JPEG, PNG, WebP), a PDF, Word, Excel or text file.`);
    }
    const max = messageFileMaxBytes(kind);
    if (input.body.byteLength > max) {
      const mb = Math.round(max / (1024 * 1024));
      throw new BadRequestException(kind === 'audio' ? `A voice note must be ${mb} MB or smaller.` : `"${name}" is too large. The limit is ${mb} MB.`);
    }
    let body = input.body;
    let mime: MessageMime = sniffed;
    let filename = name;
    if (kind === 'image') {
      const photo = await normalisePhoto(input.body, sniffed);
      body = photo.body;
      mime = photo.mime;
      filename = `${name.replace(/\.[^./\\]*$/, '') || 'photo'}.jpg`;
    } else if (!filename.toLowerCase().endsWith(`.${EXTENSION[mime]}`)) {
      filename = `${filename.replace(/\.[^./\\]*$/, '') || (kind === 'audio' ? 'voice-note' : 'document')}.${EXTENSION[mime]}`;
    }
    const put = await this.storage.put({ body, mime, filename, kind: 'message_attachment' });
    const [row] = await this.db
      .insert(storedObjects)
      .values({
        objectKey: put.objectKey,
        kind: 'message_attachment',
        mime,
        sizeBytes: put.sizeBytes,
        uploadedByUserId: input.uploadedByUserId,
        workspaceId: input.workspaceId,
      })
      .returning({ id: storedObjects.id, objectKey: storedObjects.objectKey });
    if (!row) throw new Error(`stored object ${put.objectKey} was not recorded`);
    return { id: row.id, objectKey: row.objectKey, kind, mime, sizeBytes: put.sizeBytes, filename };
  }

  /** The bytes, for the route that hands a file to a reader the service already checked. */
  read(objectKey: string): Promise<Buffer> {
    return this.storage.get(objectKey);
  }
}

/** A file name safe to show and to put in a header: no path, no control characters, at most 120 characters. */
export function cleanName(raw: string): string {
  const leaf = raw.split(/[\\/]/).pop() ?? '';
  const plain = leaf.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return (plain || 'file').slice(0, 120);
}
