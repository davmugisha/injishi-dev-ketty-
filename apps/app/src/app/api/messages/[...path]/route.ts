import { type NextRequest, NextResponse } from "next/server";
import { ApiError, apiBaseUrl, apiOrigin } from "@/server/api";
import { accountFor, workspaceFor } from "@/server/auth";
import { sessionCookieHeader } from "@/server/session-cookies";

/**
 * The browser's door to its lease conversations (P3.4), on the app's own origin: read a conversation,
 * send a line (JSON, or multipart with photos, files or a voice note), mark it read, the unread count,
 * and a message's files. Forwarded to the API with the person's session and, on the landlord's side,
 * the residence business they work in. Only these paths pass; the API decides the rest.
 *
 *   /api/messages/ops/rentals/messages[/<lease>[/read|/files/<id>]|/unread]   the landlord's side
 *   /api/messages/me/tenancies/<lease>/messages[/read|/files/<id>]           the tenant's side
 *   /api/messages/me/tenancies/messages[/unread]
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LANDLORD = new RegExp(`^ops/rentals/messages(/unread|/${UUID}(/read|/files/${UUID})?)?$`, "i");
const TENANT = new RegExp(`^me/tenancies/(messages(/unread)?|${UUID}/messages(/read|/files/${UUID})?)$`, "i");

const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

async function forward(request: NextRequest, params: Promise<{ path: string[] }>, method: "GET" | "POST") {
  const path = (await params).path.join("/");
  const landlord = LANDLORD.test(path);
  if (!landlord && !TENANT.test(path)) return refuse(404, "That was not found.");
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again to read your messages.");
  const headers: Record<string, string> = {
    accept: request.headers.get("accept") ?? "application/json",
    origin: apiOrigin(),
    cookie,
  };
  if (landlord) {
    try {
      const account = await accountFor(cookie);
      if (!account) return refuse(401, "Sign in again to read your messages.");
      const workspace = workspaceFor(account, "residence");
      if (workspace?.domain !== "residence") return refuse(404, "There is no rentals business here.");
      headers["x-workspace-id"] = workspace.workspaceId;
    } catch (error) {
      if (error instanceof ApiError && error.unauthenticated)
        return refuse(401, "Sign in again to read your messages.");
      return refuse(503, "Injishi could not be reached. Check your connection and try again.");
    }
  }
  const type = request.headers.get("content-type");
  if (method === "POST" && type) headers["content-type"] = type;
  const length = request.headers.get("content-length");
  if (method === "POST" && length) headers["content-length"] = length;
  const url = new URL(`${apiBaseUrl()}/api/v1/${path}`);
  for (const [k, v] of request.nextUrl.searchParams) url.searchParams.set(k, v);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? request.body : undefined,
      duplex: "half",
      cache: "no-store",
      signal: AbortSignal.timeout(method === "POST" ? 3 * 60_000 : 30_000),
    } as RequestInit & { duplex: "half" });
  } catch {
    return refuse(503, "Injishi could not be reached. Check your connection and try again.");
  }
  const out = new Headers();
  for (const h of ["content-type", "content-disposition", "cache-control", "content-length"]) {
    const v = response.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers: out });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, params, "GET");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, params, "POST");
}

export const dynamic = "force-dynamic";
