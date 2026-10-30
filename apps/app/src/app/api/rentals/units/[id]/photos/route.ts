import type { NextRequest } from "next/server";
import { forwardUpload } from "@/server/rentals/upload-proxy";

/** One photo of a unit, streamed on to `POST /api/v1/ops/units/:id/photos`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return forwardUpload(request, (await params).id, "photos", "POST");
}

export const dynamic = "force-dynamic";
