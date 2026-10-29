/**
 * Unit photos and videos go from the browser to these route handlers (same origin, so the upload can
 * report its progress), which stream the multipart body on to the API unread, with the person's session
 * and the business they work in. The API checks the type, the size, the unit and the permission; a video
 * is never held in this process's memory. Server side only.
 */
import { NextResponse } from "next/server";
import { ApiError, apiBaseUrl, apiOrigin } from "../api";
import { accountFor, workspaceFor } from "../auth";
import { sessionCookieHeader } from "../session-cookies";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

export async function forwardUpload(
  request: Request & { cookies: { getAll(): { name: string; value: string }[] } },
  unitId: string,
  target: "photos" | "video",
  method: "POST" | "PUT",
): Promise<Response> {
  if (!UUID.test(unitId)) return refuse(404, "That unit was not found.");
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again to upload.");
  let workspaceId: string | null = null;
  try {
    const account = await accountFor(cookie);
    if (!account) return refuse(401, "Sign in again to upload.");
    const workspace = workspaceFor(account, "residence");
    workspaceId = workspace?.domain === "residence" ? workspace.workspaceId : null;
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return refuse(401, "Sign in again to upload.");
    return refuse(503, "Injishi could not be reached. Check your connection and try again.");
  }
  if (!workspaceId) return refuse(404, "There is no rentals business here.");
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return refuse(400, "Send the file as multipart/form-data.");

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/ops/units/${unitId}/${target}`, {
      method,
      headers: {
        accept: "application/json",
        origin: apiOrigin(),
        cookie,
        "x-workspace-id": workspaceId,
        "content-type": type,
        ...(request.headers.get("content-length")
          ? { "content-length": request.headers.get("content-length") as string }
          : {}),
      },
      body: request.body,
      // Stream the body on as it arrives instead of buffering it here.
      duplex: "half",
      cache: "no-store",
      signal: AbortSignal.timeout(15 * 60_000),
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
