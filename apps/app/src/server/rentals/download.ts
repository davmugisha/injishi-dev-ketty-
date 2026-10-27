/**
 * A file the API makes for the landlord's business (a lease's PDF), handed to the browser from the app's
 * own origin with the person's session and the business they work in (`x-workspace-id`), so a download
 * link works like any other link. The API decides who may have it. Server side only.
 */
import { NextResponse } from "next/server";
import { ApiError } from "../api";
import { accountFor, workspaceFor } from "../auth";
import { forwardFile } from "../downloads/forward-file";
import { sessionCookieHeader } from "../session-cookies";

const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

export async function forwardBusinessFile(
  request: Request & { cookies: { getAll(): { name: string; value: string }[] } },
  apiPath: string,
  query: URLSearchParams,
): Promise<Response> {
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again to download.");
  let workspaceId: string | null = null;
  try {
    const account = await accountFor(cookie);
    if (!account) return refuse(401, "Sign in again to download.");
    const workspace = workspaceFor(account, "residence");
    workspaceId = workspace?.domain === "residence" ? workspace.workspaceId : null;
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return refuse(401, "Sign in again to download.");
    return refuse(503, "Injishi could not be reached. Check your connection and try again.");
  }
  if (!workspaceId) return refuse(404, "There is no rentals business here.");
  return forwardFile(request, apiPath, query, { "x-workspace-id": workspaceId });
}
