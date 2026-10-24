/**
 * What the verify scripts share: sign a persona in through the API exactly as the sign-in page does,
 * build the same source context a page gets, and find which screens read a collection.
 *
 * Run them under tsx from apps/app with INJISHI_API_URL pointing at a demo API (fixed sign-in code):
 *   pnpm --filter @injishi/app exec tsx scripts/verify-data.ts --area platform
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type PersonaId, personas, screens } from "@injishi/data";
import { allCollections } from "@injishi/data/fixtures/index";
import type { Doc } from "@injishi/data/types";
import { demoSignInCode, sendSignInCode, verifySignInCode } from "../../src/server/auth";
import { sourceContextFor } from "../../src/server/sources/context";
import type { SourceContext } from "../../src/server/sources/types";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export class CheckFailed extends Error {}

export function fail(message: string): never {
  throw new CheckFailed(message);
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

/** Exit 0 only when every step passed; print the success marker last. */
export async function main(run: () => Promise<string>): Promise<void> {
  try {
    const marker = await run();
    console.log(marker);
  } catch (error) {
    console.error(error instanceof CheckFailed ? `FAILED: ${error.message}` : error);
    process.exit(1);
  }
}

let code: string | null | undefined;

/** The API's fixed demo code; refuses to run against anything that is not the demo. */
export async function demoCode(): Promise<string> {
  if (code === undefined) code = await demoSignInCode();
  if (!code)
    fail(`the API at ${process.env.INJISHI_API_URL} is not the demo (GET /api/v1/platform), so no fixed code exists`);
  return code;
}

const sessions = new Map<string, string>();

/** A persona's API session cookie (one sign-in per persona per run). */
export async function cookieFor(personaId: PersonaId): Promise<string> {
  const cached = sessions.get(personaId);
  if (cached) return cached;
  const email = personas[personaId].email;
  const sent = await sendSignInCode(email);
  check(sent.ok, `could not send a code to ${email}: ${sent.ok ? "" : sent.reason}`);
  const verified = await verifySignInCode(email, await demoCode());
  check(verified.ok, `${email} could not sign in: ${verified.ok ? "" : verified.reason}`);
  sessions.set(personaId, verified.cookie);
  return verified.cookie;
}

/** The context a page gets when this persona is signed in. */
export async function contextFor(personaId: PersonaId | null): Promise<SourceContext> {
  return sourceContextFor(personaId ? await cookieFor(personaId) : null);
}

const emailSessions = new Map<string, string>();

/**
 * Sign any email in with the demo code, exactly as the sign-in page does, and return the cookie. This is how a
 * flow becomes someone who is not a persona: a seeded government officer, or a registrant it just invented.
 * The account is created on first sign-in.
 */
export async function cookieForEmail(email: string): Promise<string> {
  const address = email.trim().toLowerCase();
  const cached = emailSessions.get(address);
  if (cached) return cached;
  const sent = await sendSignInCode(address);
  check(sent.ok, `could not send a code to ${address}: ${sent.ok ? "" : sent.reason}`);
  const verified = await verifySignInCode(address, await demoCode());
  check(verified.ok, `${address} could not sign in: ${verified.ok ? "" : verified.reason}`);
  emailSessions.set(address, verified.cookie);
  return verified.cookie;
}

/** The context a page gets when this email is signed in. */
export async function contextForEmail(email: string): Promise<SourceContext> {
  return sourceContextFor(await cookieForEmail(email));
}

export function fixtures<T extends Doc = Doc>(collection: string): T[] {
  const docs = allCollections()[collection];
  if (!docs) fail(`no fixture collection "${collection}"`);
  return docs as T[];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Boards whose page reads this collection, and the persona each board is drawn for. */
export function readersOf(collection: string): { board: string; persona: PersonaId | null }[] {
  const out: { board: string; persona: PersonaId | null }[] = [];
  for (const file of walk(path.join(app, "src/app")).filter((f) => /[\\/]page\.tsx$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(`"${collection}"`)) continue;
    const board = text.match(/require(?:Persona|Screen)\(\s*"([A-Za-z0-9]+)"/)?.[1];
    if (!board) continue;
    const entry = screens[board as keyof typeof screens];
    out.push({ board, persona: (entry?.persona ?? null) as PersonaId | null });
  }
  return out;
}
