"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIST_READ = exports.MAX_EXPORT_ROWS = exports.ListIds = exports.BulkResponse = exports.BulkResult = exports.BulkRequest = exports.MAX_BULK_IDS = exports.UpdateSavedViewRequest = exports.CreateSavedViewRequest = exports.SavedViewList = exports.SavedView = exports.SavedViewConfig = exports.ListViewKind = exports.ListStage = exports.ListCount = exports.ListGroup = exports.ListQuery = exports.ListPageSize = exports.DEFAULT_PAGE_SIZE = exports.LIST_PAGE_SIZES = exports.ListSortSchema = exports.ListFilter = exports.OPS_FOR_TYPE = exports.ListFilterOp = exports.ListFieldType = void 0;
exports.opsFor = opsFor;
exports.defineListSpec = defineListSpec;
exports.visibleFields = visibleFields;
exports.checkListQuery = checkListQuery;
exports.fitListQuery = fitListQuery;
exports.listPage = listPage;
exports.encodeListQuery = encodeListQuery;
exports.decodeListQuery = decodeListQuery;
exports.isListKey = isListKey;
const zod_1 = require("zod");
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
exports.ListFieldType = zod_1.z.enum([
    "text",
    "number",
    "money",
    "date",
    "datetime",
    "enum",
    "bool",
    "ref",
]);
/** A closed list. Adding an operator is a change to 058-list-framework. */
exports.ListFilterOp = zod_1.z.enum([
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
const ORDERED = [
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
exports.OPS_FOR_TYPE = {
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
const FIGURE_OPS = ["eq", "ne", "in", "nin", "isNull", "isNotNull"];
/** The operators one field allows: its type's, narrowed for a work figure. */
function opsFor(field) {
    const ops = exports.OPS_FOR_TYPE[field.type];
    return field.figure ? ops.filter((op) => FIGURE_OPS.includes(op)) : ops;
}
function readerOf(reader) {
    return typeof reader === "string" ? { view: reader } : reader;
}
/**
 * Declare a list. Refuses at module load (so a mistake fails the build and the
 * tests, never a request) a duplicate key, an enum without values, a stage or
 * status field of the wrong type, a default sort on an unsortable field, a
 * search field that is not a plain text field, and a work figure that could be
 * sorted or grouped.
 */
function defineListSpec(spec) {
    const keys = new Set();
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
    const fieldOf = (name) => spec.fields.find((f) => f.key === name);
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
function visibleFields(spec, reader) {
    const { view, figures } = readerOf(reader);
    return spec.fields.filter((f) => (view === "full" || !f.sensitive) && (figures || !f.figure));
}
// ---------------------------------------------------------------------------
// The query
// ---------------------------------------------------------------------------
const Scalar = zod_1.z.union([zod_1.z.string().max(200), zod_1.z.number().finite(), zod_1.z.boolean()]);
exports.ListFilter = zod_1.z.object({
    field: zod_1.z.string().min(1).max(64),
    op: exports.ListFilterOp,
    /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
    value: zod_1.z.union([Scalar, zod_1.z.array(zod_1.z.union([zod_1.z.string().max(200), zod_1.z.number().finite()])).max(50)]).optional(),
});
exports.ListSortSchema = zod_1.z.object({
    field: zod_1.z.string().min(1).max(64),
    dir: zod_1.z.enum(["asc", "desc"]),
});
exports.LIST_PAGE_SIZES = [10, 25, 50, 100];
exports.DEFAULT_PAGE_SIZE = 25;
exports.ListPageSize = zod_1.z.union([zod_1.z.literal(10), zod_1.z.literal(25), zod_1.z.literal(50), zod_1.z.literal(100)]);
exports.ListQuery = zod_1.z.object({
    q: zod_1.z.string().trim().max(100).optional(),
    filters: zod_1.z.array(exports.ListFilter).max(20).default([]),
    sort: zod_1.z.array(exports.ListSortSchema).max(3).default([]),
    groupBy: zod_1.z.string().min(1).max(64).optional(),
    page: zod_1.z.number().int().min(1).max(100000).default(1),
    pageSize: exports.ListPageSize.default(exports.DEFAULT_PAGE_SIZE),
});
/**
 * Check a parsed query against a spec, for a caller with this view.
 *
 * The server answers 422 with these issues; the client uses the same function
 * to drop the parts of a saved view or a pasted link that no longer fit, so the
 * two can never disagree about what a list allows.
 */
function checkListQuery(spec, query, reader) {
    const issues = [];
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
function scalarFits(field, value) {
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
function valueProblem(field, filter) {
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
function fitListQuery(spec, query, reader) {
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
exports.ListGroup = zod_1.z.object({
    /** The group's raw value; null for rows with none. */
    key: zod_1.z.string().nullable(),
    label: zod_1.z.string(),
    count: zod_1.z.number().int().nonnegative(),
});
exports.ListCount = zod_1.z.object({
    value: zod_1.z.string(),
    count: zod_1.z.number().int().nonnegative(),
});
/** A kanban column for a `ref` stage field, in board order (per opening stages, for example). */
exports.ListStage = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string(),
});
/** `ListPage` of a given row schema. */
function listPage(item) {
    return zod_1.z.object({
        items: zod_1.z.array(item),
        total: zod_1.z.number().int().nonnegative(),
        page: zod_1.z.number().int().min(1),
        pageSize: exports.ListPageSize,
        groups: zod_1.z.array(exports.ListGroup).optional(),
        statusCounts: zod_1.z.array(exports.ListCount).optional(),
        stages: zod_1.z.array(exports.ListStage).optional(),
    });
}
// ---------------------------------------------------------------------------
// On the wire: a GET's search parameters
// ---------------------------------------------------------------------------
/**
 * `q`, `f` (filters as compact JSON: `[["status","eq","active"]]`), `s` (sort as
 * `hiredOn,-name`, minus for descending), `g` (group by), `page`, `size`. Empty
 * parts are left out, so a cleared filter leaves no trace in the URL.
 */
function encodeListQuery(query) {
    const out = {};
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
    if (query.pageSize && query.pageSize !== exports.DEFAULT_PAGE_SIZE)
        out.size = String(query.pageSize);
    return out;
}
function isGetter(source) {
    return typeof source.get === "function";
}
function param(source, key) {
    if (isGetter(source))
        return source.get(key) ?? undefined;
    const value = source[key];
    return Array.isArray(value) ? value[0] : value;
}
/** Read a query from search parameters. Shape errors only; spec errors are `checkListQuery`'s. */
function decodeListQuery(source) {
    let filters = [];
    const f = param(source, "f");
    if (f) {
        try {
            const raw = JSON.parse(f);
            if (!Array.isArray(raw))
                return { ok: false, message: "f must be a list of filters." };
            filters = raw.map((entry) => Array.isArray(entry)
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
    const parsed = exports.ListQuery.safeParse({
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
exports.ListViewKind = zod_1.z.enum(["list", "card", "kanban"]);
/** What a saved view stores: the query without its page, plus how it looks. */
exports.SavedViewConfig = zod_1.z.object({
    q: zod_1.z.string().trim().max(100).optional(),
    filters: zod_1.z.array(exports.ListFilter).max(20).default([]),
    sort: zod_1.z.array(exports.ListSortSchema).max(3).default([]),
    groupBy: zod_1.z.string().min(1).max(64).optional(),
    pageSize: exports.ListPageSize.default(exports.DEFAULT_PAGE_SIZE),
    columns: zod_1.z.array(zod_1.z.string().min(1).max(64)).max(60).optional(),
    view: exports.ListViewKind.default("list"),
});
exports.SavedView = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    listKey: zod_1.z.string(),
    name: zod_1.z.string(),
    config: exports.SavedViewConfig,
    shared: zod_1.z.boolean(),
    isDefault: zod_1.z.boolean(),
    mine: zod_1.z.boolean(),
    authorName: zod_1.z.string().nullable(),
    updatedAt: zod_1.z.string(),
});
exports.SavedViewList = zod_1.z.object({ views: zod_1.z.array(exports.SavedView) });
exports.CreateSavedViewRequest = zod_1.z.object({
    listKey: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().trim().min(1).max(60),
    config: exports.SavedViewConfig,
    shared: zod_1.z.boolean().default(false),
    isDefault: zod_1.z.boolean().default(false),
});
exports.UpdateSavedViewRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(60).optional(),
    config: exports.SavedViewConfig.optional(),
    shared: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
})
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------
exports.MAX_BULK_IDS = 200;
exports.BulkRequest = zod_1.z.object({
    action: zod_1.z.string().min(1).max(40),
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(exports.MAX_BULK_IDS),
    params: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.BulkResult = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    ok: zod_1.z.boolean(),
    /** The single command's own refusal, in its own words. */
    error: zod_1.z.string().optional(),
    status: zod_1.z.number().int().optional(),
});
exports.BulkResponse = zod_1.z.object({ results: zod_1.z.array(exports.BulkResult) });
/**
 * What a list's `ids` route answers for select all (AC-LF15): the ids matching
 * the filter, at most `MAX_BULK_IDS`, and how many match. Above the cap the
 * screen asks to narrow the filter rather than act on part of it.
 */
exports.ListIds = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).max(exports.MAX_BULK_IDS),
    total: zod_1.z.number().int().nonnegative(),
});
/** Export caps (AC-LF7). */
exports.MAX_EXPORT_ROWS = 10000;
// ---------------------------------------------------------------------------
// Which permissions read each list (the route's own declaration)
// ---------------------------------------------------------------------------
/**
 * Moved here from `apps/app`'s `OPS_READ` so the saved views route and the app
 * read one table (058-list-framework). Each value is exactly what that list's
 * route declares; a list key absent here has no saved views.
 */
exports.LIST_READ = {
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
};
function isListKey(key) {
    return Object.prototype.hasOwnProperty.call(exports.LIST_READ, key);
}
//# sourceMappingURL=list-query.js.map