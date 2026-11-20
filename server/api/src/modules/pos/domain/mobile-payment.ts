import { z } from 'zod';

/**
 * MOBILE MONEY PAID FROM THE CUSTOMER'S PHONE, CONFIRMED BY A PERSON.
 *
 * The customer pays the venue's MTN MoMo or Airtel Money account from their own phone. Nothing here contacts MTN or
 * Airtel: there is no provider integration, so no answer from one is ever invented. The flow is:
 *
 *   1. The waiter (or the cashier) presses Pay: a payment is recorded as PENDING, never as paid.
 *   2. The cashier sees it on the Cashier Desk, checks that the money really arrived on the venue's account, and
 *      presses Confirm (or "Not received").
 *   3. Only that confirmation makes the payment successful; the name of the cashier and the instant are kept in the
 *      payment's event trail and the audit log.
 */

/** The methods a person confirms by hand on the Cashier Desk. */
export const MANUAL_MOBILE_METHODS = ['mtn_momo', 'airtel_money'] as const;
export type ManualMobileMethod = (typeof MANUAL_MOBILE_METHODS)[number];

export function isManualMobile(method: string): method is ManualMobileMethod {
  return (MANUAL_MOBILE_METHODS as readonly string[]).includes(method);
}

export const MOBILE_LABEL: Readonly<Record<ManualMobileMethod, string>> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
};

