import { forwardTableOrder } from "@/server/table-order";

/** A guest sends their cart from the QR on their table (migration 0156). The API resolves the table and prices it. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return forwardTableOrder(request, (await params).code);
}

export const dynamic = "force-dynamic";
