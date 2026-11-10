import "server-only";

import { apiBaseUrl } from "@/server/api";

/**
 * An applicant's own progress page (058-talent), read for them. Nobody is signed in: the link names
 * the application, and the session a mailed code gave travels as `x-application-session`. The shapes
 * mirror `@injishi/contracts` talent.ts (ApplicationView), which the app does not import.
 */
export type ApplicationStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface ApplicationView {
  firstName: string;
  role: string;
  business: string;
  branch: string | null;
  stage: ApplicationStage;
  appliedOn: string;
  interview: { startsAt: string; place: string | null; interviewerName: string | null } | null;
  documents: { name: string; filename: string | null; uploadedAt: string | null }[];
  offer: {
    amountRwf: number;
    startsOn: string | null;
    agreedRwf: number | null;
    rounds: { side: "business" | "candidate"; amountRwf: number; note: string | null; createdAt: string }[];
    canRespond: boolean;
  } | null;
  closedReason: string | null;
}

export type ApplicationRead = { state: "open"; view: ApplicationView } | { state: "locked" } | { state: "missing" };

/** The cookie holding this application's session, on its own page's path only. */
export const sessionCookie = (token: string) => ({ name: "ij_apply", path: `/apply/${token}` });

const TOKEN = /^[A-Za-z0-9_-]{24,128}$/;

export function url(token: string, rest = ""): string {
  if (!TOKEN.test(token)) throw new Error("bad application link");
  return `${apiBaseUrl()}/api/v1/applications/${token}${rest}`;
}

/** What the API said when it refused, in its own words. */
export async function refusal(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return typeof message === "string" && message ? message : "That did not work. Try again.";
  } catch {
    return "That did not work. Try again.";
  }
}

export async function readApplication(token: string, session: string | undefined): Promise<ApplicationRead> {
  if (!TOKEN.test(token)) return { state: "missing" };
  const res = await fetch(url(token), {
    headers: session ? { "x-application-session": session } : {},
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 400) return { state: "missing" };
  if (res.status === 401) return { state: "locked" };
  if (!res.ok) throw new Error(`application read failed: ${res.status}`);
  return { state: "open", view: (await res.json()) as ApplicationView };
}
