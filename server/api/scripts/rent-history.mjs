// The months of rent that came BEFORE the story the seed tells by hand.
//
// `seed-demo-portfolio.mjs` authors two months of rent — last month and this
// one — because those two carry the narrative: Patrick two months behind, Aline
// half paid, everyone else settled. Every tenancy it hangs them off has been
// running for between two and twenty six months, so the rent ledger at
// `/w/<green hills>/finance` showed a lease that started a year and a half ago
// with exactly two rows against it. A landlord opening Finance saw a ledger
// that could not be the ledger of the portfolio on the next screen.
//
// This module is the rest of the history, and it is a PURE function so it can
// be tested without a database (`rent-history.test.mjs`). It writes nothing and
// knows nothing about Postgres.
//
// Three rules shape it:
//
//   1. **It never reaches the two hand-written months.** It stops at
//      `newestOffset` (−2 by default), so the authored narrative rows stay the
//      only rows for last month and this month and no generated row can collide
//      with them on `rent_charges_lease_period_uk`.
//   2. **History is settled.** Every month it writes is paid in full. The
//      arrears in this demo are deliberate and current — Patrick is "two months
//      behind", and a third generated arrear would quietly make him four.
//      Only the pay DATE varies, deterministically, so the ledger reads like a
//      ledger rather than like a fixture.
//   3. **Rent steps up once.** A tenancy older than `stepUpAfterMonths` was
//      charged less before that point, which is what makes the annual
//      declaration total on the Filings lens a figure somebody had to add up
//      rather than twelve copies of one number.
//
// Every value is derived from the lease and the month, so a re-run of the seed
// produces byte-identical rows and `ON CONFLICT DO NOTHING` makes it a no-op.

/** Deterministic small integer from a string: same lease + month, same day. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/** `YYYY-MM-DD` for day `d` of the month `offset` months from `today`. */
function isoDay(today, offset, d) {
  return new Date(Date.UTC(today.year, today.month0 + offset, d))
    .toISOString()
    .slice(0, 10);
}

/**
 * What a month cost this tenancy.
 *
 * The step-up is applied to the months FURTHER back than `stepUpAfterMonths`,
 * rounded to the nearest 10,000 RWF because no landlord in Kigali raises rent
 * by 24,600.
 */
export function rentForMonth(rent, offset, { stepUpAfterMonths = 12, stepUpRatio = 0.92 } = {}) {
  if (offset > -stepUpAfterMonths) return rent;
  return Math.round((rent * stepUpRatio) / 10_000) * 10_000;
}

/**
 * Every settled month of rent behind the two the seed writes by hand.
 *
 * @param {ReadonlyArray<{id: string, rent: number, startMonth: number, endMonth?: number|null}>} leases
 *        `startMonth` and `endMonth` are offsets in months from the current
 *        month: −18 is a year and a half ago, 0 is this month. `endMonth` is
 *        the last month the tenancy owed rent for, or null when it still runs.
 * @param {{year: number, month0: number}} today Kigali's current month.
 * @param {{monthsBack?: number, newestOffset?: number, idFor?: (n: number) => string,
 *          stepUpAfterMonths?: number, stepUpRatio?: number}} [options]
 * @returns {Array<{id: string, lease: string, period: string, amount: number,
 *                  paid: number, status: 'paid', due: string, paidAt: Date}>}
 */
export function rentHistory(leases, today, options = {}) {
  const {
    monthsBack = 24,
    newestOffset = -2,
    idFor = (n) => `rent-history-${n}`,
    stepUpAfterMonths = 12,
    stepUpRatio = 0.92,
  } = options;

  if (newestOffset > -1) {
    throw new Error('newestOffset must be at most -1: the current month is authored by hand.');
  }

  const rows = [];
  for (const lease of leases) {
    // A tenancy older than the window starts at the window's edge. Two years of
    // ledger is a ledger; six is a scroll.
    const from = Math.max(lease.startMonth, -monthsBack);
    const to = Math.min(lease.endMonth ?? newestOffset, newestOffset);
    for (let offset = from; offset <= to; offset += 1) {
      const amount = rentForMonth(lease.rent, offset, { stepUpAfterMonths, stepUpRatio });
      // Due on the 5th, paid somewhere in the first nine days. The spread is
      // derived, so this tenant is consistently early and that one consistently
      // pays on the day it falls due.
      const payDay = 1 + (hash(`${lease.id}:${offset}`) % 9);
      rows.push({
        lease: lease.id,
        period: isoDay(today, offset, 1),
        amount,
        paid: amount,
        status: 'paid',
        due: isoDay(today, offset, 5),
        // 10:00 Kigali (UTC+2, no daylight saving), like every other settlement
        // this seed writes.
        paidAt: new Date(`${isoDay(today, offset, payDay)}T08:00:00.000Z`),
      });
    }
  }

  // Oldest first, so the ids read in the order the ledger does.
  rows.sort((a, b) => (a.period === b.period ? a.lease.localeCompare(b.lease) : a.period.localeCompare(b.period)));
  return rows.map((row, i) => ({ ...row, id: idFor(i + 1) }));
}
