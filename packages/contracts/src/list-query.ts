import { z } from "zod";
import type { Permission } from "./authz";
/**
 * The one list contract (ADR-058, 058-list-framework).
 *
 * Every HR list screen and every HR list route speaks this: a list declares its
 * fields once in a `ListSpec`, the client builds its filter panel, sort and
 * grouping from that declaration, and the server refuses anything the
 * declaration does not allow. No request ever names a database column; the
 * field key is the only name that crosses the wire, and each repository holds
 * the one map from key to column.
 *
 * A field marked `sensitive` (date of birth, ID number, RSSB number, wages,
 * bank details) is invisible to a caller whose file view is `basic`: it cannot
 * be returned, filtered, sorted, grouped or exported for them (AC-LF4).
 *
 * A field marked `figure` measures a person's work (late minutes, overtime,
 * leave taken, objective progress). The no ranking rule (contract 7) is
 * enforced here rather than on each screen: such a field can never be sorted,
 * grouped or filtered by a threshold, and only a reader the list counts in its
 * figure audience sees it at all (AC-LF12).
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
export const ListFieldType = z.enum([
    "text",
    "number",
    "money",
    "date",
    "datetime",
    "enum",
    "bool",
    "ref",
]);
export type ListFieldType = z.infer<typeof ListFieldType>;
/** A closed list. Adding an operator is a change to 058-list-framework. */
export const ListFilterOp = z.enum([
    "eq",
    "ne",
    "in",
    "nin",
    "contains",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "isNull",
    "isNotNull",
]);
export type ListFilterOp = z.infer<typeof ListFilterOp>;
const ORDERED: readonly ListFilterOp[] = [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "isNull",
    "isNotNull",
];
/** Which operators make sense for each field type. Anything else is refused. */
export const OPS_FOR_TYPE: Readonly<Record<ListFieldType, readonly ListFilterOp[]>> = {
    text: ["eq", "ne", "in", "nin", "contains", "isNull", "isNotNull"],
    number: ORDERED,
    money: ORDERED,
    date: ORDERED,
    datetime: ["gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"],
    enum: ["eq", "ne", "in", "nin", "isNull", "isNotNull"],
    bool: ["eq", "isNull", "isNotNull"],
    ref: ["eq", "ne", "in", "nin", "isNull", "isNotNull"],
};
/** The operators a work figure allows: never one that orders, so no threshold rebuilds a ranking. */
const FIGURE_OPS: readonly ListFilterOp[] = ["eq", "ne", "in", "nin", "isNull", "isNotNull"];
/** The operators one field allows: its type's, narrowed for a work figure. */
export function opsFor(field: Pick<ListField, "type" | "figure">): readonly ListFilterOp[] {
    const ops = OPS_FOR_TYPE[field.type];
    return field.figure ? ops.filter((op) => FIGURE_OPS.includes(op)) : ops;
}
/** The file view a caller reads (058-first-thread AC-P2). */
export type ListView = "basic" | "full";
/**
 * Who reads a list: their file view, and whether the list's route counts them
 * in its figure audience (AC-LF12). A bare view means no figures.
 */
export interface ListReader {
    readonly view: ListView;
    readonly figures?: boolean;
}
function readerOf(reader: ListView | ListReader): ListReader {
    return typeof reader === "string" ? { view: reader } : reader;
}
export interface ListField {
    /** The wire name. Never a column name. */
    readonly key: string;
    readonly label: string;
    readonly type: ListFieldType;
    readonly filterable?: boolean;
    readonly sortable?: boolean;
    readonly groupable?: boolean;
    /** Shown, filtered, sorted, grouped and exported for a `full` view only. */
    readonly sensitive?: boolean;
    /** A measure of a person's work: never sortable, groupable or threshold filtered (AC-LF12). */
    readonly figure?: boolean;
    /** Required for `enum` fields: the values, in display order. */
    readonly enumValues?: readonly string[];
    /** Labels for enum values, when the raw value is not fit to show. */
    readonly enumLabels?: Readonly<Record<string, string>>;
}
export interface ListSort {
    readonly field: string;
    readonly dir: "asc" | "desc";
}
export interface ListSpec {
    /** Unique across the product, e.g. `staff.employees`. Saved views key on it. */
    readonly key: string;
    readonly fields: readonly ListField[];
    /**
     * The kanban columns, when the list has a board: an enum field, or a `ref`
     * whose stages the route supplies in `ListPage.stages` (AC-LF14).
     */
    readonly stageField?: string;
    /** An enum field the status chips count and filter by. */
    readonly statusField?: string;
    /** The text fields free text search (`q`) runs over; none means the list has no search (AC-LF13). */
    readonly searchFields?: readonly string[];
    /** The order when the query names none. */
    readonly defaultSort?: readonly ListSort[];
}
/**
 * Declare a list. Refuses at module load (so a mistake fails the build and the
 * tests, never a request) a duplicate key, an enum without values, a stage or
 * status field of the wrong type, a default sort on an unsortable field, a
 * search field that is not a plain text field, and a work figure that could be
 * sorted or grouped.
 */
