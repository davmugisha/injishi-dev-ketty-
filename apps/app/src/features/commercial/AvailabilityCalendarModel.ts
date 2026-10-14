import type {
  AvailabilityCalendarChannel,
  AvailabilityCalendarGroupBlock,
  AvailabilityCalendarHold,
  AvailabilityCalendarIssue,
  AvailabilityCalendarNight,
  AvailabilityCalendarNightValue,
  AvailabilityCalendarRatePlan,
  AvailabilityCalendarReason,
  AvailabilityCalendarRoomType,
  AvailabilityCalendarWindow,
} from "@injishi/data/fixtures/commercial";
import { formatNumber } from "@injishi/ui";

/** Everything the availability calendar reads from the database. */
export interface AvailabilityCalendarData {
  window: AvailabilityCalendarWindow | null;
  nights: AvailabilityCalendarNight[];
  ratePlans: AvailabilityCalendarRatePlan[];
  roomTypes: AvailabilityCalendarRoomType[];
  groupBlocks: AvailabilityCalendarGroupBlock[];
  issues: AvailabilityCalendarIssue[];
  channels: AvailabilityCalendarChannel[];
  holds: AvailabilityCalendarHold[];
  reasons: AvailabilityCalendarReason[];
}

/** Nights a..b (inclusive) of one room type. */
export interface CalendarSelection {
  type: string;
  a: number;
  b: number;
}

/** A change the manager applied to one night in this session. */
export interface CalendarUserNight {
  price: number;
  close: boolean;
  min: number;
}

/** room type id → night index → applied change. */
export type CalendarUserChanges = Record<string, Record<number, CalendarUserNight>>;

export type CalendarSyncState = "ok" | "queued" | "failed";

export type CalendarCellFill = "over" | "closed" | "override" | "weekend" | "open";

export interface CalendarCell {
  night: number;
  avail: string;
  availTone: "danger" | "muted" | "default";
  rate: string;
  isOverride: boolean;
  tag: string;
  tagTone: "danger" | "warning" | "muted";
  fill: CalendarCellFill;
  isSelected: boolean;
  isPending: boolean;
  aria: string;
}

export interface CalendarRow {
  roomType: AvailabilityCalendarRoomType;
  meta: string;
  cells: CalendarCell[];
}

export const fmt = (n: number) => formatNumber(n);

/** "Sun 12" */
export const nightLabel = (n: AvailabilityCalendarNight | undefined) => (n ? `${n.weekday} ${n.day}` : "");

/** "1 night", "3 nights" */
export const nightsText = (count: number) => `${count} ${count === 1 ? "night" : "nights"}`;

export function nightValue(list: AvailabilityCalendarNightValue[], night: number): number | undefined {
  return list.find((v) => v.night === night)?.value;
}

/** The price a rate plan shows for a room type on a night, given that night's BAR. */
export function planRate(
  plan: AvailabilityCalendarRatePlan,
  roomType: AvailabilityCalendarRoomType,
  bar: number,
  night: number,
): string {
  if (plan.basis === "corporate") {
    if (!roomType.corporate) return "Not sold";
    if (plan.closedFrom !== undefined && night >= plan.closedFrom) return "Closed";
    return fmt(roomType.corporate);
  }
  let value = bar;
  if (plan.factor) value = Math.round((bar * plan.factor) / 1000) * 1000;
  if (plan.supplement) value += plan.supplement;
  return fmt(value);
}

/** Rows, hotel occupancy and channel sync for the window, as the board computes them. */
export function buildCalendar({
  data,
  plan,
  selection,
  changes,
  queued,
  retried,
}: {
  data: AvailabilityCalendarData;
  plan: AvailabilityCalendarRatePlan;
  selection: CalendarSelection;
  changes: CalendarUserChanges;
  queued: Record<number, boolean>;
  retried: boolean;
}) {
  const { nights, roomTypes, groupBlocks } = data;
  const totalRooms = roomTypes.reduce((sum, t) => sum + t.rooms, 0);
  const totals = nights.map(() => ({ used: 0, ooo: 0 }));
  const inBlock = (night: number) => groupBlocks.some((g) => night >= g.firstNight && night < g.firstNight + g.nights);

  const rows: CalendarRow[] = roomTypes.map((t) => {
    const user = changes[t.id] ?? {};
    const cells = nights.map((n, i): CalendarCell => {
      const u = user[i];
      const block = inBlock(i) ? t.blockRooms : 0;
      const ooo = i < t.outOfOrderUntil ? 1 : 0;
      const sold = t.sold[i] ?? 0;
      const total = totals[i];
      if (total) {
        total.used += sold + block;
        total.ooo += ooo;
      }
      const avail = t.rooms - sold - block - ooo;
      const closed = !!(u?.close || t.stopSell.includes(i));
      const baseOverride = nightValue(t.priceOverrides, i);
      const bar = u?.price ? u.price : baseOverride || t.bar;
      const isOverride = !!(u?.price || baseOverride);
      const pending = nightValue(t.pendingPrices, i);
      const min = u?.min || nightValue(t.minStay, i) || 1;
      const isSelected = selection.type === t.id && i >= selection.a && i <= selection.b;
      const tag =
        avail < 0
          ? `Over by ${-avail}`
          : pending
            ? `Pending ${Math.round(pending / 1000)}k`
            : closed
              ? "Stop-sell"
              : t.noArrival.includes(i)
                ? "No arrival"
                : min > 1
                  ? `Min ${min}`
                  : "";
      const availText = closed ? "Closed" : avail < 0 ? `−${-avail}` : avail === 0 ? "Full" : `${avail} left`;
      const rate = planRate(plan, t, bar, i);
      return {
        night: i,
        avail: availText,
        availTone: avail < 0 ? "danger" : avail === 0 || closed ? "muted" : "default",
        rate,
        isOverride,
        tag,
        tagTone: avail < 0 ? "danger" : pending ? "warning" : "muted",
        fill: avail < 0 ? "over" : closed ? "closed" : isOverride ? "override" : n.isWeekend ? "weekend" : "open",
        isSelected,
        isPending: !!pending,
        aria: `${t.name}, ${nightLabel(n)} ${n.month}: ${availText}, ${plan.label} ${rate}${tag ? `, ${tag}` : ""}`,
      };
    });
    return { roomType: t, meta: `${t.rooms} rooms · BAR ${fmt(t.bar)}`, cells };
  });

  const occupancy = totals.map((x) => {
    const value = Math.round((x.used / (totalRooms - x.ooo)) * 100);
    return { value, over: value > 100 };
  });

  const sync = nights.map((n, i): CalendarSyncState => {
    let state: CalendarSyncState = n.sync === "failed" && retried ? "queued" : n.sync;
    if (queued[i]) state = "queued";
    return state;
  });

  return { rows, occupancy, sync };
}
