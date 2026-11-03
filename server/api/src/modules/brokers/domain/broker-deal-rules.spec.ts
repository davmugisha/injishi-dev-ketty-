import { describe, expect, it } from 'vitest';

import { effectiveStatus, moveProblem, proposalDatesProblem, termColumns, termsFromColumns } from './broker-deal-rules';

describe('broker deal rules', () => {
  it('stores a percent in basis points and reads it back', () => {
    const columns = termColumns({ kind: 'percent', percent: 7.5 });
    expect(columns).toEqual({ kind: 'percent', percentBp: 750, amountRwf: null, minRooms: null });
    expect(termsFromColumns(columns)).toEqual({ kind: 'percent', percent: 7.5 });
  });

  it('stores a bulk sum with its fewest rooms and nothing else', () => {
    const columns = termColumns({ kind: 'bulk_fixed', amountRwf: 200_000, minRooms: 10 });
    expect(columns).toEqual({ kind: 'bulk_fixed', percentBp: null, amountRwf: 200_000, minRooms: 10 });
    expect(termsFromColumns(columns)).toEqual({ kind: 'bulk_fixed', amountRwf: 200_000, minRooms: 10 });
  });

  it('a running deal past its end date reads as ended; everything else as stored', () => {
    expect(effectiveStatus('active', '2026-11-01', '2026-11-02')).toBe('ended');
    expect(effectiveStatus('active', '2026-11-02', '2026-11-02')).toBe('active');
    expect(effectiveStatus('active', null, '2030-01-01')).toBe('active');
    expect(effectiveStatus('proposed', '2026-01-01', '2026-11-02')).toBe('proposed');
  });

  it('refuses a proposal dated in the past', () => {
    expect(proposalDatesProblem('2026-11-01', null, '2026-11-02')).toMatch(/start date/);
    expect(proposalDatesProblem(null, '2026-11-02', '2026-11-02')).toMatch(/end date/);
    expect(proposalDatesProblem('2026-11-02', '2026-12-01', '2026-11-02')).toBeNull();
    expect(proposalDatesProblem(null, null, '2026-11-02')).toBeNull();
  });

  it('opens each move only from the status it belongs to', () => {
    expect(moveProblem('withdraw', 'proposed')).toBeNull();
    expect(moveProblem('withdraw', 'active')).not.toBeNull();
    expect(moveProblem('decide', 'proposed')).toBeNull();
    expect(moveProblem('decide', 'withdrawn')).toMatch(/withdrew/);
    expect(moveProblem('decide', 'active')).toMatch(/already been answered/);
    expect(moveProblem('end', 'active')).toBeNull();
    expect(moveProblem('end', 'proposed')).not.toBeNull();
    expect(moveProblem('end', 'ended')).not.toBeNull();
  });
});
