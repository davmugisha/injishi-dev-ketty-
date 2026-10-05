import {
  checkListQuery,
  decodeListQuery,
  type ListCount,
  type ListField,
  type ListFilterOp,
  type ListGroup,
  type ListPage,
  type ListQuery,
  type ListReader,
  type ListSort,
  type ListSpec,
  type ListStage,
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
  or,
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
 * refused for a `basic` caller the same way (AC-LF3, AC-LF4), a work figure for
 * a reader outside its audience too (AC-LF12), and a key the spec allows but
 * the map lacks is a programming error, not a request error.
 */

/**
 * A field that is not one column: its filter is built by the repository (a
 * person in several departments is an EXISTS, not an equality). Such a field
 * may still sort or group by an expression when the spec allows it.
 */
export interface CustomListColumn {
  readonly filter: (op: ListFilterOp, value: unknown) => SQL;
  readonly expr?: AnyColumn | SQL;
}

/** Field key to column, expression or custom field. The only place a list names a column. */
export type ListColumns = Readonly<Record<string, AnyColumn | SQL | CustomListColumn>>;

function isCustom(column: AnyColumn | SQL | CustomListColumn): column is CustomListColumn {
  return typeof (column as CustomListColumn).filter === 'function';
}

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
  /** The caller's file view, and whether the route counts them in the list's figure audience. */
  readonly reader: ListView | ListReader;
  readonly query: ListQuery;
  /** Appended to every order, so pages never shuffle rows with equal sort values. */
  readonly tieBreaker: AnyColumn | SQL;
}

/** `%`, `_` and `\` are wildcards to ILIKE; a person typing them means the character. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function entryFor(columns: ListColumns, spec: ListSpec, key: string): AnyColumn | SQL | CustomListColumn {
  const column = columns[key];
  if (!column) throw new Error(`List ${spec.key}: field ${key} has no column mapped.`);
  return column;
}

/** The column or expression a field sorts and groups by. */
function columnFor(columns: ListColumns, spec: ListSpec, key: string): AnyColumn | SQL {
  const entry = entryFor(columns, spec, key);
  if (!isCustom(entry)) return entry;
  if (!entry.expr) throw new Error(`List ${spec.key}: custom field ${key} has no expression to sort or group by.`);
  return entry.expr;
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
  const { spec, columns, reader, query } = input;
  const issues = checkListQuery(spec, query, reader);
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
    const entry = entryFor(columns, spec, filter.field);
    return {
      field: filter.field,
      sql: isCustom(entry)
        ? entry.filter(filter.op, filter.value)
        : filterSql(field, entry, filter.op, filter.value),
    };
  });

  // Search runs over the spec's search fields and nothing else (AC-LF13);
  // `checkListQuery` has already refused `q` on a list that names none.
  const like = query.q ? `%${escapeLike(query.q)}%` : undefined;
  const searchPart = like
    ? or(...(spec.searchFields ?? []).map((key) => ilike(columnFor(columns, spec, key) as AnyColumn, like)))
    : undefined;

  const all = [...filterParts.map((p) => p.sql), ...(searchPart ? [searchPart] : [])];
  const withoutStatus = [
    ...filterParts.filter((p) => p.field !== spec.statusField).map((p) => p.sql),
    ...(searchPart ? [searchPart] : []),
  ];

  // With grouping on, rows come group by group, in the order `groupsOf` lists
  // the groups, so a page never interleaves two groups (AC-LF14).
  const groupColumn = query.groupBy ? columnFor(columns, spec, query.groupBy) : undefined;
  const sorts: readonly ListSort[] = query.sort.length > 0 ? query.sort : (spec.defaultSort ?? []);
  const orderBy = [
    ...(groupColumn ? [groupOrder(groupColumn)] : []),
    ...sorts.map((s) => {
      const column = columnFor(columns, spec, s.field);
      return s.dir === 'desc' ? sql`${column} desc nulls last` : sql`${column} asc nulls last`;
    }),
    asc(input.tieBreaker as AnyColumn),
  ];

  return {
    where: all.length > 0 ? and(...all) : undefined,
    whereForStatusCounts: withoutStatus.length > 0 ? and(...withoutStatus) : undefined,
    orderBy,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    groupColumn,
    statusColumn: spec.statusField ? columnFor(columns, spec, spec.statusField) : undefined,
  };
}

/** The one order groups take, for the rows and for the group counts alike. */
export function groupOrder(groupColumn: AnyColumn | SQL): SQL {
  return sql`${groupColumn} asc nulls last`;
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
        : field?.type === 'bool'
          ? key === 'true'
            ? 'Yes'
            : 'No'
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
  extras: { groups?: ListGroup[]; statusCounts?: ListCount[]; stages?: ListStage[] } = {},
): ListPage<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    ...(extras.groups ? { groups: extras.groups } : {}),
    ...(extras.statusCounts ? { statusCounts: extras.statusCounts } : {}),
    ...(extras.stages ? { stages: extras.stages } : {}),
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
