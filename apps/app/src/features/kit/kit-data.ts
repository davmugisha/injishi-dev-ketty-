/**
 * Illustrative values for the component gallery (`/kit`) and nothing else. No screen may import this:
 * every rentals screen reads the API.
 */
import type {
  AgeingRow,
  CategoryAmount,
  KpiItem,
  MonthAmounts,
  MonthFlow,
  MonthRate,
  TimelineEvent,
} from "@injishi/ui";

/** `yyyy-mm-dd` plus `n` days. */
export function addDays(day: string, n: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

/** The last `count` months up to the month of `day`, oldest first, as `yyyy-mm`. */
export function lastMonths(day: string, count: number): string[] {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(Date.UTC(y, m - (count - 1 - i), 1));
    return at.toISOString().slice(0, 7);
  });
}

const EXPECTED = [
  3_850_000, 3_850_000, 4_150_000, 4_150_000, 4_400_000, 4_400_000, 4_400_000, 4_650_000, 4_650_000, 4_650_000,
  4_900_000, 4_900_000,
];
const COLLECTED = [
  3_600_000, 3_850_000, 3_700_000, 4_150_000, 4_020_000, 4_400_000, 4_100_000, 4_480_000, 4_650_000, 4_210_000,
  4_760_000, 4_385_000,
];
const OUT = [
  620_000, 410_000, 1_250_000, 380_000, 540_000, 2_150_000, 460_000, 390_000, 720_000, 510_000, 1_480_000, 450_000,
];
const OCCUPANCY = [78, 81, 81, 84, 84, 88, 88, 91, 91, 88, 94, 94];

export function rentByMonth(today: string): MonthAmounts[] {
  return lastMonths(today, 12).map((month, i) => ({ month, expected: EXPECTED[i], collected: COLLECTED[i] }));
}

export function flowByMonth(today: string): MonthFlow[] {
  return lastMonths(today, 12).map((month, i) => ({ month, moneyIn: COLLECTED[i], moneyOut: OUT[i] }));
}

export function occupancyByMonth(today: string): MonthRate[] {
  return lastMonths(today, 12).map((month, i) => ({ month, percent: OCCUPANCY[i] }));
}

export function ageingByMonth(today: string): AgeingRow[] {
  const rows: Omit<AgeingRow, "label">[] = [
    { d1to15: 240_000, d16to30: 0, d31to60: 0, d61plus: 0 },
    { d1to15: 310_000, d16to30: 120_000, d31to60: 0, d61plus: 0 },
    { d1to15: 180_000, d16to30: 260_000, d31to60: 120_000, d61plus: 0 },
    { d1to15: 420_000, d16to30: 90_000, d31to60: 160_000, d61plus: 120_000 },
    { d1to15: 150_000, d16to30: 350_000, d31to60: 90_000, d61plus: 160_000 },
    { d1to15: 365_000, d16to30: 140_000, d31to60: 210_000, d61plus: 90_000 },
  ];
  return lastMonths(today, 6).map((label, i) => ({ label, ...rows[i] }));
}

export const EXPENSES: CategoryAmount[] = [
  { category: "Repairs", amount: 1_240_000 },
  { category: "Cleaning", amount: 480_000 },
  { category: "Security", amount: 720_000 },
  { category: "Water and power", amount: 365_000 },
  { category: "Loan interest", amount: 910_000 },
  { category: "Garden", amount: 140_000 },
  { category: "Bank fees", amount: 38_000 },
];

