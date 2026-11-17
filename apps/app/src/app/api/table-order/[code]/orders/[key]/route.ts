import { forwardTableOrderStatus } from "@/server/table-order";

/** The progress of the order this phone sent from this table, by the key the phone made for its cart. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string; key: string }> }) {
  const { code, key } = await params;
  return forwardTableOrderStatus(request, code, key);
}

export const dynamic = "force-dynamic";
