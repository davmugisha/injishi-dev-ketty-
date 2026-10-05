import {
  checkListQuery,
  decodeListQuery,
  type ListCount,
  type ListField,
  type ListGroup,
  type ListPage,
  type ListQuery,
  type ListSort,
  type ListSpec,
  type ListView,
} from '@injishi/contracts';
import {
  BadRequestException,
  Injectable,
  type PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';

/**
 * The server half of the one list contract (ADR-058, 058-list-framework).
 *
 * A repository hands over its list spec, the ONE map from field key to column
 * (or SQL expression), the caller's file view and the parsed query, and gets
 * back SQL fragments to add to its own query. The repository keeps doing what
 * it already does first, `org_id` and branch scope; this adds filters, search,
 * order and paging on top, and never widens what the repository selected.
 *
 * Nothing here accepts a column name from a request. A field key the spec does
 * not allow is refused 422 before any SQL is built, a sensitive field is
 * refused for a `basic` caller the same way (AC-LF3, AC-LF4), and a key the
 * spec allows but the map lacks is a programming error, not a request error.
 */

/** Field key to column or expression. The only place a list names a column. */
export type ListColumns = Readonly<Record<string, AnyColumn | SQL>>;

export interface CompiledList {
  /** Spec filters and search, ANDed. Undefined when there are none. */
  readonly where: SQL | undefined;
  /** The same without the status field's own filters, for the status chip counts. */
  readonly whereForStatusCounts: SQL | undefined;
  readonly orderBy: SQL[];
  readonly limit: number;
  readonly offset: number;
  /** The column to group by, when the query asks for grouping. */
  readonly groupColumn: AnyColumn | SQL | undefined;
  /** The status field's column, when the spec declares one. */
  readonly statusColumn: AnyColumn | SQL | undefined;
}

export interface CompileInput {
  readonly spec: ListSpec;
  readonly columns: ListColumns;
  readonly view: ListView;
  readonly query: ListQuery;
  /** Builds the search condition for `q`; required when the spec is searchable. */
  readonly search?: (q: string) => SQL | undefined;
  /** Appended to every order, so pages never shuffle rows with equal sort values. */
  readonly tieBreaker: AnyColumn | SQL;
}

/** `%`, `_` and `\` are wildcards to ILIKE; a person typing them means the character. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function columnFor(columns: ListColumns, spec: ListSpec, key: string): AnyColumn | SQL {
  const column = columns[key];
  if (!column) throw new Error(`List ${spec.key}: field ${key} has no column mapped.`);
  return column;
}

function asValue(field: ListField, value: unknown): unknown {
  // A datetime travels as an ISO string; Postgres compares a timestamptz with a Date.
  return field.type === 'datetime' && typeof value === 'string' ? new Date(value) : value;
}

/** One filter as SQL. The value has already been checked against the field type. */
function filterSql(field: ListField, column: AnyColumn | SQL, op: string, value: unknown): SQL {
  // Drizzle's operator overloads type a column; an SQL expression renders the
  // same way, so the expression branch is narrowed as `inBranchScope` does.
  const col = column as AnyColumn;
  switch (op) {
    case 'eq':
      return eq(col, asValue(field, value));
    case 'ne':
      return ne(col, asValue(field, value));
    case 'in':
      return inArray(col, (value as unknown[]).map((v) => asValue(field, v)));
    case 'nin':
      return notInArray(col, (value as unknown[]).map((v) => asValue(field, v)));
    case 'contains':
      return ilike(col, `%${escapeLike(String(value))}%`);
    case 'gt':
      return gt(col, asValue(field, value));
    case 'gte':
      return gte(col, asValue(field, value));
    case 'lt':
      return lt(col, asValue(field, value));
    case 'lte':
      return lte(col, asValue(field, value));
    case 'between': {
      const [from, to] = value as [unknown, unknown];
      return between(col, asValue(field, from), asValue(field, to));
    }
    case 'isNull':
      return isNull(col);
    case 'isNotNull':
      return isNotNull(col);
    default:
      throw new Error(`Unknown list operator ${op}.`);
  }
}

/**
 * Check the query against the spec (422 with every issue) and compile it.
 */
export function compileListQuery(input: CompileInput): CompiledList {
  const { spec, columns, view, query } = input;
  const issues = checkListQuery(spec, query, view);
  if (issues.length > 0) {
    throw new UnprocessableEntityException({
      code: 'list_query_not_allowed',
      message: issues.map((i) => i.message).join(' '),
      issues,
    });
  }
  const fields = new Map(spec.fields.map((f) => [f.key, f]));

  const filterParts: { field: string; sql: SQL }[] = query.filters.map((filter) => {
    const field = fields.get(filter.field) as ListField;
    return {
      field: filter.field,
      sql: filterSql(field, columnFor(columns, spec, filter.field), filter.op, filter.value),
    };
  });

  const searchPart =
    query.q && spec.searchable
      ? (() => {
          if (!input.search) throw new Error(`List ${spec.key} is searchable but has no search builder.`);
          return input.search(query.q);
        })()
      : undefined;

  const all = [...filterParts.map((p) => p.sql), ...(searchPart ? [searchPart] : [])];
  const withoutStatus = [
    ...filterParts.filter((p) => p.field !== spec.statusField).map((p) => p.sql),
    ...(searchPart ? [searchPart] : []),
  ];

  const sorts: readonly ListSort[] = query.sort.length > 0 ? query.sort : (spec.defaultSort ?? []);
  const orderBy = sorts.map((s) => {
    const column = columnFor(columns, spec, s.field);
    return s.dir === 'desc' ? sql`${column} desc nulls last` : sql`${column} asc nulls last`;
  });
  orderBy.push(asc(input.tieBreaker as AnyColumn));

  return {
    where: all.length > 0 ? and(...all) : undefined,
    whereForStatusCounts: withoutStatus.length > 0 ? and(...withoutStatus) : undefined,
    orderBy,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    groupColumn: query.groupBy ? columnFor(columns, spec, query.groupBy) : undefined,
    statusColumn: spec.statusField ? columnFor(columns, spec, spec.statusField) : undefined,
  };
}

/** `count(*)` as an int, for the total and the group and status counts. */
export const countAll = sql<number>`count(*)::int`;

/**
 * The label a group shows: the spec's enum label, a label the repository looked
 * up (a branch name for a branch id), or the raw value.
 */
export function groupsOf(
  spec: ListSpec,
  groupBy: string | undefined,
  rows: readonly { key: unknown; count: number }[],
  labels: ReadonlyMap<string, string> = new Map(),
): ListGroup[] | undefined {
  if (!groupBy) return undefined;
  const field = spec.fields.find((f) => f.key === groupBy);
  return rows.map((row) => {
    const key = row.key === null || row.key === undefined ? null : String(row.key);
    const label =
      key === null
        ? 'None'
        : (labels.get(key) ?? field?.enumLabels?.[key] ?? key);
    return { key, label, count: Number(row.count) };
  });
}

export function statusCountsOf(rows: readonly { value: unknown; count: number }[]): ListCount[] {
  return rows
    .filter((r) => r.value !== null && r.value !== undefined)
    .map((r) => ({ value: String(r.value), count: Number(r.count) }));
}

/** Assemble the page every list route answers. */
export function pageOf<T>(
  items: T[],
  total: number,
  query: ListQuery,
  extras: { groups?: ListGroup[]; statusCounts?: ListCount[] } = {},
): ListPage<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    ...(extras.groups ? { groups: extras.groups } : {}),
    ...(extras.statusCounts ? { statusCounts: extras.statusCounts } : {}),
  };
}

/**
 * Reads a `ListQuery` from a GET's search parameters (`@Query(ListQueryPipe)`).
 * A malformed shape is 400; a well formed query the spec refuses is 422, from
 * `compileListQuery`.
 */
@Injectable()
export class ListQueryPipe implements PipeTransform<unknown, ListQuery> {
  transform(value: unknown): ListQuery {
    const decoded = decodeListQuery((value ?? {}) as Record<string, string | string[] | undefined>);
    if (!decoded.ok) {
      throw new BadRequestException({ code: 'list_query_malformed', message: decoded.message });
    }
    return decoded.query;
  }
}