export function defineListSpec<const S extends ListSpec>(spec: S): S {
    const keys = new Set<string>();
    for (const field of spec.fields) {
        if (keys.has(field.key))
            throw new Error(`List ${spec.key}: field ${field.key} is declared twice.`);
        keys.add(field.key);
        if (field.type === "enum" && !(field.enumValues && field.enumValues.length > 0)) {
            throw new Error(`List ${spec.key}: enum field ${field.key} has no values.`);
        }
        if (field.figure && (field.sortable || field.groupable)) {
            throw new Error(`List ${spec.key}: ${field.key} is a work figure, which is never sorted or grouped.`);
        }
    }
    const fieldOf = (name: string) => spec.fields.find((f) => f.key === name);
    if (spec.stageField !== undefined) {
        const type = fieldOf(spec.stageField)?.type;
        if (type !== "enum" && type !== "ref") {
            throw new Error(`List ${spec.key}: stageField ${spec.stageField} must be a declared enum or ref field.`);
        }
    }
    if (spec.statusField !== undefined && fieldOf(spec.statusField)?.type !== "enum") {
        throw new Error(`List ${spec.key}: statusField ${spec.statusField} must be a declared enum field.`);
    }
    for (const name of spec.searchFields ?? []) {
        const field = fieldOf(name);
        if (!field || field.type !== "text" || field.sensitive || field.figure) {
            throw new Error(`List ${spec.key}: search field ${name} must be a declared text field that is neither sensitive nor a figure.`);
        }
    }
    for (const sort of spec.defaultSort ?? []) {
        if (!fieldOf(sort.field)?.sortable)
            throw new Error(`List ${spec.key}: default sort ${sort.field} is not sortable.`);
    }
    return Object.freeze(spec);
}
/** The fields a reader may see at all: no sensitive field for a `basic` view, no figure outside the figure audience. */
export function visibleFields(spec: ListSpec, reader: ListView | ListReader): readonly ListField[] {
    const { view, figures } = readerOf(reader);
    return spec.fields.filter((f) => (view === "full" || !f.sensitive) && (figures || !f.figure));
}
// ---------------------------------------------------------------------------
// The query
// ---------------------------------------------------------------------------
const Scalar = z.union([z.string().max(200), z.number().finite(), z.boolean()]);
export const ListFilter = z.object({
    field: z.string().min(1).max(64),
    op: ListFilterOp,
    /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
    value: z.union([Scalar, z.array(z.union([z.string().max(200), z.number().finite()])).max(50)]).optional(),
});
export type ListFilter = z.infer<typeof ListFilter>;
export const ListSortSchema = z.object({
    field: z.string().min(1).max(64),
    dir: z.enum(["asc", "desc"]),
});
export const LIST_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const ListPageSize = z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]);
export type ListPageSize = z.infer<typeof ListPageSize>;
export const ListQuery = z.object({
    q: z.string().trim().max(100).optional(),
    filters: z.array(ListFilter).max(20).default([]),
    sort: z.array(ListSortSchema).max(3).default([]),
    groupBy: z.string().min(1).max(64).optional(),
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: ListPageSize.default(DEFAULT_PAGE_SIZE),
});
export type ListQuery = z.output<typeof ListQuery>;
export type ListQueryInput = z.input<typeof ListQuery>;
/** One reason a query does not fit its spec. */
export interface ListQueryIssue {
    readonly path: string;
    readonly message: string;
}
/**
 * Check a parsed query against a spec, for a caller with this view.
 *
 * The server answers 422 with these issues; the client uses the same function
 * to drop the parts of a saved view or a pasted link that no longer fit, so the
 * two can never disagree about what a list allows.
 */
