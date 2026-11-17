import type { NextRequest } from "next/server";
import { forwardMenuPhotoUpload } from "@/server/pos-photo-proxy";

/** One photo for a menu item, streamed on to `POST /api/v1/ops/pos/outlets/:outletId/menu-photos` (`?outlet=`). */
export async function POST(request: NextRequest) {
  return forwardMenuPhotoUpload(request, request.nextUrl.searchParams.get("outlet") ?? "");
}

export const dynamic = "force-dynamic";