/** A phone number as a person types it: digits, spaces, dashes, brackets and one leading +; 9 to 15 digits. */
export function cleanPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  // A Rwandan number typed the local way (07…): give it the country code, so every payer reads the same.
  if (digits.length === 10 && digits.startsWith('07')) return `+250${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `+250${digits}`;
  return `+${digits}`;
}

export const StartMobilePaymentRequest = z.object({
  method: z.enum(MANUAL_MOBILE_METHODS),
  amountRwf: z.number().int().positive().max(100_000_000),
  payerPhone: z
    .string()
    .max(32)
    .refine((v) => cleanPhone(v) !== null, 'Enter the phone number the customer pays from, like 078 812 3456.'),
  idempotencyKey: z.string().min(8).max(100),
});
export type StartMobilePaymentRequest = z.infer<typeof StartMobilePaymentRequest>;

export const ConfirmMobilePaymentRequest = z.object({
  /** The transaction ID in the provider's message on the venue's phone, when the cashier has it. Optional. */
  transactionId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9._-]*$/, 'A transaction ID has letters, digits, dots and dashes only.')
    .optional(),
});
export type ConfirmMobilePaymentRequest = z.infer<typeof ConfirmMobilePaymentRequest>;

export const RejectMobilePaymentRequest = z.object({
  reason: z.string().trim().min(3, 'Say why, in a few words.').max(300),
});
export type RejectMobilePaymentRequest = z.infer<typeof RejectMobilePaymentRequest>;

export const EmailReceiptRequest = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]+$/, 'Enter one email address, like name@example.com.'),
});
export type EmailReceiptRequest = z.infer<typeof EmailReceiptRequest>;

/** `someone@example.com` -> `so•••@example.com`: what the audit keeps of a guest's address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  return `${email.slice(0, Math.min(2, at))}•••${email.slice(at)}`;
}

// --- What the screens read -----------------------------------------------------------------------------------------

/** One payment waiting for the cashier, on the Cashier Desk. */
export interface PosAwaitingPayment {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  orderType: string;
  tableLabel: string | null;
  customerName: string | null;
  customerPhoneMasked: string | null;
  payerPhoneMasked: string | null;
  method: string;
  amountRwf: number;
  /** The POS reference of this payment (minted here, not by a provider). */
  reference: string;
  status: string;
  startedAt: string;
  startedByName: string | null;
  waiterName: string | null;
  /** True for MTN MoMo and Airtel Money: the cashier confirms them by hand. */
  confirmable: boolean;
}

/** A payment the cashier answered recently: the desk's short history. */
export interface PosPaymentDecision {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  method: string;
  amountRwf: number;
  outcome: 'confirmed' | 'not_received';
  byName: string | null;
  at: string;
  note: string | null;
}

export interface PosAwaitingPayments {
  awaiting: PosAwaitingPayment[];
  recent: PosPaymentDecision[];
}

/** What the waiter is told after the cashier answered a payment on one of the waiter's bills. */
export interface PosPaymentUpdate {
  /** The payment event's id: what the waiter's screen dismisses. */
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  orderType: string;
  tableLabel: string | null;
  tableId: string | null;
  tableSessionId: string | null;
  /** The table's sitting is still open: the waiter can release the table once the guests leave. */
  sessionOpen: boolean;
  tableStatus: string | null;
  method: string;
  amountRwf: number;
  outcome: 'confirmed' | 'not_received';
  /** The bill has nothing left to pay and nothing in flight. */
  billFullyPaid: boolean;
  outstandingRwf: number;
  byName: string | null;
  at: string;
}

// --- The receipt sent by email -------------------------------------------------------------------------------------

export interface ReceiptMailInput {
  venueName: string;
  venueTin: string;
  venuePhone: string;
  venueAddress: string;
  footer: string;
  orderNumber: string;
  tableLabel: string | null;
  orderType: string;
  at: Date;
  lines: { name: string; quantity: number; totalRwf: number }[];
  taxMode: 'exclusive' | 'inclusive';
  grossRwf: number;
  discountRwf: number;
  taxRwf: number;
  totalRwf: number;
  payments: { method: string; amountRwf: number; reference: string }[];
}

const rwf = (n: number) => `RWF ${n.toLocaleString('en-US')}`;

const METHOD_NAME: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  voucher: 'Voucher',
  customer_credit: 'Customer account',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** The subject, the plain text and the HTML of a receipt mail. Every value is escaped; nothing is taken from a client. */
export function receiptMail(r: ReceiptMailInput): { subject: string; text: string; html: string } {
  const when = r.at.toLocaleString('en-GB', { timeZone: 'Africa/Kigali', dateStyle: 'medium', timeStyle: 'short' });
  const where = r.tableLabel ? `Table ${r.tableLabel}` : r.orderType === 'delivery' ? 'Delivery' : 'Takeaway';
  const vat = r.taxMode === 'inclusive' ? 'VAT (included)' : 'VAT (added)';
  const totals: [string, string][] = [
    ['Subtotal', rwf(r.grossRwf)],
    ...(r.discountRwf ? ([['Discounts', `-${rwf(r.discountRwf)}`]] as [string, string][]) : []),
    [vat, rwf(r.taxRwf)],
    ['Total', rwf(r.totalRwf)],
  ];
  const head = [r.venueName, r.venueAddress, r.venuePhone ? `Tel ${r.venuePhone}` : '', r.venueTin ? `TIN ${r.venueTin}` : '']
    .filter(Boolean);
  const notice = 'This is a copy of your receipt from the point of sale. It is not an EBM fiscal invoice.';
  const text = [
    ...head,
    '',
    `Receipt ${r.orderNumber} · ${where}`,
    when,
    '',
    ...r.lines.map((l) => `${l.quantity} x ${l.name}  ${rwf(l.totalRwf)}`),
    '',
    ...totals.map(([k, v]) => `${k}: ${v}`),
    '',
    'Paid',
    ...r.payments.map((p) => `${METHOD_NAME[p.method] ?? p.method}: ${rwf(p.amountRwf)} (ref ${p.reference})`),
    '',
    r.footer || 'Thank you for your visit.',
    '',
    notice,
  ].join('\n');
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:2px 0${strong ? ';font-weight:700' : ''}">${escapeHtml(k)}</td><td style="padding:2px 0;text-align:right${strong ? ';font-weight:700' : ''}">${escapeHtml(v)}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:420px;margin:24px auto;background:#fff;border-radius:12px;padding:24px">
<div style="text-align:center">${head.map((h, i) => `<div style="${i === 0 ? 'font-size:18px;font-weight:700' : 'font-size:12px;color:#555'}">${escapeHtml(h)}</div>`).join('')}</div>
<hr style="border:0;border-top:1px dashed #ccc;margin:16px 0">
<div style="font-size:13px"><b>Receipt ${escapeHtml(r.orderNumber)}</b> · ${escapeHtml(where)}<br><span style="color:#555">${escapeHtml(when)}</span></div>
<table style="width:100%;font-size:13px;margin-top:12px;border-collapse:collapse">${r.lines.map((l) => row(`${l.quantity} × ${l.name}`, rwf(l.totalRwf))).join('')}</table>
<hr style="border:0;border-top:1px dashed #ccc;margin:12px 0">
<table style="width:100%;font-size:13px;border-collapse:collapse">${totals.map(([k, v]) => row(k, v, k === 'Total')).join('')}</table>
<hr style="border:0;border-top:1px dashed #ccc;margin:12px 0">
<table style="width:100%;font-size:13px;border-collapse:collapse">${r.payments.map((p) => row(`${METHOD_NAME[p.method] ?? p.method} · ${p.reference}`, rwf(p.amountRwf))).join('')}</table>
<p style="text-align:center;font-size:13px;margin:16px 0 4px">${escapeHtml(r.footer || 'Thank you for your visit.')}</p>
<p style="text-align:center;font-size:11px;color:#777;margin:0">${escapeHtml(notice)}</p>
</div></body></html>`;
  return { subject: `Your receipt ${r.orderNumber} from ${r.venueName}`.replace(/[\r\n]+/g, ' ').slice(0, 200), text, html };
}
