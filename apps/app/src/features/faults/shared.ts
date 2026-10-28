import {
  FAULT_STATUS_LABEL,
  type FaultEventView,
  type FaultPaymentStatus,
  type MaintenanceStatus,
} from "@injishi/contracts";
import { daysBetween, kigaliDay, type StatusTone, type TimelineEvent } from "@injishi/ui";

export const faultsHref = (id?: string): string => (id ? `/faults?fault=${encodeURIComponent(id)}` : "/faults");
export const tenantFaultsHref = (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}/faults`;

/** The board's columns: every state a fault is worked in, then Fixed. */
export const BOARD_COLUMNS: readonly MaintenanceStatus[] = [
  "open",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved",
];

/** The words a "Move to" choice reads with, from where the fault is now. */
export function moveLabel(from: MaintenanceStatus, to: MaintenanceStatus): string {
  if (to === "open") return "Reopen";
  if (to === "resolved") return "Fixed";
  if (to === "cancelled") return "Reported by mistake";
  if (from === "assigned" && to === "acknowledged") return "Seen (take it back)";
  return FAULT_STATUS_LABEL[to];
}

/** "Today", "1 day", "12 days": how long since it was reported. */
export function ageWords(reportedAt: string, today: string = kigaliDay()): string {
  const days = Math.max(0, daysBetween(kigaliDay(new Date(reportedAt)), today));
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

const TONE: Partial<Record<MaintenanceStatus, StatusTone>> = {
  resolved: "success",
  closed: "default",
  wont_fix: "danger",
  cancelled: "default",
  open: "warning",
};

/** A fault's history for `EventTimeline`, oldest first, with who did it and what they wrote. */
export function faultTimeline(events: FaultEventView[], opts: { showVisibility: boolean }): TimelineEvent[] {
  return [...events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e, i, all) => ({
      id: e.id,
      title: e.words,
      detail:
        [
          e.actorName ?? (e.actorRole === "system" ? "Injishi" : null),
          e.note ? `"${e.note}"` : null,
          opts.showVisibility && !e.visibleToTenant ? "Team only" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      at: e.at,
      tone: i === all.length - 1 ? "current" : e.to ? (TONE[e.to] ?? "info") : "default",
    }));
}

export const PAYMENT_TONE: Record<FaultPaymentStatus, StatusTone> = {
  waiting: "info",
  paid: "success",
  failed: "danger",
  voided: "default",
};
