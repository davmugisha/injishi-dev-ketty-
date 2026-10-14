import { screens } from "@injishi/data";
import type { MarketTone, PriceBand } from "@injishi/data/fixtures/market";
import { formatRwf } from "@injishi/ui";

/** "RWF 85,000". */
export const rwf = (amount: number) => formatRwf(Math.round(amount));

/** Map pin label: "85k", "1.1M". */
export function shortPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".0", "")}M`;
  return `${Math.round(amount / 1000)}k`;
}

/** "2 nights", "1 adult". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Whether a price falls in a filter band. */
export function inBand(band: PriceBand | undefined, price: number): boolean {
  if (!band) return true;
  if (band.under !== undefined && !(price < band.under)) return false;
  if (band.from !== undefined && price < band.from) return false;
  if (band.to !== undefined && price > band.to) return false;
  if (band.over !== undefined && !(price > band.over)) return false;
  return true;
}

/** Header visitor: the signed-in person, or the demo guest the public artboards show when nobody is signed in. */
export function marketVisitor(
  persona: { name: string; initials: string } | null,
  demo?: { name: string; initials: string } | null,
): { name: string; initials: string } | null {
  if (persona) return { name: persona.name, initials: persona.initials };
  if (demo) return { name: demo.name, initials: demo.initials };
  return null;
}

/** Link to a property page by slug (the registry route with its [slug] filled in). */
export const propertyHref = (slug: string) => screens.MarketProperty.route.replace("[slug]", slug);

/** HeroUI colour for a market tone (HeroUI has no "info"; it renders as accent). */
export function chipColor(tone: MarketTone): "default" | "accent" | "success" | "warning" | "danger" {
  return tone === "info" ? "accent" : tone;
}

// ── Dates (ISO "2026-10-23", rendered in the artifact's "Fri 23 Oct" style, UTC, no locale drift) ──

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_MS = 86_400_000;

/** Days since the epoch for an ISO date. */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** ISO date for a day number. */
export function isoDay(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

function parts(n: number) {
  const t = new Date(n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), w: t.getUTCDay() };
}

/** "Fri 23 Oct". */
export function fmtDay(n: number): string {
  const p = parts(n);
  return `${WEEKDAYS[p.w]} ${p.d} ${MONTHS[p.m]}`;
}

/** Day of the week, 0 = Sunday. */
export const weekday = (n: number) => parts(n).w;

/** "23–25 Oct" or "30 Oct – 2 Nov". */
export function shortRange(a: number, b: number): string {
  const x = parts(a);
  const y = parts(b);
  return x.m === y.m ? `${x.d}–${y.d} ${MONTHS[x.m]}` : `${x.d} ${MONTHS[x.m]} – ${y.d} ${MONTHS[y.m]}`;
}
