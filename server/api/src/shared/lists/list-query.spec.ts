import { defineListSpec, ListQuery, type ListReader } from '@injishi/contracts';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PgDialect, date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { compileListQuery, groupsOf, ListQueryPipe, pageOf, type CompiledList } from './list-query';

/**
 * The server half of the list contract (058-list-framework AC-LF3, AC-LF4).
 * SQL is rendered through the Postgres dialect, so these assert what the
 * database would receive, not how the builder happened to be called.
 */

const people = pgTable('people', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  status: text('status').notNull(),
  hiredOn: date('hired_on').notNull(),
  wage: integer('wage'),
  branchId: uuid('branch_id'),
  lateMinutes: integer('late_minutes'),
});

const SPEC = defineListSpec({
  key: 'test.people',
  searchFields: ['name', 'phone'],
  statusField: 'status',
  defaultSort: [{ field: 'name', dir: 'asc' }],
  fields: [
    { key: 'name', label: 'Name', type: 'text', filterable: true, sortable: true },
    { key: 'status', label: 'Status', type: 'enum', enumValues: ['active', 'offboarded'], enumLabels: { active: 'Working' }, filterable: true, groupable: true },
    { key: 'hiredOn', label: 'Hired on', type: 'date', filterable: true, sortable: true },
    { key: 'wage', label: 'Wage', type: 'money', filterable: true, sortable: true, sensitive: true },
    { key: 'branch', label: 'Branch', type: 'ref', filterable: true, groupable: true },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'lateMinutes', label: 'Late minutes', type: 'number', filterable: true, figure: true },
  ],
});

const COLUMNS = {
  name: people.name,
  status: people.status,
  hiredOn: people.hiredOn,
  wage: people.wage,
  branch: people.branchId,
  phone: people.phone,
  lateMinutes: people.lateMinutes,
};

const dialect = new PgDialect();
const render = (fragment: ReturnType<typeof sql> | undefined): { sql: string; params: unknown[] } | undefined =>
  fragment ? dialect.sqlToQuery(fragment) : undefined;

function compile(input: object, reader: 'basic' | 'full' | ListReader = 'full'): CompiledList {
  return compileListQuery({
    spec: SPEC,
    columns: COLUMNS,
    reader,
    query: ListQuery.parse(input),
    tieBreaker: people.id,
  });
}

