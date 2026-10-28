import type { NextRequest } from "next/server";
import { forwardFile } from "@/server/downloads/forward-file";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tenant's lease as a PDF: the signed copy once both have signed, a marked preview before. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  if (!UUID.test(leaseId)) return Response.json({ message: "That lease was not found." }, { status: 404 });
  return forwardFile(request, `/api/v1/me/tenancies/${leaseId}/contract/pdf`, new URLSearchParams());
}

export const dynamic = "force-dynamic";