export function checkListQuery(spec: ListSpec, query: ListQuery, reader: ListView | ListReader): ListQueryIssue[] {
    const issues: ListQueryIssue[] = [];
    const fields = new Map(visibleFields(spec, reader).map((f) => [f.key, f]));
    if (query.q !== undefined && query.q !== "" && (spec.searchFields ?? []).length === 0) {
        issues.push({ path: "q", message: "This list has no search." });
    }
    query.filters.forEach((filter, i) => {
        const path = `filters.${i}`;
        const field = fields.get(filter.field);
        if (!field || !field.filterable) {
            issues.push({ path, message: `${filter.field} cannot be filtered.` });
            return;
        }
        if (!opsFor(field).includes(filter.op)) {
            issues.push({ path, message: `That condition does not apply to ${field.label}.` });
            return;
        }
        const problem = valueProblem(field, filter);
        if (problem)
            issues.push({ path, message: problem });
    });
    query.sort.forEach((sort, i) => {
        const field = fields.get(sort.field);
        if (!field || !field.sortable)
            issues.push({ path: `sort.${i}`, message: `${sort.field} cannot be sorted.` });
    });
    if (query.groupBy !== undefined) {
        const field = fields.get(query.groupBy);
        if (!field || !field.groupable)
            issues.push({ path: "groupBy", message: `${query.groupBy} cannot be grouped.` });
    }
    return issues;
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function scalarFits(field: ListField, value: unknown): boolean {
    switch (field.type) {
        case "text":
        case "ref":
            return typeof value === "string" && value.length > 0;
        case "enum":
            return typeof value === "string" && (field.enumValues ?? []).includes(value);
        case "number":
        case "money":
            return typeof value === "number" && Number.isFinite(value);
        case "date":
            return typeof value === "string" && ISO_DATE.test(value);
        case "datetime":
            return typeof value === "string" && !Number.isNaN(Date.parse(value));
        case "bool":
            return typeof value === "boolean";
    }
}
function valueProblem(field: ListField, filter: ListFilter): string | null {
    const { op, value } = filter;
    if (op === "isNull" || op === "isNotNull") {
        return value === undefined ? null : `${field.label}: that condition takes no value.`;
    }
    if (op === "in" || op === "nin") {
        if (!Array.isArray(value) || value.length === 0)
            return `Choose at least one value for ${field.label}.`;
        return value.every((v) => scalarFits(field, v)) ? null : `A value does not fit ${field.label}.`;
    }
    if (op === "between") {
        if (!Array.isArray(value) || value.length !== 2 || value.some((v) => v === undefined || v === null))
            return `Give both ends of the range for ${field.label}.`;
        return value.every((v) => scalarFits(field, v)) ? null : `A value does not fit ${field.label}.`;
    }
    if (Array.isArray(value) || value === undefined)
        return `Give a value for ${field.label}.`;
    return scalarFits(field, value) ? null : `The value does not fit ${field.label}.`;
}
/** The query with every part that does not fit the spec removed (for links and saved views). */
export function fitListQuery(spec: ListSpec, query: ListQuery, reader: ListView | ListReader): ListQuery {
    const issues = new Set(checkListQuery(spec, query, reader).map((i) => i.path));
    return {
        ...query,
        q: issues.has("q") ? undefined : query.q,
        filters: query.filters.filter((_, i) => !issues.has(`filters.${i}`)),
        sort: query.sort.filter((_, i) => !issues.has(`sort.${i}`)),
        groupBy: issues.has("groupBy") ? undefined : query.groupBy,
    };
}
// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
export const ListGroup = z.object({
    /** The group's raw value; null for rows with none. */
    key: z.string().nullable(),
    label: z.string(),
    count: z.number().int().nonnegative(),
});
export type ListGroup = z.infer<typeof ListGroup>;
export const ListCount = z.object({
    value: z.string(),
    count: z.number().int().nonnegative(),
});
export type ListCount = z.infer<typeof ListCount>;
/** A kanban column for a `ref` stage field, in board order (per opening stages, for example). */
export const ListStage = z.object({
    key: z.string(),
    label: z.string(),
});
export type ListStage = z.infer<typeof ListStage>;
/** `ListPage` of a given row schema. */
export function listPage<T extends z.ZodTypeAny>(item: T) {
    return z.object({
        items: z.array(item),
        total: z.number().int().nonnegative(),
        page: z.number().int().min(1),
        pageSize: ListPageSize,
        groups: z.array(ListGroup).optional(),
        statusCounts: z.array(ListCount).optional(),
        stages: z.array(ListStage).optional(),
    });
}
export type ListPage<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: ListPageSize;
    groups?: ListGroup[];
    statusCounts?: ListCount[];
    stages?: ListStage[];
};
// ---------------------------------------------------------------------------
// On the wire: a GET's search parameters
// ---------------------------------------------------------------------------
/**
 * `q`, `f` (filters as compact JSON: `[["status","eq","active"]]`), `s` (sort as
 * `hiredOn,-name`, minus for descending), `g` (group by), `page`, `size`. Empty
 * parts are left out, so a cleared filter leaves no trace in the URL.
 */