describe('compileListQuery', () => {
  it('turns every filter into a parameterised condition, never interpolated text', () => {
    const compiled = compile({
      filters: [
        { field: 'status', op: 'in', value: ['active'] },
        { field: 'hiredOn', op: 'between', value: ['2026-01-01', '2026-06-30'] },
        { field: 'branch', op: 'isNull' },
      ],
    });
    const where = render(compiled.where)!;
    expect(where.sql).toContain('"people"."status" in ($1)');
    expect(where.sql).toContain('"people"."hired_on" between $2 and $3');
    expect(where.sql).toContain('"people"."branch_id" is null');
    expect(where.params).toEqual(['active', '2026-01-01', '2026-06-30']);
  });

  it('searches the spec search fields and nothing else, escaping wildcards a person typed (AC-LF13)', () => {
    const compiled = compile({ q: '50%_off' });
    const where = render(compiled.where)!;
    expect(where.sql).toBe('("people"."name" ilike $1 or "people"."phone" ilike $2)');
    expect(where.params).toEqual(['%50\\%\\_off%', '%50\\%\\_off%']);
  });

  it('leaves the status filter out of the status count condition only', () => {
    const compiled = compile({
      filters: [
        { field: 'status', op: 'eq', value: 'active' },
        { field: 'name', op: 'contains', value: 'ada' },
      ],
    });
    expect(render(compiled.where)!.params).toEqual(['active', '%ada%']);
    expect(render(compiled.whereForStatusCounts)!.params).toEqual(['%ada%']);
  });

  it('orders by the asked sort, nulls last, then the tie breaker; falls back to the spec default', () => {
    const asked = compile({ sort: [{ field: 'hiredOn', dir: 'desc' }] });
    expect(asked.orderBy.map((o) => dialect.sqlToQuery(o).sql)).toEqual([
      '"people"."hired_on" desc nulls last',
      '"people"."id" asc',
    ]);
    const fallback = compile({});
    expect(dialect.sqlToQuery(fallback.orderBy[0]).sql).toBe('"people"."name" asc nulls last');
  });

  it('pages by offset from the query', () => {
    const compiled = compile({ page: 3, pageSize: 50 });
    expect(compiled.limit).toBe(50);
    expect(compiled.offset).toBe(100);
  });

  it('refuses an undeclared field with 422 and every issue', () => {
    expect(() =>
      compile({ filters: [{ field: 'date_of_birth', op: 'eq', value: '1990-01-01' }], groupBy: 'name' }),
    ).toThrow(UnprocessableEntityException);
    try {
      compile({ filters: [{ field: 'date_of_birth', op: 'eq', value: '1990-01-01' }], groupBy: 'name' });
    } catch (error) {
      const body = (error as UnprocessableEntityException).getResponse() as { issues: unknown[] };
      expect(body.issues).toHaveLength(2);
    }
  });

  it('refuses a sensitive field for a basic caller and allows it for a full one (AC-LF4)', () => {
    const query = { sort: [{ field: 'wage', dir: 'desc' }] };
    expect(() => compile(query, 'basic')).toThrow(UnprocessableEntityException);
    expect(() => compile(query, 'full')).not.toThrow();
  });

  it('names the group column only when grouping is asked', () => {
    expect(compile({}).groupColumn).toBeUndefined();
    expect(compile({ groupBy: 'branch' }).groupColumn).toBe(people.branchId);
  });

  it('orders by the group first, so a page never interleaves groups (AC-LF14)', () => {
    const grouped = compile({ groupBy: 'status', sort: [{ field: 'hiredOn', dir: 'desc' }] });
    expect(grouped.orderBy.map((o) => dialect.sqlToQuery(o).sql)).toEqual([
      '"people"."status" asc nulls last',
      '"people"."hired_on" desc nulls last',
      '"people"."id" asc',
    ]);
  });

  it('allows a work figure only to its audience, and never with a threshold (AC-LF12)', () => {
    const exact = { filters: [{ field: 'lateMinutes', op: 'eq', value: 0 }] };
    expect(() => compile(exact, 'full')).toThrow(UnprocessableEntityException);
    expect(() => compile(exact, { view: 'full', figures: true })).not.toThrow();
    const threshold = { filters: [{ field: 'lateMinutes', op: 'gte', value: 30 }] };
    expect(() => compile(threshold, { view: 'full', figures: true })).toThrow(UnprocessableEntityException);
  });
});

describe('groupsOf and pageOf', () => {
  it('labels groups from looked up names, enum labels, then the raw value; null is None', () => {
    const groups = groupsOf(
      SPEC,
      'status',
      [
        { key: 'active', count: 3 },
        { key: 'offboarded', count: 1 },
        { key: null, count: 2 },
      ],
    );
    expect(groups).toEqual([
      { key: 'active', label: 'Working', count: 3 },
      { key: 'offboarded', label: 'offboarded', count: 1 },
      { key: null, label: 'None', count: 2 },
    ]);
  });

  it('assembles the page with the query paging', () => {
    const page = pageOf(['a'], 41, ListQuery.parse({ page: 2, pageSize: 10 }));
    expect(page).toEqual({ items: ['a'], total: 41, page: 2, pageSize: 10 });
  });

  it('carries the stages a ref stage field needs, only when given', () => {
    const stages = [{ key: 's1', label: 'Screening' }];
    expect(pageOf([], 0, ListQuery.parse({}), { stages }).stages).toEqual(stages);
  });
});

describe('ListQueryPipe', () => {
  const pipe = new ListQueryPipe();
  it('reads search parameters into a query', () => {
    const query = pipe.transform({ s: '-hiredOn', size: '50', f: '[["status","eq","active"]]' });
    expect(query.sort).toEqual([{ field: 'hiredOn', dir: 'desc' }]);
    expect(query.pageSize).toBe(50);
    expect(query.filters).toEqual([{ field: 'status', op: 'eq', value: 'active' }]);
  });
  it('answers 400 for a malformed shape', () => {
    expect(() => pipe.transform({ f: 'nope' })).toThrow(BadRequestException);
  });
});
