import type { NextRequest } from "next/server";
import { forwardBusinessFile } from "@/server/rentals/download";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A lease's contract as a PDF for the landlord: the current version, or `?version=`. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ message: "That lease was not found." }, { status: 404 });
  const query = new URLSearchParams();
  const version = request.nextUrl.searchParams.get("version");
  if (version && /^\d{1,4}$/.test(version)) query.set("version", version);
  return forwardBusinessFile(request, `/api/v1/ops/leases/${id}/contract/pdf`, query);
}

export const dynamic = "force-dynamic";