export function encodeListQuery(query: ListQueryInput): Record<string, string> {
    const out: Record<string, string> = {};
    if (query.q)
        out.q = query.q;
    if (query.filters && query.filters.length > 0) {
        out.f = JSON.stringify(query.filters.map((f) => (f.value === undefined ? [f.field, f.op] : [f.field, f.op, f.value])));
    }
    if (query.sort && query.sort.length > 0) {
        out.s = query.sort.map((s) => (s.dir === "desc" ? `-${s.field}` : s.field)).join(",");
    }
    if (query.groupBy)
        out.g = query.groupBy;
    if (query.page && query.page !== 1)
        out.page = String(query.page);
    if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE)
        out.size = String(query.pageSize);
    return out;
}
/** `URLSearchParams` in a browser or Next, or anything else with `get` (this package ships no DOM types). */
interface ParamGetter {
    get(key: string): string | null;
}
type ParamSource = ParamGetter | Readonly<Record<string, string | string[] | undefined>>;
function isGetter(source: ParamSource): source is ParamGetter {
    return typeof (source as ParamGetter).get === "function";
}
function param(source: ParamSource, key: string): string | undefined {
    if (isGetter(source))
        return source.get(key) ?? undefined;
    const value = source[key];
    return Array.isArray(value) ? value[0] : value;
}
export type DecodedListQuery = {
    ok: true;
    query: ListQuery;
} | {
    ok: false;
    message: string;
};
/** Read a query from search parameters. Shape errors only; spec errors are `checkListQuery`'s. */
export function decodeListQuery(source: ParamSource): DecodedListQuery {
    let filters: unknown = [];
    const f = param(source, "f");
    if (f) {
        try {
            const raw: unknown = JSON.parse(f);
            if (!Array.isArray(raw))
                return { ok: false, message: "f must be a list of filters." };
            filters = raw.map((entry: unknown) => Array.isArray(entry)
                ? { field: entry[0], op: entry[1], ...(entry.length > 2 ? { value: entry[2] } : {}) }
                : entry);
        }
        catch {
            return { ok: false, message: "f is not valid JSON." };
        }
    }
    const s = param(source, "s");
    const sort = s
        ? s.split(",").filter(Boolean).map((part) => part.startsWith("-") ? { field: part.slice(1), dir: "desc" } : { field: part, dir: "asc" })
        : [];
    const page = param(source, "page");
    const size = param(source, "size");
    const parsed = ListQuery.safeParse({
        q: param(source, "q") || undefined,
        filters,
        sort,
        groupBy: param(source, "g") || undefined,
        page: page === undefined ? undefined : Number(page),
        pageSize: size === undefined ? undefined : Number(size),
    });
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, message: `${first.path.join(".") || "query"}: ${first.message}` };
    }
    return { ok: true, query: parsed.data };
}
// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------
export const ListViewKind = z.enum(["list", "card", "kanban"]);
export type ListViewKind = z.infer<typeof ListViewKind>;
/** What a saved view stores: the query without its page, plus how it looks. */
export const SavedViewConfig = z.object({
    q: z.string().trim().max(100).optional(),
    filters: z.array(ListFilter).max(20).default([]),
    sort: z.array(ListSortSchema).max(3).default([]),
    groupBy: z.string().min(1).max(64).optional(),
    pageSize: ListPageSize.default(DEFAULT_PAGE_SIZE),
    columns: z.array(z.string().min(1).max(64)).max(60).optional(),
    view: ListViewKind.default("list"),
});
export type SavedViewConfig = z.infer<typeof SavedViewConfig>;
export const SavedView = z.object({
    id: z.string().uuid(),
    listKey: z.string(),
    name: z.string(),
    config: SavedViewConfig,
    shared: z.boolean(),
    isDefault: z.boolean(),
    mine: z.boolean(),
    authorName: z.string().nullable(),
    updatedAt: z.string(),
});
export type SavedView = z.infer<typeof SavedView>;
export const SavedViewList = z.object({ views: z.array(SavedView) });
export type SavedViewList = z.infer<typeof SavedViewList>;
export const CreateSavedViewRequest = z.object({
    listKey: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(60),
    config: SavedViewConfig,
    shared: z.boolean().default(false),
    isDefault: z.boolean().default(false),
});
export type CreateSavedViewRequest = z.infer<typeof CreateSavedViewRequest>;
export const UpdateSavedViewRequest = z
    .object({
    name: z.string().trim().min(1).max(60).optional(),
    config: SavedViewConfig.optional(),
    shared: z.boolean().optional(),
    isDefault: z.boolean().optional(),
})
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateSavedViewRequest = z.infer<typeof UpdateSavedViewRequest>;
// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------
export const MAX_BULK_IDS = 200;
export const BulkRequest = z.object({
    action: z.string().min(1).max(40),
    ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_IDS),
    params: z.record(z.unknown()).optional(),
});
export type BulkRequest = z.infer<typeof BulkRequest>;
export const BulkResult = z.object({
    id: z.string().uuid(),
    ok: z.boolean(),
    /** The single command's own refusal, in its own words. */
    error: z.string().optional(),
    status: z.number().int().optional(),
});
export const BulkResponse = z.object({ results: z.array(BulkResult) });
export type BulkResponse = z.infer<typeof BulkResponse>;
/**
 * What a list's `ids` route answers for select all (AC-LF15): the ids matching
 * the filter, at most `MAX_BULK_IDS`, and how many match. Above the cap the
 * screen asks to narrow the filter rather than act on part of it.
 */
