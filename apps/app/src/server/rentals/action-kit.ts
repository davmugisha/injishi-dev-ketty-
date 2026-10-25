/**
 * What every rentals server action shares (WP 2.4, P3): checking input with the contracts schema the API
 * checks with, running the call as the landlord's business or as the person, and turning the API's
 * refusals into words for a toast, a field, or a decision the screen makes (`code`). Server side only; not
 * a "use server" module itself, so it can export plain helpers.
 */
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "../api";
import { type LandlordScope, landlordScope } from "./client";

export type ActionResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      /** The API's code on a refusal ("contract_changed", "invitation_other_email"), when it gave one. */
      code?: string | null;
      status?: number;
      fieldErrors?: Record<string, string>;
    };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A contracts schema (zod 3, used only through its own methods: the app's zod is 4). */
export interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: Invalid };
}
export interface Invalid {
  issues: { path: (string | number)[]; message: string }[];
}

export function fieldErrorsOf(
  issues: readonly { path: readonly (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalid<T>(error: Invalid): ActionResult<T> {
  const fieldErrors = fieldErrorsOf(error.issues);
  return { ok: false, error: fieldErrors._ ?? "Check the highlighted fields.", fieldErrors };
}

export function parse<T>(schema: Schema<T>, input: unknown): { ok: true; data: T } | { ok: false; error: Invalid } {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

/** The API's refusal in words, with its code and field errors where it gave them. */
export function refusal<T>(error: unknown, notFound = "That was not found."): ActionResult<T> {
  if (error instanceof ApiError) {
    if (error.unauthenticated) redirect("/sign-in");
    const body = error.body as { issues?: { path: (string | number)[]; message: string }[]; code?: string } | null;
    if (error.status === 400 && Array.isArray(body?.issues) && body.issues.length > 0) {
      const fieldErrors = fieldErrorsOf(body.issues);
      return {
        ok: false,
        status: 400,
        error: fieldErrors._ ?? body.issues[0]?.message ?? "Check the highlighted fields.",
        fieldErrors,
      };
    }
    if (error.notFound) return { ok: false, status: 404, code: error.code, error: notFound };
    if (error.forbidden) {
      return {
        ok: false,
        status: 403,
        code: error.code,
        error: error.message.startsWith("HTTP ") ? "You can't do this here." : error.message,
      };
    }
    return {
      ok: false,
      status: error.status,
      code: error.code,
      error: error.message.startsWith("HTTP ") ? "That didn't work. Try again." : error.message,
    };
  }
  if (error instanceof ApiUnreachableError) {
    return { ok: false, error: "Injishi could not be reached. Check your connection and try again." };
  }
  throw error;
}

/** Run one write in the landlord's business. */
export async function runLandlord<T>(
  write: (scope: LandlordScope) => Promise<T>,
  notFound?: string,
): Promise<ActionResult<T>> {
  const scope = await landlordScope();
  if (!scope) return { ok: false, error: "There is no rentals business here." };
  try {
    return { ok: true, value: await write(scope) };
  } catch (error) {
    return refusal<T>(error, notFound);
  }
}

/** Run one call as the signed-in person (a tenant's own lease, an invitation). */
export async function runPerson<T>(call: () => Promise<T>, notFound?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return refusal<T>(error, notFound);
  }
}

export const ws = (scope: LandlordScope) => ({ workspaceId: scope.workspace.workspaceId });

/** One key per press for the money routes, minted when the action runs. */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}
