import type { NextRequest } from "next/server";
import { forwardForm, refuse, UUID } from "@/server/rentals/form-proxy";

/** Photos of the tenant's own fault, streamed on to `POST /api/v1/me/tenancies/:leaseId/faults/:id/photos`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ leaseId: string; id: string }> }) {
  const { leaseId, id } = await params;
  if (!UUID.test(leaseId) || !UUID.test(id)) return refuse(404, "That fault was not found.");
  return forwardForm(request, `/api/v1/me/tenancies/${leaseId}/faults/${id}/photos`, "POST", "person");
}

export const dynamic = "force-dynamic";
