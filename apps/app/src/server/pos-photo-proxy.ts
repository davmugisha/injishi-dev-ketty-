/**
 * A menu item's own photo, between the browser and the API (Create recipe → Upload your own). Same origin, so the
 * browser sends the session cookie and no API address is exposed. The upload is streamed on to
 * `POST /api/v1/ops/pos/outlets/:outletId/menu-photos` unread (the API checks the type, the size, the outlet and the
 * permission); the read fetches `GET /api/v1/ops/pos/menu-photos/:itemId` and hands the JPEG back. Server side only.
 */
import { NextResponse } from "next/server";
import { ApiError, apiBaseUrl, apiOrigin, type SessionCookie } from "./api";
import { accountFor, workspaceFor } from "./auth";
import { sessionCookieHeader } from "./session-cookies";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

type CookieRequest = Request & { cookies: { getAll(): { name: string; value: string }[] } };

/** The session and the hospitality workspace the POS acts in, or the refusal to send. */
async function who(request: CookieRequest): Promise<{ cookie: SessionCookie; workspaceId: string } | Response> {
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again.");
  try {
    const account = await accountFor(cookie);
    if (!account) return refuse(401, "Sign in again.");
    const workspace = workspaceFor(account, "hospitality");
    if (!workspace) return refuse(404, "There is no restaurant or bar business here.");
    return { cookie, workspaceId: workspace.workspaceId };
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return refuse(401, "Sign in again.");
    return refuse(503, "Injishi could not be reached. Check your connection and try again.");
  }
}

export async function forwardMenuPhotoUpload(request: CookieRequest, outletId: string): Promise<Response> {
  if (!UUID.test(outletId)) return refuse(404, "That outlet was not found.");
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return refuse(400, "Send the photo as multipart/form-data.");
  const caller = await who(request);
  if (caller instanceof Response) return caller;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/ops/pos/outlets/${outletId}/menu-photos`, {
      method: "POST",
      headers: {
        accept: "application/json",
        origin: apiOrigin(),
        cookie: caller.cookie,
        "x-workspace-id": caller.workspaceId,
        "content-type": type,
        ...(request.headers.get("content-length")
          ? { "content-length": request.headers.get("content-length") as string }
          : {}),
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

export async function menuPhoto(request: CookieRequest, itemId: string): Promise<Response> {
  if (!UUID.test(itemId)) return new NextResponse(null, { status: 404 });
  const caller = await who(request);
  if (caller instanceof Response) return new NextResponse(null, { status: caller.status });
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/ops/pos/menu-photos/${itemId}`, {
      headers: {
        accept: "image/jpeg",
        origin: apiOrigin(),
        cookie: caller.cookie,
        "x-workspace-id": caller.workspaceId,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
  if (!response.ok) return new NextResponse(null, { status: response.status === 403 ? 403 : 404 });
  return new NextResponse(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      // The address carries the photo's version (`?v=`), so a copy never goes stale; private, as it needs a session.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