export const ListIds = z.object({
    ids: z.array(z.string().uuid()).max(MAX_BULK_IDS),
    total: z.number().int().nonnegative(),
});
export type ListIds = z.infer<typeof ListIds>;
/** Export caps (AC-LF7). */
export const MAX_EXPORT_ROWS = 10000;
// ---------------------------------------------------------------------------
// Which permissions read each list (the route's own declaration)
// ---------------------------------------------------------------------------
/**
 * Moved here from `apps/app`'s `OPS_READ` so the saved views route and the app
 * read one table (058-list-framework). Each value is exactly what that list's
 * route declares; a list key absent here has no saved views.
 */
export const LIST_READ = {
    "staff.employees": ["people.view", "people.manage", "payroll.run"],
    "staff.roster": ["roster.manage", "attendance.record", "people.view"],
    "staff.attendance": ["attendance.record", "attendance.approve"],
    "staff.leave-requests": ["leave.approve"],
    // ADR-069 D-e: the pay-run list is a draft route, so a drafter reads it too.
    "staff.pay-runs": ["payroll.draft", "payroll.run"],
    // 058-time: shift requests are the roster's; attendance requests are decided by attendance.approve.
    "staff.shift-requests": ["roster.manage"],
    "staff.attendance-requests": ["attendance.approve"],
    // 058-leave: allocations are decided by leave.approve; balances read by whoever decides or keeps the files.
    "staff.leave-allocations": ["leave.approve"],
    "staff.leave-balances": ["leave.approve", "people.manage"],
    // 058-payroll: everything here is payroll.run's; contracts are the files' too.
    "staff.payslips": ["payroll.run"],
    "staff.loans": ["payroll.run"],
    "staff.pay-claims": ["payroll.run"],
    "staff.pay-adjustments": ["payroll.run"],
    "staff.contracts": ["people.manage", "payroll.run"],
} as const satisfies Record<string, readonly Permission[]>;
export type ListKey = keyof typeof LIST_READ;
export function isListKey(key: string): key is ListKey {
    return Object.prototype.hasOwnProperty.call(LIST_READ, key);
}
