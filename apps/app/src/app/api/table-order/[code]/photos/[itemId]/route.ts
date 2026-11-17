import { forwardTablePhoto } from "@/server/table-order";

/** The photo uploaded for an item on this table's menu, as a JPEG (`?v=` is its version). */
export async function GET(request: Request, { params }: { params: Promise<{ code: string; itemId: string }> }) {
  const { code, itemId } = await params;
  return forwardTablePhoto(request, code, itemId);
}

export const dynamic = "force-dynamic";
