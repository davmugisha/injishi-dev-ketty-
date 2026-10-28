import { describe, expect, it } from 'vitest';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';

import type {
  RevenueDepartmentRow,
  RevenueRepository,
} from '../infrastructure/revenue.repository';
import { RevenueService } from './revenue.service';

const ws = {
  workspaceId: 'ws-1',
  branchScope: {
    coverage: 'all',
    selectedPropertyId: null,
    propertyIds: [],
    includesUnbranched: true,
  },
} as unknown as ScopedWorkspace;

function department(
  id: string,
  overrides: Partial<RevenueDepartmentRow> = {},
): RevenueDepartmentRow {
  return {
    id,
    name: id,
    departmentCategory: 'rooms',
    isRevenueCenter: true,
    status: 'active',
    ...overrides,
  };
}

function build(
  earned: Record<string, number>,
  departments: RevenueDepartmentRow[],
): { service: RevenueService; calls: { from: string; to: string }[] } {
  const calls: { from: string; to: string }[] = [];
  const repo = {
    revenueByDepartment: async (_ws: string, _scope: unknown, from: string, to: string) => {
      calls.push({ from, to });
      return new Map(Object.entries(earned));
    },
    listDepartments: async () => departments,
  } as unknown as RevenueRepository;
  return { service: new RevenueService(repo), calls };
}

describe('RevenueService', () => {
  it('reads the half open month, rolling December into the next year', async () => {
    const { service, calls } = build({}, []);

    const result = await service.forMonth(ws, { month: '2026-12' });

    expect(calls).toEqual([{ from: '2026-12-01', to: '2027-01-01' }]);
    expect(result).toMatchObject({ month: '2026-12', from: '2026-12-01', to: '2027-01-01' });
  });

  it('lists an active revenue centre that earned nothing, at zero', async () => {
    const { service } = build({ rooms: 500_000 }, [
      department('rooms'),
      department('spa', { departmentCategory: 'spa_recreation' }),
    ]);

    const result = await service.forMonth(ws, { month: '2026-09' });

    expect(result.departments.map((d) => [d.departmentId, d.revenueRwf])).toEqual([
      ['rooms', 500_000],
      ['spa', 0],
    ]);
    expect(result.totalRwf).toBe(500_000);
  });

  it('keeps a retired department that earned money, so the rows add up to the total', async () => {
    const { service } = build({ bar: 80_000, rooms: 20_000 }, [
      department('rooms'),
      department('bar', { departmentCategory: 'fnb', status: 'archived' }),
      department('old', { status: 'archived' }),
      department('it', { departmentCategory: 'it', isRevenueCenter: false }),
    ]);

    const result = await service.forMonth(ws, { month: '2026-09' });

    expect(result.departments.map((d) => d.departmentId)).toEqual(['rooms', 'bar']);
    expect(result.totalRwf).toBe(100_000);
  });
});
