"use client";

import { Printer } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import type { PaymentMethod, PosOrder, PosOutlet } from "@/server/pos";
import { qrMatrix, qrSvgPath } from "./qr";
import { QrCode } from "./qr-card";
import { PosDialog } from "./shared";

/**
 * The customer's receipt laid out like an RRA EBM (Electronic Billing Machine, version 2) receipt: business, items
 * with their tax label (A-EX exempt, B 18%), totals per tax label, payments, the SDC block and a QR code.
 *
 * No fiscal device (VSDC) is connected to this POS yet, so it is printed the way EBM prints a TRAINING receipt
 * ("TS"): the SDC fields say so and it carries "THIS IS NOT AN OFFICIAL RECEIPT". When the VSDC integration lands
 * the same layout is filled with the signature RRA returns.
 */
const RRA_METHOD: Record<PaymentMethod, string> = {
  cash: "CASH",
  mtn_momo: "MOBILE MONEY (MTN)",
  airtel_money: "MOBILE MONEY (AIRTEL)",
  card: "DEBIT/CREDIT CARD",
  bank_transfer: "BANK TRANSFER",
  voucher: "VOUCHER",
  customer_credit: "CREDIT",
};

const n = (v: number) => new Intl.NumberFormat("en-US").format(v);
const label = (bps: number) => (bps === 0 ? "A-EX" : "B");

export interface EbmReceipt {
  business: string;
  branch: string | null;
  /** The venue's TIN, phone and address from Setup (empty when not set). */
  tin: string;
  phone: string;
  address: string;
  header: string[];
  footer: string[];
  client: string | null;
  orderNumber: string;
  table: string | null;
  servedBy: string | null;
  lines: { name: string; quantity: number; unitRwf: number; totalRwf: number; tax: string }[];
  totalRwf: number;
  totalA: number;
  totalB: number;
  taxB: number;
  discountRwf: number;
  payments: { method: string; amountRwf: number }[];
  changeRwf: number;
  items: number;
  at: Date;
  receiptNo: string;
  qr: string;
}

export function ebmReceiptOf(order: PosOrder, outlet: PosOutlet): EbmReceipt {
  const live = order.lines.filter((l) => l.status !== "voided");
  const lines = live.map((l) => ({
    name: l.name,
    quantity: l.quantity,
    unitRwf: l.quantity ? Math.round(l.totalRwf / l.quantity) : l.unitPriceRwf,
    totalRwf: l.totalRwf,
    tax: label(l.taxRateBps),
  }));
  const totalA = live.filter((l) => l.taxRateBps === 0).reduce((s, l) => s + l.totalRwf, 0);
  const totalB = live.filter((l) => l.taxRateBps !== 0).reduce((s, l) => s + l.totalRwf, 0);
  const taxB = live.filter((l) => l.taxRateBps !== 0).reduce((s, l) => s + l.taxRwf, 0);
  const paid = order.payments.filter((p) => p.status === "successful" || p.status === "refunded");
  const at = new Date(order.settledAt ?? paid.at(-1)?.settledAt ?? order.createdAt);
  // The receipt counter of a training receipt: the order's own sequence number, read from its number.
  const seq = Number(order.orderNumber.split("-").at(-1)) || 1;
  const receiptNo = `${seq}/${seq} TS`;
  return {
    business: outlet.name.toUpperCase(),
    branch: outlet.branchName,
    tin: outlet.settings.venueTin ?? "",
    phone: outlet.settings.venuePhone ?? "",
    address: outlet.settings.venueAddress ?? "",
    header: outlet.settings.receiptHeader.split(/\r?\n/).filter(Boolean),
    footer: outlet.settings.receiptFooter.split(/\r?\n/).filter(Boolean),
    client: order.customer?.fullName ?? null,
    orderNumber: order.orderNumber,
    table: order.tableLabel,
    servedBy: order.waiterName,
    lines,
    totalRwf: order.totalRwf,
    totalA,
    totalB,
    taxB,
    discountRwf: order.discountRwf,
    // Cash shows what the guest handed over (the change is printed under it); other methods what they paid.
    payments: paid.map((p) => ({
      method: RRA_METHOD[p.method],
      amountRwf: p.method === "cash" && p.tenderedRwf ? p.tenderedRwf - p.refundedRwf : p.amountRwf - p.refundedRwf,
    })),
    changeRwf: paid.reduce((s, p) => s + p.changeRwf, 0),
    items: live.reduce((s, l) => s + l.quantity, 0),
    at,
    receiptNo,
    qr: `EBM-TRAINING|${outlet.name}|${order.orderNumber}|${receiptNo}|${order.totalRwf}|${at.toISOString()}`,
  };
}

