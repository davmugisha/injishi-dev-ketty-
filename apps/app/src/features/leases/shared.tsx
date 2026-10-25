import {
  ID_KIND_LABEL,
  LEASE_TAB_LABEL,
  type LeaseContract,
  LeaseContract as LeaseContractSchema,
  type LeaseContractView,
  type LeaseEventKind,
  type LeaseEventView,
  type LeaseSigningMethod,
  type LeaseStatus,
  LeaseTab,
  ordinal,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import { formatDay, formatMoney, type StatusTone, type TimelineEvent } from "@injishi/ui";

export const LEASE_TABS = LeaseTab.options;
export const TAB_LABEL = LEASE_TAB_LABEL;

export const leaseHref = (id: string): string => `${screenHref("Leases")}/${encodeURIComponent(id)}`;
export const tenantHomeHref = (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}`;
export const tenantLeaseHref = (leaseId: string): string => `${tenantHomeHref(leaseId)}/lease`;
export const tenantGuestsHref = (leaseId: string): string => `${tenantHomeHref(leaseId)}/guests`;
export const tenantRentHref = (leaseId: string): string => `${tenantHomeHref(leaseId)}/rent`;
/** The tenant's lease PDF and a payment's receipt, from the app's own origin. */
export const tenantPdfHref = (leaseId: string): string => `/api/tenancies/${encodeURIComponent(leaseId)}/contract`;
export const receiptHref = (leaseId: string, paymentId: string): string =>
  `/api/tenancies/${encodeURIComponent(leaseId)}/payments/${encodeURIComponent(paymentId)}/receipt`;

/** The record's tabs, as `?tab=` names them. */
export const RECORD_TABS = ["overview", "contract", "rent", "deposit", "timeline", "guests"] as const;
export type RecordTab = (typeof RECORD_TABS)[number];
export const RECORD_TAB_LABEL: Record<RecordTab, string> = {
  overview: "Overview",
  contract: "Contract",
  rent: "Rent",
  deposit: "Deposit",
  timeline: "Timeline",
  guests: "Guests",
};

/** The frozen text as template 3, or null for a version carried over from before. */
export function contractOf(view: Pick<LeaseContractView, "content"> | null | undefined): LeaseContract | null {
  if (!view) return null;
  const parsed = LeaseContractSchema.safeParse(view.content);
  return parsed.success ? parsed.data : null;
}

export const SIGNING_METHOD_WORDS: Record<LeaseSigningMethod, string> = {
  email_code: "Confirmed with a code emailed to them",
  password: "Confirmed with their password",
  legacy: "Signed before e-signatures were recorded",
};

export const ID_WORDS = ID_KIND_LABEL;

export const days = (n: number): string => `${n} ${n === 1 ? "day" : "days"}`;

/** "Due on the 5th of each month". */
export const dueDayWords = (day: number): string => `The ${ordinal(day)} of each month`;

/** Can this lease still be edited (draft or out for signature)? */
export const editable = (status: LeaseStatus): boolean => status === "draft" || status === "pending_signature";
/** Can this lease still be cancelled (never started)? */
export const cancellable = (status: LeaseStatus): boolean =>
  status === "draft" || status === "pending_signature" || status === "signed";

const EVENT_WORDS: Record<LeaseEventKind, { title: string; tone?: StatusTone }> = {
  created: { title: "Lease drafted" },
  terms_edited: { title: "Terms changed" },
  tenant_updated: { title: "Tenant details changed" },
  landlord_signed: { title: "Landlord signed", tone: "success" },
  landlord_signature_voided: { title: "Landlord's signature voided", tone: "warning" },
  invitation_sent: { title: "Invitation emailed to the tenant", tone: "info" },
  invitation_resent: { title: "Invitation emailed again", tone: "info" },
  invitation_accepted: { title: "Tenant accepted the invitation", tone: "success" },
  tenant_signed: { title: "Tenant signed", tone: "success" },
  signed_copy_ready: { title: "Signed copy ready", tone: "success" },
  started: { title: "Tenancy started", tone: "success" },
  cancelled: { title: "Lease cancelled", tone: "danger" },
  charge_raised: { title: "Charge raised", tone: "info" },
  charge_waived: { title: "Charge waived", tone: "warning" },
  payment_received: { title: "Payment received", tone: "success" },
  payment_recorded: { title: "Payment recorded", tone: "success" },
  payment_failed: { title: "Payment failed", tone: "danger" },
  payment_reversed: { title: "Payment reversed", tone: "warning" },
  reminder_sent: { title: "Reminder sent", tone: "info" },
  deposit_received: { title: "Deposit received", tone: "success" },
  deposit_settled: { title: "Deposit settled", tone: "success" },
  deposit_disputed: { title: "Deposit disputed", tone: "danger" },
  notice_filed: { title: "Move out notice given", tone: "warning" },
  notice_acknowledged: { title: "Notice acknowledged" },
  notice_withdrawn: { title: "Notice withdrawn" },
  ending: { title: "Lease ending soon", tone: "warning" },
  moved_out: { title: "Moved out" },
  filing_due: { title: "RRA filing due", tone: "warning" },
  filed: { title: "Filed with RRA", tone: "success" },
  renewed: { title: "Renewed" },
  broker_rated: { title: "Broker rated" },
};

function detailOf(e: LeaseEventView): string | null {
  const p = e.payload;
  const parts: string[] = [];
  if (e.actorName) parts.push(e.actorRole === "system" ? "Injishi" : e.actorName);
  else if (e.actorRole === "system") parts.push("Injishi");
  if (e.kind === "charge_raised") {
    const kind = p.kind === "deposit" ? "Deposit" : "Rent";
    const amount = typeof p.amountRwf === "number" ? formatMoney(p.amountRwf) : null;
    const due = typeof p.dueOn === "string" ? `due ${formatDay(p.dueOn)}` : null;
    parts.push([kind, amount, due].filter(Boolean).join(", "));
  } else if (typeof p.amountRwf === "number") {
    parts.push(formatMoney(p.amountRwf));
  }
  if (typeof p.reason === "string" && e.kind !== "ending") parts.push(p.reason);
  if (typeof p.version === "number") parts.push(`Contract version ${p.version}`);
  if (typeof p.email === "string") parts.push(p.email);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A lease's events as the timeline shows them, oldest first. */
export function timelineOf(events: readonly LeaseEventView[]): TimelineEvent[] {
  return [...events]
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    .map((e) => {
      const words = EVENT_WORDS[e.kind] ?? { title: e.kind.replace(/_/g, " ") };
      return { id: e.id, title: words.title, detail: detailOf(e), at: e.occurredAt, tone: words.tone };
    });
}
