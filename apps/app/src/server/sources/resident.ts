/**
 * Live sources for the resident area: the tenant's phone, from `GET /api/v1/me/residence` (their own
 * tenancies and what hangs off them; ownership is the API's guard) and `GET /api/v1/me/threads` (their
 * conversations with management), presented as the resident fixture documents.
 */
import type { PersonaId } from "@injishi/data";
import type * as R from "@injishi/data/fixtures/resident";
import { clock, dayMonth, dayMonthYear, kigaliDate } from "../format";
import {
  type ApiLease,
  type ApiResidenceView,
  addDays,
  Building,
  daysBetween,
  METHOD_LABEL,
  monthName,
  ordinal,
  weekday,
  weekdayShort,
  windowOf,
} from "./residence";
import { defineSources, type SourceContext } from "./types";

/** GET /api/v1/me/threads (GuestThread in @injishi/contracts), the fields read here. */
interface ApiGuestThread {
  id: string;
  scope: "booking" | "stay" | "lease";
  subjectId: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}
/** GET /api/v1/me/threads/:id/messages (GuestMessagePage), newest first. */
interface ApiGuestMessage {
  id: string;
  threadId: string;
  senderName: string | null;
  /** True when the reader sent it. */
  fromUs: boolean;
  bodyType: "text" | "image" | "voice" | "system";
  body: string | null;
  createdAt: string;
}

const reads = new WeakMap<SourceContext, Promise<Building>>();

/** The tenant's own copy, once per request. */
export function readTenancy(ctx: SourceContext): Promise<Building> {
  let read = reads.get(ctx);
  if (!read) {
    read = ctx.api.get<ApiResidenceView>("/api/v1/me/residence").then((v) => new Building(v, ctx.today.iso));
    reads.set(ctx, read);
  }
  return read;
}

export function forgetTenancy(ctx: SourceContext): void {
  reads.delete(ctx);
}

const isCurrent = (l: ApiLease) => l.status === "active" || l.status === "ending";
/** "Saturday 14 November 2026". */
const longDate = (iso: string) => `${weekday(iso)} ${Number(iso.slice(8))} ${monthName(iso)} ${iso.slice(0, 4)}`;
/** "Thursday 15 October". */
const dayLong = (iso: string) => `${weekday(iso)} ${Number(iso.slice(8))} ${monthName(iso)}`;
/** "102 345 990" from a nine digit TIN. */
const spacedTin = (tin: string) => tin.replace(/(\d{3})(?=\d)/g, "$1 ");

const NOTICE_ICON: [RegExp, string][] = [
  [/water/i, "Droplet"],
  [/renewal/i, "ArrowsRotateRight"],
  [/visitor|code/i, "Key"],
  [/rent|payment/i, "Wallet"],
];

async function threadsOf(
  ctx: SourceContext,
  b: Building,
): Promise<(ApiGuestThread & { title: string; ref: string | null })[]> {
  const { threads } = await ctx.api.get<{ threads: ApiGuestThread[] }>("/api/v1/me/threads");
  const leases = new Set(b.v.leases.map((l) => l.id));
  return threads
    .filter((t) => t.scope === "lease" && leases.has(t.subjectId))
    .map((t) => {
      const ticket = b.v.tickets.find((x) => x.threadId === t.id);
      return { ...t, title: ticket?.title ?? "Management", ref: ticket?.reference ?? null };
    });
}