export function figures(): KpiItem[] {
  return [
    {
      id: "collected",
      label: "Collected",
      value: 4_385_000,
      icon: "Wallet",
      trend: { percent: 8.2, versus: "vs last month" },
      spark: COLLECTED.slice(-8),
    },
    { id: "expected", label: "Expected", value: 4_900_000, icon: "Calendar", footnote: "From 14 leases" },
    {
      id: "rate",
      label: "Collection rate",
      value: 89.5,
      format: "percent",
      icon: "ChartColumn",
      progress: 89.5,
      footnote: "12 of 14 paid",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: 515_000,
      icon: "CircleExclamation",
      status: "danger",
      trend: { percent: 12, goodWhen: "down", versus: "vs last month" },
      footnote: "2 tenants",
    },
    { id: "occupancy", label: "Occupancy", value: 94, format: "percent", icon: "FolderHouse", progress: 94 },
    {
      id: "expenses",
      label: "Expenses",
      value: 450_000,
      icon: "Receipt",
      trend: { percent: -14.5, goodWhen: "down", versus: "vs last month" },
    },
    { id: "net", label: "Net", value: 3_935_000, icon: "ChartLineArrowUp", footnote: "After expenses" },
  ];
}

export type DemoLeaseStatus = "draft" | "pending_signature" | "signed" | "active" | "ending" | "ended";

export interface DemoLease {
  id: string;
  reference: string;
  tenant: string;
  email: string;
  unit: string;
  block: string;
  bedrooms: number;
  rent: number;
  start: string;
  end: string;
  status: DemoLeaseStatus;
  overdue: number;
}

export function leases(today: string): DemoLease[] {
  const rows: Omit<DemoLease, "id" | "start" | "end">[] = [
    {
      reference: "L-0142",
      tenant: "Aline Uwase",
      email: "aline.uwase@example.com",
      unit: "A-01",
      block: "Block A",
      bedrooms: 2,
      rent: 350_000,
      status: "active",
      overdue: 0,
    },
    {
      reference: "L-0143",
      tenant: "Eric Nshimiyimana",
      email: "eric.n@example.com",
      unit: "A-02",
      block: "Block A",
      bedrooms: 1,
      rent: 220_000,
      status: "active",
      overdue: 220_000,
    },
    {
      reference: "L-0151",
      tenant: "Grace Mukamana",
      email: "grace.mukamana@example.com",
      unit: "B-04",
      block: "Block B",
      bedrooms: 3,
      rent: 480_000,
      status: "pending_signature",
      overdue: 0,
    },
    {
      reference: "L-0152",
      tenant: "Jean Claude Habimana",
      email: "jc.habimana@example.com",
      unit: "B-05",
      block: "Block B",
      bedrooms: 2,
      rent: 365_000,
      status: "draft",
      overdue: 0,
    },
    {
      reference: "L-0138",
      tenant: "Divine Ingabire",
      email: "divine.ingabire@example.com",
      unit: "A-03",
      block: "Block A",
      bedrooms: 1,
      rent: 210_000,
      status: "ending",
      overdue: 295_000,
    },
    {
      reference: "L-0149",
      tenant: "Patrick Mugisha",
      email: "patrick.mugisha@example.com",
      unit: "C-01",
      block: "Block C",
      bedrooms: 4,
      rent: 650_000,
      status: "signed",
      overdue: 0,
    },
    {
      reference: "L-0121",
      tenant: "Clarisse Umutoni",
      email: "clarisse.u@example.com",
      unit: "C-02",
      block: "Block C",
      bedrooms: 2,
      rent: 340_000,
      status: "ended",
      overdue: 0,
    },
  ];
  return rows.map((r, i) => ({
    ...r,
    id: r.reference,
    start: addDays(today, [-220, -180, 12, 30, -340, 6, -400][i]),
    end: addDays(today, [145, 185, 377, 395, 21, 371, -35][i]),
  }));
}

export function leaseHistory(today: string): TimelineEvent[] {
  return [
    { id: "created", title: "Lease drafted", detail: "By you", at: addDays(today, -16) },
    {
      id: "landlord",
      title: "You signed",
      detail: "Typed name and emailed code",
      at: addDays(today, -15),
      tone: "success",
    },
    { id: "invite", title: "Invitation sent", detail: "To grace.mukamana@example.com", at: addDays(today, -15) },
    { id: "resent", title: "Invitation sent again", detail: "Not opened yet", at: addDays(today, -3), tone: "warning" },
    { id: "waiting", title: "Waiting for the tenant to sign", at: today, tone: "current" },
  ];
}
