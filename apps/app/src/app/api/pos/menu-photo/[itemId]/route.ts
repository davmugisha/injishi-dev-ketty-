import type { NextRequest } from "next/server";
import { menuPhoto } from "@/server/pos-photo-proxy";

/** The photo uploaded for a menu item, as a JPEG (`?v=` is its version, so the browser may keep it). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  return menuPhoto(request, (await params).itemId);
}

export const dynamic = "force-dynamic";
