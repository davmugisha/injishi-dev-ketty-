import { describe, expect, it } from 'vitest';

import { BulkCreateTablesRequest, POS_VENUE_TEMPLATES, bulkTableLabels, planVenueTemplate } from '@injishi/contracts';

const none = { areas: new Map(), tables: new Map(), stations: new Map(), registers: new Map() };
const byKey = (key: string) => {
  const t = POS_VENUE_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`no template ${key}`);
  return t;
};

describe('starter venue templates', () => {
  it('are exactly Small bar, Restaurant and Restaurant + bar', () => {
    expect(POS_VENUE_TEMPLATES.map((t) => t.label)).toEqual(['Small bar', 'Restaurant', 'Restaurant + bar']);
  });

  it('give each template the stations its type needs', () => {
    expect(byKey('small_bar').stations.map((s) => s.kind)).toEqual(['bar']);
    expect(byKey('restaurant').stations.map((s) => s.kind)).toEqual(['kitchen']);
    expect(byKey('restaurant_bar').stations.map((s) => s.kind).sort()).toEqual(['bar', 'kitchen']);
  });

  it('never repeat a table label or a name inside one template (the outlet unique-name rules would refuse it)', () => {
    for (const t of POS_VENUE_TEMPLATES) {
      const labels = t.areas.flatMap((a) => bulkTableLabels(a.tables));
      expect(new Set(labels).size).toBe(labels.length);
      expect(new Set(t.areas.map((a) => a.name)).size).toBe(t.areas.length);
      expect(new Set(t.stations.map((s) => s.name)).size).toBe(t.stations.length);
      expect(new Set(t.registers.map((r) => r.name)).size).toBe(t.registers.length);
      for (const a of t.areas) {
        expect(BulkCreateTablesRequest.safeParse({ areaId: '00000000-0000-4000-8000-000000000000', ...a.tables }).success).toBe(true);
      }
    }
  });

  it('plans everything as new on an empty outlet', () => {
    const plan = planVenueTemplate(byKey('restaurant'), none);
    // 2 areas + 10 + 6 tables + 1 station + 1 register
    expect(plan.creates).toBe(20);
    expect(plan.skips).toBe(0);
    expect(plan.areas[0]?.tables.map((t) => t.label).slice(0, 3)).toEqual(['T1', 'T2', 'T3']);
  });

  it('skips what already exists and never plans to change it', () => {
    const plan = planVenueTemplate(byKey('restaurant_bar'), {
      areas: new Map([['Main hall', 'exists' as const]]),
      tables: new Map([['T1', 'exists' as const], ['T2', 'archived' as const]]),
      stations: new Map([['Kitchen', 'exists' as const]]),
      registers: new Map(),
    });
    const hall = plan.areas.find((a) => a.name === 'Main hall');
    expect(hall?.mark).toBe('exists');
    expect(hall?.tables.find((t) => t.label === 'T1')?.mark).toBe('exists');
    expect(hall?.tables.find((t) => t.label === 'T2')?.mark).toBe('archived');
    expect(hall?.tables.find((t) => t.label === 'T3')?.mark).toBe('new');
    expect(plan.stations.map((s) => `${s.name}:${s.mark}`)).toEqual(['Kitchen:exists', 'Bar:new']);
    // Main hall, T1, T2 and Kitchen are skipped; 3 areas + 24 tables + 2 stations + 2 registers = 31 rows in all.
    expect(plan.skips).toBe(4);
    expect(plan.creates).toBe(31 - 4);
  });

  it('skips every table of an archived area along with it', () => {
    const plan = planVenueTemplate(byKey('small_bar'), { ...none, areas: new Map([['Lounge', 'archived' as const]]) });
    const lounge = plan.areas.find((a) => a.name === 'Lounge');
    expect(lounge?.tables.every((t) => t.mark === 'archived')).toBe(true);
    expect(plan.skips).toBe(1 + 4);
  });
});
