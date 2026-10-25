import type { NextRequest } from "next/server";
import { forwardForm, refuse, UUID } from "@/server/rentals/form-proxy";

/**
 * The landlord's forms that carry a file, streamed on to the API: a fault's photos and a fixer's
 * recorded payment, an expense and its receipt, a tax declaration, and a lease filed with RRA.
 */
function target(path: string[], method: "POST" | "PUT"): string | null {
  const [area, id, ...rest] = path;
  const tail = rest.join("/");
  if (
    method === "POST" &&
    area === "faults" &&
    id &&
    UUID.test(id) &&
    (tail === "photos" || tail === "payments/recorded")
  )
    return `/api/v1/ops/faults/${id}/${tail}`;
  if (method === "POST" && area === "expenses" && !id) return "/api/v1/ops/expenses";
  if (method === "POST" && area === "expenses" && id && UUID.test(id) && tail === "receipt")
    return `/api/v1/ops/expenses/${id}/receipt`;
  if (method === "PUT" && area === "taxes" && id && /^\d{4}$/.test(id) && tail === "declaration")
    return `/api/v1/ops/taxes/${id}/declaration`;
  if (method === "POST" && area === "filings" && id && UUID.test(id) && tail === "filed")
    return `/api/v1/ops/filings/${id}/filed`;
  return null;
}

async function handle(request: NextRequest, params: Promise<{ path: string[] }>, method: "POST" | "PUT") {
  const to = target((await params).path, method);
  if (!to) return refuse(404, "That was not found.");
  return forwardForm(request, to, method, "landlord");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, params, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, params, "PUT");
}

export const dynamic = "force-dynamic";
