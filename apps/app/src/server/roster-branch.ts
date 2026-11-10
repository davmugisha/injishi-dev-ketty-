import { cookies } from "next/headers";

const COOKIE = "injishi-roster-branch";

/** The branch the Roster screen is working on, as last chosen; null means the head office. */
export async function chosenRosterBranch(): Promise<string | null> {
  try {
    return (await cookies()).get(COOKIE)?.value ?? null;
  } catch {
    // Outside a request (a script or a flow check) there is no choice to read.
    return null;
  }
}

/** Remember the branch for a year; only ever read back against the workspace's own branches. */
export async function rememberRosterBranch(id: string): Promise<void> {
  (await cookies()).set(COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
