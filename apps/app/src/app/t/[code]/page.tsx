import type { Metadata, Viewport } from "next";
import { TableOrderApp } from "@/features/table-order/table-order-app";
import { readTableMenu } from "@/server/table-order";

export const metadata: Metadata = { title: "Order from your table", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#EDF1EE" };

/**
 * The page a table's QR opens on a guest's phone (migration 0156). Public: the code in the address is the key, and
 * it opens that one table's menu. An unknown, malformed or replaced code reads as a QR that is not linked to a table.
 */
export default async function TableOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const read = await readTableMenu(code);
  if (read.state !== "open") {
    return (
      <main
        data-ui="table-order-missing"
        className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <h1 className="text-[22px] font-bold">
          {read.state === "missing" ? "This QR code is not linked to a table" : "The menu could not be loaded"}
        </h1>
        <p className="text-[14px] text-muted">
          {read.state === "missing"
            ? "It may be an old card. Please ask a member of staff to take your order."
            : "Check your connection and scan the code again, or ask a member of staff."}
        </p>
      </main>
    );
  }
  return <TableOrderApp code={code} menu={read.menu} />;
}

export const dynamic = "force-dynamic";
