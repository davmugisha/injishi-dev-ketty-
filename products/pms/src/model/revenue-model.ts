import type {
  RevenueEvent,
  RevenueForecast,
  RevenueNight,
  RevenuePaceWeek,
  RevenueRecommendation,
  RevenueScenario,
  RevenueScenarioId,
} from "./commercial.ts";

/** Everything the Revenue board reads from the embedded database. */
export interface RevenueData {
  scenarios: RevenueScenario[];
  nights: RevenueNight[];
  forecasts: RevenueForecast[];
  events: RevenueEvent[];
  paceWeeks: RevenuePaceWeek[];
  recommendations: RevenueRecommendation[];
}

const LOCALE = "en-KE";

/** Reasons a manager can give for overriding a recommended rate. */
export const REVENUE_OVERRIDE_REASONS = ["Local event", "Group deal", "Rate floor", "Competitor check"];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const avg = (values: number[]) => (values.length ? sum(values) / values.length : 0);

/** "RWF 140,000" */
export function revenueRwf(value: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "RWF" }).format(Math.round(value));
}

/** Intl options for "RWF 88.9M" / "RWF 100.0M" (one decimal, always shown). */
export const REVENUE_MILLIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "RWF",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};

/** "RWF 88.9M" */
export function revenueRwfM(value: number): string {
  return new Intl.NumberFormat(LOCALE, REVENUE_MILLIONS).format(value);
}

/** "1,260" */
export function revenueCount(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** One decimal, as the board rounds percentages ("59.8"). */
export const revenueRound1 = (value: number) => Math.round(value * 10) / 10;

/** "+9 pts", "−3 pts", "0 pts" (true minus sign, as on the board). */
export function revenueSignedPts(diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${Math.abs(diff)} pts`;
}

/** "+8.6%", "−7.1%" or "No change". */
export function revenueDelta(current: number, recommended: number): string {
  const d = recommended - current;
  if (d === 0) return "No change";
  return `${d > 0 ? "+" : "−"}${Math.abs(Math.round((d / current) * 1000) / 10)}%`;
}

/** A night with its forecast in the selected scenario. */
export interface RevenueNightRow {
  night: RevenueNight;
  forecast: RevenueForecast;
}

export function revenueNightRows(data: RevenueData, scenario: RevenueScenarioId): RevenueNightRow[] {
  const byNight = new Map(data.forecasts.filter((f) => f.scenario === scenario).map((f) => [f.night, f]));
  return data.nights.flatMap((night) => {
    const forecast = byNight.get(night.id);
    return forecast ? [{ night, forecast }] : [];
  });
}

/** Events that apply in the scenario. */
export function revenueEventsFor(data: RevenueData, scenario: RevenueScenarioId): RevenueEvent[] {
  return data.events.filter((e) => e.scenario === null || e.scenario === scenario);
}

/** "EAC Health Forum block, 25 rooms contracted · wedding enquiry L-0276" or the empty-night text. */
export function revenueNightEvent(events: RevenueEvent[], nightId: string): string {
  const on = events.filter((e) => e.firstNight <= nightId && nightId <= e.lastNight);
  return on.length ? on.map((e) => e.label).join(" · ") : "No group or event on the books";
}

/** Headline figures of the 30-night window in one scenario (KPIs, scenario comparison). */
interface RevenueFigures {
  capacity: number;
  onTheBooks: number;
  onTheBooksRoomNights: number;
  occupancy: number;
  low: number;
  high: number;
  roomNights: number;
  adr: number;
  revenue: number;
  revenueLow: number;
  revenueHigh: number;
  pace: number;
}

export function revenueFigures(data: RevenueData, scenarioId: RevenueScenarioId): RevenueFigures {
  const rows = revenueNightRows(data, scenarioId);
  const scenario = data.scenarios.find((s) => s.id === scenarioId);
  const adr = scenario?.adr ?? 0;
  const capacity = sum(rows.map((r) => r.night.rooms));
  const onTheBooks = avg(rows.map((r) => r.night.onTheBooks));
  const occupancy = avg(rows.map((r) => r.forecast.value));
  const low = avg(rows.map((r) => r.forecast.low));
  const high = avg(rows.map((r) => r.forecast.high));
  const roomNights = Math.round((capacity * occupancy) / 100);
  const weekNights = sum(data.paceWeeks.map((w) => w.nights));
  const lastYear = weekNights ? sum(data.paceWeeks.map((w) => w.lastYear * w.nights)) / weekNights : 0;
  return {
    capacity,
    onTheBooks,
    onTheBooksRoomNights: Math.round((capacity * onTheBooks) / 100),
    occupancy,
    low,
    high,
    roomNights,
    adr,
    revenue: roomNights * adr,
    revenueLow: ((capacity * low) / 100) * adr,
    revenueHigh: ((capacity * high) / 100) * adr,
    pace: revenueRound1(onTheBooks - lastYear),
  };
}

/** Recommendations visible in the scenario (scenario-only ones appear in their scenario). */
export function revenueRecommendationsFor(data: RevenueData, scenario: RevenueScenarioId): RevenueRecommendation[] {
  return data.recommendations.filter((r) => r.scenario === null || r.scenario === scenario);
}

/** Rate and evidence of a recommendation in the selected scenario. */
export function revenueRecommendationIn(rec: RevenueRecommendation, scenario: RevenueScenarioId) {
  const alt = scenario === "conference" ? rec.conference : undefined;
  return { recommended: alt?.recommended ?? rec.recommended, reason: alt?.reason ?? rec.reason };
}