const kigali = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", ...opts }).format(d);

/** One receipt row: words left, figure right (both in the receipt's monospace). */
function Row({ left, right, strong }: { left: string; right: string; strong?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 ${strong ? "font-bold" : ""}`}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 tabular">{right}</span>
    </p>
  );
}

function Rule() {
  return <p className="my-1.5 overflow-hidden whitespace-nowrap text-[#9ca3af]">{"-".repeat(64)}</p>;
}

export function ReceiptPaper({ r }: { r: EbmReceipt }) {
  return (
    <div
      data-ui="ebm-receipt"
      className="mx-auto w-full max-w-[340px] rounded-sm border-t-4 border-[#0b8442] bg-white px-4 py-5 font-mono text-[11.5px] leading-[1.45] text-[#111827] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]"
    >
      <p className="text-center font-bold tracking-wide">{r.business}</p>
      {r.branch ? <p className="text-center">{r.branch}</p> : null}
      {r.address ? <p className="text-center">{r.address}</p> : null}
      {r.phone ? <p className="text-center">Tel: {r.phone}</p> : null}
      {r.header.map((h) => (
        <p key={h} className="text-center">
          {h}
        </p>
      ))}
      <p className="text-center" data-ui="receipt-tin">
        {r.tin ? `TIN: ${r.tin}` : "TIN: set in Setup"} · VAT registered
      </p>
      <p className="mt-1 text-center font-bold">TRAINING MODE</p>
      <Rule />
      <p>Welcome to our {r.table ? "restaurant" : "shop"}</p>
      <p>Client: {r.client ?? "Walk-in customer"}</p>
      <p>Client TIN: -</p>
      <p>
        Order {r.orderNumber}
        {r.table ? ` · Table ${r.table}` : ""}
      </p>
      <Rule />
      {r.lines.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a receipt is static; two identical lines may repeat
        <div key={`${l.name}-${i}`} className="mb-1">
          <p className="uppercase">{l.name}</p>
          <Row left={`${n(l.unitRwf)} x ${l.quantity}`} right={`${n(l.totalRwf)} ${l.tax}`} />
        </div>
      ))}
      <Rule />
      {r.discountRwf ? <Row left="DISCOUNT" right={`-${n(r.discountRwf)}`} /> : null}
      <Row left="TOTAL" right={n(r.totalRwf)} strong />
      <Row left="TOTAL A-EX" right={n(r.totalA)} />
      <Row left="TOTAL B-18.00%" right={n(r.totalB)} />
      <Row left="TOTAL TAX B" right={n(r.taxB)} />
      <Row left="TOTAL TAX" right={n(r.taxB)} />
      <Rule />
      {r.payments.length ? (
        r.payments.map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two payments may share a method and an amount
          <Row key={`${p.method}-${i}`} left={p.method} right={n(p.amountRwf)} />
        ))
      ) : (
        <Row left="NOT PAID YET" right={n(r.totalRwf)} />
      )}
      {r.changeRwf ? <Row left="CHANGE" right={n(r.changeRwf)} /> : null}
      <Row left="ITEMS NUMBER" right={String(r.items)} />
      <Rule />
      <p className="text-center font-bold">SDC INFORMATION</p>
      <Row left="Date:" right={kigali(r.at, { day: "2-digit", month: "2-digit", year: "numeric" })} />
      <Row
        left="Time:"
        right={kigali(r.at, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      />
      <Row left="SDC ID:" right="not connected" />
      <Row left="RECEIPT NUMBER:" right={r.receiptNo} />
      <p className="mt-1 text-center">Internal Data:</p>
      <p className="text-center tracking-widest">TRAINING-NO-SIGNATURE</p>
      <p className="mt-1 text-center">Receipt Signature:</p>
      <p className="text-center tracking-widest">TRAINING-NO-SIGNATURE</p>
      <div className="my-2 flex justify-center">
        <QrCode value={r.qr} size={104} label="Receipt QR code" />
      </div>
      <Rule />
      <Row left="RECEIPT NUMBER:" right={r.orderNumber} />
      <Row left="DATE:" right={kigali(r.at, { day: "2-digit", month: "2-digit", year: "numeric" })} />
      <Row left="MRC:" right="not connected" />
      {r.servedBy ? <Row left="SERVED BY:" right={r.servedBy} /> : null}
      <Rule />
      <p className="text-center font-bold">THIS IS NOT AN OFFICIAL RECEIPT</p>
      {r.footer.map((f) => (
        <p key={f} className="text-center">
          {f}
        </p>
      ))}
      <p className="text-center">THANK YOU, COME BACK AGAIN</p>
      <p className="mt-1 text-center text-[10px] text-[#6b7280]">EBM v2 layout · Injishi POS</p>
    </div>
  );
}

/**
 * A sample receipt for the Setup preview: the venue's details and receipt text as they are being typed, with two
 * example lines (one taxed, one exempt). Nothing is saved or sent; it shows what a guest's receipt will look like.
 */
export function previewReceiptOf(
  outlet: Pick<PosOutlet, "name" | "branchName">,
  s: { venueTin: string; venuePhone: string; venueAddress: string; receiptHeader: string; receiptFooter: string },
): EbmReceipt {
  const lines = [
    { name: "Brochettes (example)", quantity: 2, unitRwf: 3_500, totalRwf: 7_000, tax: "B" },
    { name: "Water 500 ml (example)", quantity: 1, unitRwf: 1_000, totalRwf: 1_000, tax: "A-EX" },
  ];
  const taxB = Math.round((7_000 * 18) / 118);
  return {
    business: outlet.name.toUpperCase(),
    branch: outlet.branchName,
    tin: s.venueTin.trim(),
    phone: s.venuePhone.trim(),
    address: s.venueAddress.trim(),
    header: s.receiptHeader.split(/\r?\n/).filter((l) => l.trim()),
    footer: s.receiptFooter.split(/\r?\n/).filter((l) => l.trim()),
    client: null,
    orderNumber: "POS-PREVIEW-0001",
    table: "T1",
    servedBy: "Waiter",
    lines,
    totalRwf: 8_000,
    totalA: 1_000,
    totalB: 7_000,
    taxB,
    discountRwf: 0,
    payments: [{ method: RRA_METHOD.cash, amountRwf: 10_000 }],
    changeRwf: 2_000,
    items: 3,
    at: new Date(),
    receiptNo: "1/1 TS",
    qr: `EBM-TRAINING|${outlet.name}|PREVIEW`,
  };
}

/** Prints the receipt on its own 80 mm page (a thermal printer's width) from a new window. */
function printReceipt(r: EbmReceipt) {
  const win = window.open("", "_blank", "width=420,height=900");
  if (!win) return;
  const el = document.querySelector('[data-ui="ebm-receipt"]');
  const m = qrMatrix(r.qr);
  const size = m.length + 8;
  const html = (el?.outerHTML ?? "").replace(
    /<svg[\s\S]*?<\/svg>/,
    `<svg viewBox="0 0 ${size} ${size}" width="104" height="104" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${qrSvgPath(m)}" fill="#000"/></svg>`,
  );
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${r.orderNumber}</title><style>@page{size:80mm auto;margin:3mm}body{margin:0;font:11px/1.45 ui-monospace,Consolas,monospace;color:#000}p{margin:0}.flex{display:flex}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.text-center{text-align:center}.font-bold{font-weight:700}.uppercase{text-transform:uppercase}.my-1\\.5{margin:4px 0}.mt-1{margin-top:4px}.mb-1{margin-bottom:4px}.my-2{margin:8px 0}.overflow-hidden{overflow:hidden}.whitespace-nowrap{white-space:nowrap}</style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`,
  );
  win.document.close();
}

export function ReceiptDialog({ order, outlet, onClose }: { order: PosOrder; outlet: PosOutlet; onClose: () => void }) {
  const r = ebmReceiptOf(order, outlet);
  return (
    <PosDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Receipt · ${order.orderNumber}`}
      subtitle="RRA EBM layout in training mode: no fiscal device (VSDC) is connected to this POS yet."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
          <Button onPress={() => printReceipt(r)}>
            <Printer className="size-4" />
            Print receipt
          </Button>
        </>
      }
    >
      <div className="max-h-[64vh] overflow-y-auto rounded-2xl bg-[var(--pos-band)] p-4">
        <ReceiptPaper r={r} />
      </div>
    </PosDialog>
  );
}