export const sources = defineSources({
  "resident.tenancies": {
    naturalKey: "id",
    async list(ctx): Promise<R.Tenancy[]> {
      const b = await readTenancy(ctx);
      const property = b.v.property;
      return b.v.leases.filter(isCurrent).map((l) => {
        const notice = b.notice(l.id);
        const offer = b.offer(l.id);
        // A term the lease does not record is said to be not on file, never a made-up 30 days or a lease ending today.
        const period = l.noticePeriodDays;
        const end = l.endDate;
        const earliest = addDays(b.today, period ?? 0);
        const status = notice
          ? { status: "Notice given", statusTone: "accent" as const }
          : offer?.status === "accepted" || offer?.status === "signed"
            ? { status: "Renewing", statusTone: "info" as const }
            : { status: "Active", statusTone: "success" as const };
        return {
          id: l.reference ?? l.id,
          persona: (ctx.persona?.id ?? "resident") as PersonaId,
          unit: l.unitLabel,
          property: property?.name ?? "",
          landlord: property?.landlord ?? "",
          landlordTin: property?.tin ? `TIN ${spacedTin(property.tin)}` : property?.upi ? `UPI ${property.upi}` : "",
          ...status,
          term: `${l.startDate ? dayMonthYear(l.startDate) : ""} – ${end ? dayMonthYear(end) : "no end date on file"}`,
          endsOn: end ? dayMonthYear(end) : "a date not on file",
          endsShort: end ? dayMonth(end) : "on a date not on file",
          rent: l.monthlyRentRwf ?? 0,
          rentDue: l.rentDueDay
            ? `On the ${ordinal(l.rentDueDay)}${l.graceDays !== null && l.graceDays !== undefined ? ` · ${l.graceDays}-day grace` : ""}`
            : "Due day not on file",
          noticePeriod: period !== null && period !== undefined ? `${period} days in writing` : "Not on file",
          deposit: l.cautionRwf ?? 0,
          depositSince: l.startDate ? dayMonthYear(l.startDate) : "",
          occupants: l.occupants ? `You and ${l.occupants}` : "You",
          moveOutDefault: longDate(end ?? earliest),
          earliestMoveOut: dayMonth(earliest),
          notice: notice
            ? {
                moveOut: dayMonthYear(notice.moveOutDate),
                reason: notice.reasonCode ?? "",
                note: notice.message ?? "",
                sentAt: `${dayMonth(notice.filedAt)} ${clock(notice.filedAt)}`,
              }
            : null,
        };
      });
    },
  },
  // Keyed by the rent month ("2026-10"): the prototype's October is whichever month it is now.
  "resident.rentCharges": {
    parity: "shape",
    async list(ctx): Promise<R.RentCharge[]> {
      const b = await readTenancy(ctx);
      return b.v.leases.filter(isCurrent).flatMap((l) => {
        const c = b.charge(l.id, b.month);
        if (!c) return [];
        const owed = Math.max(0, c.amountRwf - c.paidAmountRwf);
        const due = c.dueDate ?? c.periodMonth;
        const days = daysBetween(b.today, due);
        const flight = b.inFlight(c.id);
        const status =
          owed === 0
            ? { status: "Paid", statusTone: "success" as const }
            : flight.length
              ? { status: "Payment pending", statusTone: "info" as const }
              : days < 0
                ? { status: "Overdue", statusTone: "danger" as const }
                : { status: "Not paid yet", statusTone: "default" as const };
        return [
          {
            id: c.periodMonth.slice(0, 7),
            lease: l.reference ?? l.id,
            month: monthName(c.periodMonth),
            amount: owed,
            due: dayLong(due),
            dueShort: dayMonth(due),
            dueIn:
              days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days} days` : `${-days} days overdue`,
            ...status,
          },
        ];
      });
    },
  },
  // Keyed by the rent month a payment paid ("2026-09"), newest first.
  "resident.receipts": {
    parity: "shape",
    async list(ctx): Promise<R.RentReceipt[]> {
      const b = await readTenancy(ctx);
      const months = new Map(b.v.charges.map((c) => [c.id, c.periodMonth]));
      return b.v.payments
        .filter((p) => p.status === "verified")
        .sort((x, y) => (y.verifiedAt ?? y.receivedAt).localeCompare(x.verifiedAt ?? x.receivedAt))
        .map((p) => {
          const verified = p.verifiedAt ?? p.receivedAt;
          const period = months.get(p.rentChargeId) ?? kigaliDate(p.receivedAt);
          return {
            id: period.slice(0, 7),
            month: monthName(period),
            amount: p.amountRwf,
            verifiedAt: `${dayMonth(verified)} ${clock(verified)}`,
            network: METHOD_LABEL[p.method],
            providerRef: p.providerRef,
          };
        });
    },
  },
  // A notice names the day it is about ("Water off in Block B on Wednesday"), which moves with the calendar.
  "resident.notices": {
    parity: "shape",
    async list(ctx): Promise<R.ResidentNotice[]> {
      const b = await readTenancy(ctx);
      return b.v.notifications.map((n) => ({
        id: n.id,
        icon: NOTICE_ICON.find(([re]) => re.test(`${n.title} ${n.body ?? ""}`))?.[1] ?? "Bell",
        title: n.title,
        desc: n.body ?? "",
        isNew: n.readAt === null,
      }));
    },
  },
  "resident.repairs": {
    naturalKey: "title",
    async list(ctx): Promise<R.RepairRequest[]> {
      const b = await readTenancy(ctx);
      const open = (s: string) => s === "open" || s === "assigned" || s === "in_progress";
      return b.v.tickets
        .filter((t) => t.status !== "cancelled")
        .sort((x, y) => Number(open(y.status)) - Number(open(x.status)) || y.createdAt.localeCompare(x.createdAt))
        .map((t) => {
          const ref = t.reference ?? "Repair";
          const done = t.status === "resolved" || t.status === "closed";
          const visit = t.scheduledFor
            ? ` · ${t.assignedContractor ? "visit" : "booked"} ${weekdayShort(t.scheduledFor)} ${dayMonth(t.scheduledFor)}${t.visitWindow ? `, ${t.visitWindow}` : ""}`
            : "";
          const desc = done
            ? `${ref} · fixed ${dayMonth(t.resolvedAt ?? t.createdAt)}${t.status === "closed" ? " · you confirmed it works" : ""}`
            : `${ref} · sent ${dayMonth(t.createdAt)}${visit}${t.staffMayEnter ? " · staff may enter" : ""}`;
          const state =
            t.status === "closed"
              ? { state: "Closed", tone: "success" as const }
              : t.status === "resolved"
                ? { state: "Fixed", tone: "success" as const }
                : t.status === "in_progress"
                  ? { state: "In progress", tone: "info" as const }
                  : t.status === "assigned"
                    ? { state: "Assigned", tone: "info" as const }
                    : { state: "Submitted", tone: "warning" as const };
          return { id: t.reference ?? t.id, title: t.title, desc, ...state };
        });
    },
  },
  "resident.visitors": {
    naturalKey: "name",
    async list(ctx): Promise<R.VisitorPass[]> {
      const b = await readTenancy(ctx);
      const upcoming = (s: string) => s === "expected" || s === "approved";
      return b.v.passes
        .filter((p) => p.status !== "revoked")
        .sort(
          (x, y) =>
            Number(upcoming(y.status)) - Number(upcoming(x.status)) ||
            (upcoming(x.status) ? x.validFrom.localeCompare(y.validFrom) : y.validFrom.localeCompare(x.validFrom)),
        )
        .map((p) => {
          if (p.status === "used") {
            const came = p.usedAt ?? p.validFrom;
            return {
              id: p.id,
              name: p.visitorName,
              desc: `${dayMonth(came)} · arrived ${clock(came)}${p.leftAt ? ` · left ${clock(p.leftAt)}` : ""}`,
              state: "Visited",
              tone: "default" as const,
              code: "",
            };
          }
          const window = windowOf(b.today, p.validFrom, p.validTo);
          return {
            id: p.id,
            name: p.visitorName,
            desc: p.kind === "contractor" ? `${window} · arranged by management for your repair` : window,
            state: p.status === "approved" ? "Approved" : p.status === "expired" ? "Expired" : "Expected",
            tone:
              p.status === "approved"
                ? ("success" as const)
                : p.status === "expired"
                  ? ("default" as const)
                  : ("info" as const),
            code: p.status === "expired" ? "" : p.code,
          };
        });
    },
  },
  "resident.renewalOffers": {
    naturalKey: "lease",
    async list(ctx): Promise<R.RenewalOffer[]> {
      const b = await readTenancy(ctx);
      return b.v.offers.flatMap((o) => {
        const l = b.leaseById.get(o.leaseId);
        if (!l) return [];
        const status: R.RenewalOffer["status"] =
          o.status === "open" ? "open" : o.status === "accepted" || o.status === "signed" ? "accepted" : "declined";
        return [
          {
            id: o.id,
            lease: l.reference ?? l.id,
            status,
            answerBy: `${weekdayShort(o.answerBy)} ${dayMonth(o.answerBy)}`,
            answerByDay: weekday(o.answerBy),
            months: o.termMonths,
            starts: dayMonth(o.startsOn),
            term: `${dayMonthYear(o.startsOn)} – ${dayMonthYear(o.endsOn)}`,
            rent: o.offeredRentRwf,
            currentRent: l.monthlyRentRwf ?? 0,
            depositTopUp: o.depositTopupRwf,
            otherTerms: o.otherTerms ?? "Unchanged",
          },
        ];
      });
    },
  },
  "resident.threads": {
    naturalKey: "title",
    async list(ctx): Promise<R.MessageThread[]> {
      const b = await readTenancy(ctx);
      const property = b.v.property?.name ?? "the residence";
      return (await threadsOf(ctx, b)).map((t) => ({
        id: t.id,
        icon: t.ref ? "Wrench" : "Comment",
        title: t.title,
        subtitle: `With ${property.replace(/ Residences$/, "")} management${t.ref ? ` · repair ${t.ref}` : ""}`,
        preview: t.lastMessagePreview ?? "",
        unread: t.unreadCount,
      }));
    },
  },
  "resident.messages": {
    naturalKey: "text",
    async list(ctx): Promise<R.ThreadMessage[]> {
      const b = await readTenancy(ctx);
      const threads = await threadsOf(ctx, b);
      const pages = await Promise.all(
        threads.map((t) =>
          ctx.api.get<{ messages: ApiGuestMessage[] }>(`/api/v1/me/threads/${encodeURIComponent(t.id)}/messages`, {
            query: { limit: 100 },
          }),
        ),
      );
      return pages.flatMap((page) =>
        [...page.messages]
          .filter((m) => m.bodyType === "text" && m.body)
          .reverse()
          .map((m) => ({
            id: m.id,
            thread: m.threadId,
            from: m.fromUs ? ("resident" as const) : ("management" as const),
            text: m.body ?? "",
            meta: `${m.fromUs ? "You" : (m.senderName ?? "Management")} · ${dayMonth(m.createdAt)} ${clock(m.createdAt)}`,
          })),
      );
    },
  },
});
