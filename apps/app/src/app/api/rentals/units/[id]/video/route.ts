import type { NextRequest } from "next/server";
import { forwardUpload } from "@/server/rentals/upload-proxy";

/** A unit's video tour, streamed on to `PUT /api/v1/ops/units/:id/video` (up to 100 MB, never buffered here). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return forwardUpload(request, (await params).id, "video", "PUT");
}

export const dynamic = "force-dynamic";
