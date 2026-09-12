/**
 * The Broker fixtures and the arithmetic over them.
 *
 * Three groups, and the middle one is the reason this file exists:
 *
 *   - the maths (a fee on a percentage, days between two ISO days);
 *   - the DERIVATIONS, where a bug would be invisible on screen because both
 *     halves of the contradiction are drawn by the same component — an intent
 *     whose window has run out still reading as active, a chip counting a
 *     bucket the list does not filter to;
 *   - the seed invariants frame B24's hero states out loud, so a fixture edit
 *     that quietly breaks "11 signed · average 135K" fails here rather than
 *     being noticed by a reviewer squinting at a screenshot.
 */
import {
  CHART_MONTHS,
  INTENT_WINDOW_DAYS,
  SEED_CREDITS,
  SEED_PLACEMENTS,
  SEED_REVEALS,
  DIRECTORY_UNITS,
  bucketOf,
  countByBucket,
  daysUntil,
  feeAmount,
  getUnit,
  inDays,
  intentExpiresAt,
  isPlaceable,
  monthlyFees,
  placementState,
  recentFees,
  summariseEarnings,
  type Placement,
} from './broker';
import { creditFor } from './photo-credits';

/** A placement with only the fields a given assertion cares about. */
function placement(over: Partial<Placement>): Placement {
  return {
    id: 'p',
    client: 'A Client',
    unitId: 'umurava-heights-b4',
    unitLabel: 'Umurava Heights · B4',
    state: 'active',
    revealedAt: inDays(-1),
    event: 'contact_revealed',
    fee: 100000,
    feeState: 'pending',
    ...over,
  };
}

describe('the day arithmetic', () => {
  it('walks forwards and backwards across a month boundary', () => {
    expect(inDays(1, '2026-01-31')).toBe('2026-02-01');
    expect(inDays(-1, '2026-03-01')).toBe('2026-02-28');
    expect(inDays(0, '2026-09-06')).toBe('2026-09-06');
  });

  it('handles a leap day, which is the one every hand-rolled version gets wrong', () => {
    expect(inDays(1, '2028-02-28')).toBe('2028-02-29');
  });

  it('counts forwards as positive and backwards as negative', () => {
    expect(daysUntil('2026-09-16', '2026-09-06')).toBe(10);
    expect(daysUntil('2026-09-06', '2026-09-06')).toBe(0);
    expect(daysUntil('2026-08-27', '2026-09-06')).toBe(-10);
  });
});

describe('the placement fee', () => {
  it('takes a percentage of the first month', () => {
    expect(feeAmount({ kind: 'percent', percentOfFirstMonth: 50 }, 320000)).toBe(160000);
  });

  it('rounds a percentage rather than emitting a fraction of a franc', () => {
    expect(feeAmount({ kind: 'percent', percentOfFirstMonth: 33 }, 165000)).toBe(54450);
    expect(Number.isInteger(feeAmount({ kind: 'percent', percentOfFirstMonth: 33 }, 100001))).toBe(
      true,
    );
  });

  it('ignores the rent entirely on a flat fee', () => {
    expect(feeAmount({ kind: 'flat', amount: 100000 }, 190000)).toBe(100000);
    expect(feeAmount({ kind: 'flat', amount: 100000 }, 900000)).toBe(100000);
  });
});

describe('the directory', () => {
  it('carries the frame B21 units the session was written against', () => {
    expect(getUnit('umurava-heights-b4')?.title).toBe('Umurava Heights · B4');
    expect(getUnit('ingoro-apartments-c1')?.rent).toBe(190000);
  });

  it('keeps the pre-prototype listing ids resolvable, so an old link still lands', () => {
    for (const id of ['nyarutarama-villa', 'kimihurura-duplex', 'gikondo-flat']) {
      expect(getUnit(id)).toBeDefined();
    }
  });

  it('derives the tile fields rather than restating them', () => {
    for (const u of DIRECTORY_UNITS) {
      expect(u.title).toBe(`${u.property} · ${u.unit}`);
      expect(u.price).toBe(u.rent);
      expect(u.location.startsWith(u.district)).toBe(true);
      expect(u.domain).toBe('residence');
    }
  });

  it('gives every photograph a licence row, which the credit component needs', () => {
    for (const u of DIRECTORY_UNITS) {
      for (const stem of [u.photos.cover, ...u.photos.gallery]) {
        expect(creditFor(stem)).toBeDefined();
      }
    }
  });

  it('refuses a placement against a unit that is already let (FL18 path B)', () => {
    const leased = DIRECTORY_UNITS.filter((u) => u.vacancy.state === 'leased');
    expect(leased.length).toBeGreaterThan(0);
    for (const u of leased) expect(isPlaceable(u)).toBe(false);
    for (const u of DIRECTORY_UNITS.filter((x) => x.vacancy.state !== 'leased')) {
      expect(isPlaceable(u)).toBe(true);
    }
  });
});

