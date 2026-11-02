"use server";

import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { readPsfBusinesses, readPsfDecisions, type PsfBusinessesPage, type PsfBusinessesFilter, type PsfDecisionsPage } from "@/server/sources/psf";

export type PsfExportResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

/** The most rows an export gathers, page by page; a region larger than this is narrowed first. */
const CAP = 5_000;

async function gather<T>(read: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>): Promise<PsfExportResult<T>> {
  try {
    const rows: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await read(cursor);
      rows.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor && rows.length < CAP);
    return { ok: true, rows };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

/** Every business the Businesses screen lists under the same search and filter, for its CSV. */
export async function exportPsfBusinessesAction(query: PsfBusinessesFilter): Promise<PsfExportResult<PsfBusinessesPage["items"][number]>> {
  await requirePersona("PsfRegister");
  const ctx = await requestContext();
  return gather((cursor) => readPsfBusinesses(ctx, { ...query, cursor }));
}

/** Every decision the Membership decisions screen lists under the same search and filter, for its CSV. */
export async function exportPsfDecisionsAction(query: {
  q?: string;
  outcome?: "approved" | "declined";
}): Promise<PsfExportResult<PsfDecisionsPage["items"][number]>> {
  await requirePersona("PsfDecisions");
  const ctx = await requestContext();
  return gather((cursor) => readPsfDecisions(ctx, { ...query, cursor }));
}
