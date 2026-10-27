/**
 * Forms with a file (a fault's photos, a receipt, RRA's proof) go from the browser to these route
 * handlers (same origin, so the upload can report its progress), which stream the multipart body on to
 * the API unread, with the person's session and, for the landlord's side, the business they work in.
 * The API checks the fields, the files and the permission. Server side only.
 */
import { NextResponse } from "next/server";
import { ApiError, apiBaseUrl, apiOrigin } from "../api";
import { accountFor, workspaceFor } from "../auth";
import { sessionCookieHeader } from "../session-cookies";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

type CookieRequest = Request & { cookies: { getAll(): { name: string; value: string }[] } };

export async function forwardForm(
  request: CookieRequest,
  apiPath: string,
  method: "POST" | "PUT",
  /** "landlord": in the person's residence business (`x-workspace-id`); "person": as themselves. */
  as: "landlord" | "person",
): Promise<Response> {
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again to send this.");
  const extra: Record<string, string> = {};
  if (as === "landlord") {
    try {
      const account = await accountFor(cookie);
      if (!account) return refuse(401, "Sign in again to send this.");
      const workspace = workspaceFor(account, "residence");
      if (workspace?.domain !== "residence") return refuse(404, "There is no rentals business here.");
      extra["x-workspace-id"] = workspace.workspaceId;
    } catch (error) {
      if (error instanceof ApiError && error.unauthenticated) return refuse(401, "Sign in again to send this.");
      return refuse(503, "Injishi could not be reached. Check your connection and try again.");
    }
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return refuse(400, "Send the form as multipart/form-data.");
  const length = request.headers.get("content-length");

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${apiPath}`, {
      method,
      headers: {
        accept: "application/json",
        origin: apiOrigin(),
        cookie,
        "content-type": type,
        ...extra,
        ...(length ? { "content-length": length } : {}),
      },
      body: request.body,
      duplex: "half",
      cache: "no-store",
      signal: AbortSignal.timeout(5 * 60_000),
    } as RequestInit & { duplex: "half" });
  } catch {
    return refuse(503, "The upload stopped. Check your connection and try again.");
  }
  const text = await response.text();
  return new NextResponse(text || null, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