describe('a placement’s state', () => {
  it('expires an intent whose window has run out, without storing that it did', () => {
    const stale = placement({ revealedAt: inDays(-(INTENT_WINDOW_DAYS + 1)) });
    expect(stale.state).toBe('active');
    expect(placementState(stale)).toBe('expired');
  });

  it('keeps an intent alive on its last day rather than a day early', () => {
    const lastDay = placement({ revealedAt: inDays(-(INTENT_WINDOW_DAYS - 1)) });
    expect(placementState(lastDay)).toBe('active');
    expect(daysUntil(intentExpiresAt(lastDay))).toBe(1);
  });

  it('leaves a placement that reached the lease alone — the clock stops mattering', () => {
    const old = { revealedAt: inDays(-400) };
    expect(placementState(placement({ ...old, state: 'signed' }))).toBe('signed');
    expect(placementState(placement({ ...old, state: 'signing' }))).toBe('signing');
  });

  it('files a signing under Active, because it is live work rather than a receipt', () => {
    expect(bucketOf(placement({ state: 'signing' }))).toBe('active');
    expect(bucketOf(placement({ state: 'signed' }))).toBe('signed');
    expect(bucketOf(placement({ revealedAt: inDays(-90) }))).toBe('expired');
  });

  it('counts every placement into exactly one bucket', () => {
    const counts = countByBucket(SEED_PLACEMENTS);
    expect(counts.active + counts.signed + counts.expired).toBe(SEED_PLACEMENTS.length);
  });
});

describe('the seeded book', () => {
  it('opens with frame B23’s three live placements', () => {
    expect(countByBucket(SEED_PLACEMENTS).active).toBe(3);
  });

  it('opens with two lapsed intents, derived from their reveal dates alone', () => {
    expect(countByBucket(SEED_PLACEMENTS).expired).toBe(2);
  });

  it('adds up to frame B24’s hero exactly: 11 signed, RWF 1,485,000, average 135,000', () => {
    const summary = summariseEarnings(SEED_PLACEMENTS);
    expect(summary.signed).toBe(11);
    expect(summary.total).toBe(1_485_000);
    expect(summary.average).toBe(135_000);
  });

  it('logs a reveal for every placement whose unit is in this directory', () => {
    const placed = SEED_PLACEMENTS.filter((p) => p.unitId !== '');
    expect(SEED_REVEALS).toHaveLength(placed.length);
    for (const r of SEED_REVEALS) expect(getUnit(r.unitId)).toBeDefined();
  });

  it('starts the month with the seven credits frame B22 prints', () => {
    expect(SEED_CREDITS).toBe(7);
  });
});

describe('the earnings summary', () => {
  it('counts only DISBURSED fees, because a fee earns at activation (F-R08)', () => {
    const summary = summariseEarnings([
      placement({ id: 'a', feeState: 'paid', paidAt: inDays(-2), fee: 50000, state: 'signed' }),
      placement({ id: 'b', feeState: 'pending', fee: 99000 }),
    ]);
    expect(summary.total).toBe(50000);
    expect(summary.pending).toBe(99000);
  });

  it('leaves a lapsed intent out of pending — it earns nothing and never will', () => {
    const summary = summariseEarnings([
      placement({ id: 'lapsed', revealedAt: inDays(-90), fee: 70000 }),
    ]);
    expect(summary.pending).toBe(0);
  });

  it('reports zero rather than NaN on an empty book', () => {
    const summary = summariseEarnings([]);
    expect(summary.total).toBe(0);
    expect(summary.average).toBe(0);
    expect(summary.signed).toBe(0);
  });
});

describe('the six-month chart', () => {
  const bars = monthlyFees(SEED_PLACEMENTS);

  it('draws one bar per month, oldest first, with the current month last', () => {
    expect(bars).toHaveLength(CHART_MONTHS);
    expect(bars.filter((b) => b.current)).toHaveLength(1);
    expect(bars[bars.length - 1].current).toBe(true);
  });

  it('keeps a month that earned nothing, so a flat run does not read as a climb', () => {
    const empty = monthlyFees([]);
    expect(empty).toHaveLength(CHART_MONTHS);
    expect(empty.every((b) => b.total === 0)).toBe(true);
  });

  it('makes the current month the tallest, as frame B24 draws it', () => {
    const peak = Math.max(...bars.map((b) => b.total));
    expect(bars[bars.length - 1].total).toBe(peak);
    expect(peak).toBeGreaterThan(0);
  });

  it('files every fee under the month it was PAID in, not the month it signed', () => {
    const paid = placement({
      id: 'x',
      state: 'signed',
      feeState: 'paid',
      signedAt: '2026-01-30',
      paidAt: '2026-02-02',
      fee: 40000,
    });
    const feb = monthlyFees([paid], new Date(Date.UTC(2026, 1, 20)));
    expect(feb[feb.length - 1].total).toBe(40000);
  });
});

describe('the fee ledger', () => {
  it('orders by the day the money moved, most recent first', () => {
    const rows = recentFees(SEED_PLACEMENTS);
    const days = rows.map((p) => p.paidAt ?? p.signedAt ?? p.revealedAt);
    expect([...days].sort().reverse()).toEqual(days);
  });

  it('leaves a lapsed intent out — a row for it would be a fee that is not one', () => {
    const rows = recentFees(SEED_PLACEMENTS);
    expect(rows.every((p) => placementState(p) !== 'expired')).toBe(true);
    expect(rows.length).toBe(SEED_PLACEMENTS.length - countByBucket(SEED_PLACEMENTS).expired);
  });
});
