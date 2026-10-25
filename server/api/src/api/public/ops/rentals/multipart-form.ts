import type { Readable } from 'node:stream';

import { BadRequestException } from '@nestjs/common';
import { ZodError, type ZodTypeAny, type output } from 'zod';

/** The slice of the Fastify request a form route touches (see `uploads.controller.ts`). */
export interface FormRequest {
  body?: unknown;
  isMultipart?: () => boolean;
  parts?: (options?: {
    limits?: { fileSize?: number; files?: number; fields?: number };
  }) => AsyncIterableIterator<FormPart>;
}

type FormPart =
  | {
      type: 'file';
      fieldname: string;
      filename?: string;
      mimetype?: string;
      file: Readable & { truncated?: boolean };
      toBuffer: () => Promise<Buffer>;
    }
  | { type: 'field'; fieldname: string; value: unknown };

/** One file of a form, read into memory under the route's ceiling. */
export interface FormFile {
  fieldname: string;
  filename: string;
  mime: string;
  body: Buffer;
}

export interface FormInput {
  /** The text fields, or the JSON body for a request that was not multipart. */
  fields: Record<string, unknown>;
  files: FormFile[];
}

const mb = (bytes: number): number => Math.round(bytes / (1024 * 1024));

/**
 * A form that may carry files (rentals WP 4.1 to 4.4): a fault report with
 * its photos, an expense with its receipt, a filing with its proof. Sent as
 * multipart/form-data with the files beside the fields, or as plain JSON when
 * there is no file. A file over `maxBytes`, or more than `maxFiles`, is
 * refused before anything is stored.
 */
export async function readForm(request: FormRequest, limits: { maxFiles: number; maxBytes: number; what: string }): Promise<FormInput> {
  const multipart = typeof request.isMultipart === 'function' && request.isMultipart() && typeof request.parts === 'function';
  if (!multipart) {
    const body = request.body;
    return { fields: body && typeof body === 'object' ? { ...(body as Record<string, unknown>) } : {}, files: [] };
  }
  const fields: Record<string, unknown> = {};
  const files: FormFile[] = [];
  const parts = (request.parts as NonNullable<FormRequest['parts']>).call(request, {
    limits: { fileSize: limits.maxBytes, files: limits.maxFiles + 1, fields: 40 },
  });
  try {
    await collect(parts, fields, files, limits);
  } catch (cause) {
    const code = (cause as { code?: string }).code ?? '';
    if (code === 'FST_REQ_FILE_TOO_LARGE') throw new BadRequestException(`${limits.what} must be ${mb(limits.maxBytes)} MB or smaller.`);
    if (code === 'FST_FILES_LIMIT') throw new BadRequestException(`Send at most ${limits.maxFiles} ${limits.maxFiles === 1 ? 'file' : 'files'}.`);
    if (code.startsWith('FST_')) throw new BadRequestException('The form could not be read. Try again.');
    throw cause;
  }
  return { fields, files };
}

async function collect(
  parts: AsyncIterableIterator<FormPart>,
  fields: Record<string, unknown>,
  files: FormFile[],
  limits: { maxFiles: number; maxBytes: number; what: string },
): Promise<void> {
  for await (const part of parts) {
    if (part.type === 'field') {
      fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value ?? '');
      continue;
    }
    if (files.length >= limits.maxFiles) {
      // Drain the stream so the request finishes, then refuse.
      part.file.resume();
      throw new BadRequestException(`Send at most ${limits.maxFiles} ${limits.maxFiles === 1 ? 'file' : 'files'}.`);
    }
    const body = await part.toBuffer();
    if (part.file.truncated) throw new BadRequestException(`${limits.what} must be ${mb(limits.maxBytes)} MB or smaller.`);
    if (body.byteLength === 0) continue;
    files.push({ fieldname: part.fieldname, filename: part.filename ?? 'file', mime: part.mimetype ?? 'application/octet-stream', body });
  }
}

/** Parse fields with a contracts schema, answering 400 the way `ZodValidationPipe` does. */
export function parseFields<S extends ZodTypeAny>(schema: S, fields: Record<string, unknown>): output<S> {
  try {
    return schema.parse(fields) as output<S>;
  } catch (err) {
    if (err instanceof ZodError) throw new BadRequestException({ message: 'Validation failed', issues: err.issues });
    throw err;
  }
}

/**
 * A multipart text field holds a string; turn the blank ones into "not sent"
 * and the numeric ones into numbers, so one schema serves JSON and forms.
 */
export function normaliseFormFields(fields: Record<string, unknown>, numeric: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' && v.trim() === '') continue;
    if (numeric.includes(k) && typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
      out[k] = Number(v.trim());
      continue;
    }
    out[k] = v;
  }
  return out;
}
