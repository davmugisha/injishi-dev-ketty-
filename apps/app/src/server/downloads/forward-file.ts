/**
 * A file the API makes (a CSV or a PDF), handed to the browser from the app's own origin with the
 * person's session forwarded, so a download link works like any other link. The API decides who may
 * have it; this only carries the answer, with its file name. Server side only.
 */
import { NextResponse } from "next/server";
import { apiBaseUrl, apiOrigin } from "../api";
import { sessionCookieHeader } from "../session-cookies";

const refuse = (status: number, message: string) => NextResponse.json({ message }, { status });

export async function forwardFile(
  request: Request & { cookies: { getAll(): { name: string; value: string }[] } },
  apiPath: string,
  query: URLSearchParams,
): Promise<Response> {
  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return refuse(401, "Sign in again to download.");
  const url = new URL(`${apiBaseUrl()}${apiPath}`);
  for (const [k, v] of query) url.searchParams.set(k, v);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "*/*", origin: apiOrigin(), cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return refuse(503, "Injishi could not be reached. Check your connection and try again.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    return refuse(response.status, body?.message ?? "That file could not be made.");
  }
  const headers = new Headers({ "cache-control": "no-store" });
  for (const h of ["content-type", "content-disposition"]) {
    const v = response.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(response.body, { status: 200, headers });
}
