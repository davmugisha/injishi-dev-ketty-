import type { NextRequest } from "next/server";
import { forwardFile } from "@/server/downloads/forward-file";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The receipt of a payment the tenant made or the landlord recorded, as a PDF. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ leaseId: string; id: string }> }) {
  const { leaseId, id } = await params;
  if (!UUID.test(leaseId) || !UUID.test(id)) {
    return Response.json({ message: "That receipt was not found." }, { status: 404 });
  }
  return forwardFile(request, `/api/v1/me/tenancies/${leaseId}/payments/${id}/receipt`, new URLSearchParams());
}

export const dynamic = "force-dynamic";
