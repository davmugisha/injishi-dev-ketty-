/**
 * The figures a model answer states, and whether this turn's data holds them
 * (ADR-061 D-v): every money amount and every date in an answer must appear
 * in a tool result of the same turn, or in the person's own question.
 *
 * A money amount is a number written with RWF (or Frw) beside it, or any
 * number of four digits or more. A bare year (1900 to 2099) on its own is a
 * year, not money. A date is ISO (`2026-10-10`) or written out with the month
 * name (`10 October 2026`, `October 10, 2026`). Numbers are compared by their
 * digits, so `70,000 RWF` in an answer is found as `70000` in a tool's JSON,
 * and a written out date is found as its ISO form.
 */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)';

const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const DAY_MONTH_YEAR = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)? ${MONTH},? (\\d{4})(?!\\d)`, 'gi');
const MONTH_DAY_YEAR = new RegExp(`${MONTH} (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})(?!\\d)`, 'gi');
// Thousands may be separated by a comma or a no break space, never a plain
// space, so "2 rooms 300 metres" is never read as 2,300.
const GROUPED = '\\d{1,3}(?:[,\\u00a0\\u202f]\\d{3})+';
const AMOUNT = `(?:${GROUPED}|\\d+)`;
const CURRENCY = '(?:RWF|Rwf|rwf|FRW|Frw|frw)';
const MONEY_AFTER = new RegExp(`(?<![\\d.,])(${AMOUNT})\\s?${CURRENCY}\\b`, 'g');
const MONEY_BEFORE = new RegExp(`\\b${CURRENCY}\\s?(${AMOUNT})(?![\\d])`, 'g');
const LARGE_NUMBER = new RegExp(`(?<![\\d.,])(${GROUPED}|\\d{4,})(?![\\d,]\\d)`, 'g');
const ANY_NUMBER = new RegExp(`(?<![\\d.,])(${GROUPED}|\\d+)(?![\\d])`, 'g');

export interface Figure {
  /** As the answer wrote it. */
  text: string;
  /** `money:70000` or `date:2026-10-10`. */
  key: string;
}

/** Every money amount and date an answer states. */
export function figuresIn(text: string): Figure[] {
  const figures: Figure[] = [];
  // Dates first, blanked out, so their digits are never read as money.
  const rest = takeDates(text, figures);
  const seen = new Set<string>();
  const add = (raw: string, amount: string): void => {
    const key = `money:${digits(amount)}`;
    if (seen.has(`${key}@${raw}`)) return;
    seen.add(`${key}@${raw}`);
    figures.push({ text: raw.trim(), key });
  };
  let blanked = rest;
  for (const pattern of [MONEY_AFTER, MONEY_BEFORE]) {
    blanked = blanked.replace(pattern, (raw: string, amount: string) => {
      add(raw, amount);
      return ' '.repeat(raw.length);
    });
  }
  for (const match of blanked.matchAll(LARGE_NUMBER)) {
    const value = digits(match[1]);
    const isYear = /^\d{4}$/.test(match[1]) && Number(value) >= 1900 && Number(value) <= 2099;
    if (!isYear) add(match[1], match[1]);
  }
  return figures;
}

/** The figures in `text` that none of the evidence holds. */
export function unconfirmedFigures(text: string, evidence: string[]): Figure[] {
  const known = new Set<string>();
  for (const item of evidence) {
    const rest = takeDates(item, null, known);
    for (const match of rest.matchAll(ANY_NUMBER)) known.add(`money:${digits(match[1])}`);
  }
  return figuresIn(text).filter((figure) => !known.has(figure.key));
}

/**
 * Find the dates in `text`, record each (as a figure, or as a known key), and
 * return the text with them blanked out.
 */
function takeDates(text: string, figures: Figure[] | null, known?: Set<string>): string {
  const record = (raw: string, iso: string | null): string => {
    if (iso) {
      if (figures) figures.push({ text: raw, key: `date:${iso}` });
      known?.add(`date:${iso}`);
    }
    return ' '.repeat(raw.length);
  };
  return text
    .replace(ISO_DATE, (raw: string, y: string, m: string, d: string) => record(raw, isoOf(y, m, d)))
    .replace(DAY_MONTH_YEAR, (raw: string, d: string, month: string, y: string) => record(raw, isoOf(y, monthNumber(month), d)))
    .replace(MONTH_DAY_YEAR, (raw: string, month: string, d: string, y: string) => record(raw, isoOf(y, monthNumber(month), d)));
}

function monthNumber(name: string): string {
  const lower = name.toLowerCase();
  const index = MONTHS.findIndex((m) => m.startsWith(lower.slice(0, 3)));
  return String(index + 1);
}

function isoOf(year: string, month: string, day: string): string | null {
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function digits(amount: string): string {
  return amount.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
}
