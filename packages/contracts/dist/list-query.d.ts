import { z } from "zod";
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
export declare const ListFieldType: z.ZodEnum<["text", "number", "money", "date", "datetime", "enum", "bool", "ref"]>;
export type ListFieldType = z.infer<typeof ListFieldType>;
/** A closed list. Adding an operator is a change to 058-list-framework. */
export declare const ListFilterOp: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
export type ListFilterOp = z.infer<typeof ListFilterOp>;
/** Which operators make sense for each field type. Anything else is refused. */
export declare const OPS_FOR_TYPE: Readonly<Record<ListFieldType, readonly ListFilterOp[]>>;
/** The operators one field allows: its type's, narrowed for a work figure. */
export declare function opsFor(field: Pick<ListField, "type" | "figure">): readonly ListFilterOp[];
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
export declare function defineListSpec<const S extends ListSpec>(spec: S): S;
/** The fields a reader may see at all: no sensitive field for a `basic` view, no figure outside the figure audience. */
export declare function visibleFields(spec: ListSpec, reader: ListView | ListReader): readonly ListField[];
export declare const ListFilter: z.ZodObject<{
    field: z.ZodString;
    op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
    /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
    value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
}, "strip", z.ZodTypeAny, {
    field: string;
    op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
    value?: string | number | boolean | (string | number)[] | undefined;
}, {
    field: string;
    op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
    value?: string | number | boolean | (string | number)[] | undefined;
}>;
export type ListFilter = z.infer<typeof ListFilter>;
export declare const ListSortSchema: z.ZodObject<{
    field: z.ZodString;
    dir: z.ZodEnum<["asc", "desc"]>;
}, "strip", z.ZodTypeAny, {
    field: string;
    dir: "asc" | "desc";
}, {
    field: string;
    dir: "asc" | "desc";
}>;
export declare const LIST_PAGE_SIZES: readonly [10, 25, 50, 100];
export declare const DEFAULT_PAGE_SIZE = 25;
export declare const ListPageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
export type ListPageSize = z.infer<typeof ListPageSize>;
export declare const ListQuery: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
        /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
        value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }, {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }>, "many">>;
    sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        dir: z.ZodEnum<["asc", "desc"]>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        dir: "asc" | "desc";
    }, {
        field: string;
        dir: "asc" | "desc";
    }>, "many">>;
    groupBy: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
}, "strip", z.ZodTypeAny, {
    sort: {
        field: string;
        dir: "asc" | "desc";
    }[];
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    filters: {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }[];
    q?: string | undefined;
    groupBy?: string | undefined;
}, {
    sort?: {
        field: string;
        dir: "asc" | "desc";
    }[] | undefined;
    q?: string | undefined;
    page?: number | undefined;
    pageSize?: 50 | 10 | 100 | 25 | undefined;
    filters?: {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }[] | undefined;
    groupBy?: string | undefined;
}>;
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
export declare function checkListQuery(spec: ListSpec, query: ListQuery, reader: ListView | ListReader): ListQueryIssue[];
/** The query with every part that does not fit the spec removed (for links and saved views). */
export declare function fitListQuery(spec: ListSpec, query: ListQuery, reader: ListView | ListReader): ListQuery;
export declare const ListGroup: z.ZodObject<{
    /** The group's raw value; null for rows with none. */
    key: z.ZodNullable<z.ZodString>;
    label: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    key: string | null;
    label: string;
    count: number;
}, {
    key: string | null;
    label: string;
    count: number;
}>;
export type ListGroup = z.infer<typeof ListGroup>;
export declare const ListCount: z.ZodObject<{
    value: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: string;
    count: number;
}, {
    value: string;
    count: number;
}>;
export type ListCount = z.infer<typeof ListCount>;
/** A kanban column for a `ref` stage field, in board order (per opening stages, for example). */
export declare const ListStage: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    label: string;
}, {
    key: string;
    label: string;
}>;
export type ListStage = z.infer<typeof ListStage>;
/** `ListPage` of a given row schema. */
export declare function listPage<T extends z.ZodTypeAny>(item: T): z.ZodObject<{
    items: z.ZodArray<T, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        /** The group's raw value; null for rows with none. */
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: T["_output"][];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: T["_input"][];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type ListPage<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: ListPageSize;
    groups?: ListGroup[];
    statusCounts?: ListCount[];
    stages?: ListStage[];
};
/**
 * `q`, `f` (filters as compact JSON: `[["status","eq","active"]]`), `s` (sort as
 * `hiredOn,-name`, minus for descending), `g` (group by), `page`, `size`. Empty
 * parts are left out, so a cleared filter leaves no trace in the URL.
 */
export declare function encodeListQuery(query: ListQueryInput): Record<string, string>;
/** `URLSearchParams` in a browser or Next, or anything else with `get` (this package ships no DOM types). */
interface ParamGetter {
    get(key: string): string | null;
}
type ParamSource = ParamGetter | Readonly<Record<string, string | string[] | undefined>>;
export type DecodedListQuery = {
    ok: true;
    query: ListQuery;
} | {
    ok: false;
    message: string;
};
/** Read a query from search parameters. Shape errors only; spec errors are `checkListQuery`'s. */
export declare function decodeListQuery(source: ParamSource): DecodedListQuery;
export declare const ListViewKind: z.ZodEnum<["list", "card", "kanban"]>;
export type ListViewKind = z.infer<typeof ListViewKind>;
/** What a saved view stores: the query without its page, plus how it looks. */
export declare const SavedViewConfig: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
        /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
        value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }, {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }>, "many">>;
    sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        dir: z.ZodEnum<["asc", "desc"]>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        dir: "asc" | "desc";
    }, {
        field: string;
        dir: "asc" | "desc";
    }>, "many">>;
    groupBy: z.ZodOptional<z.ZodString>;
    pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
    columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    view: z.ZodDefault<z.ZodEnum<["list", "card", "kanban"]>>;
}, "strip", z.ZodTypeAny, {
    sort: {
        field: string;
        dir: "asc" | "desc";
    }[];
    pageSize: 50 | 10 | 100 | 25;
    view: "card" | "list" | "kanban";
    filters: {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }[];
    q?: string | undefined;
    groupBy?: string | undefined;
    columns?: string[] | undefined;
}, {
    sort?: {
        field: string;
        dir: "asc" | "desc";
    }[] | undefined;
    q?: string | undefined;
    pageSize?: 50 | 10 | 100 | 25 | undefined;
    view?: "card" | "list" | "kanban" | undefined;
    filters?: {
        field: string;
        op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
        value?: string | number | boolean | (string | number)[] | undefined;
    }[] | undefined;
    groupBy?: string | undefined;
    columns?: string[] | undefined;
}>;
export type SavedViewConfig = z.infer<typeof SavedViewConfig>;
export declare const SavedView: z.ZodObject<{
    id: z.ZodString;
    listKey: z.ZodString;
    name: z.ZodString;
    config: z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
            /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
            value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }>, "many">>;
        sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            dir: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            dir: "asc" | "desc";
        }, {
            field: string;
            dir: "asc" | "desc";
        }>, "many">>;
        groupBy: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
        columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        view: z.ZodDefault<z.ZodEnum<["list", "card", "kanban"]>>;
    }, "strip", z.ZodTypeAny, {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }, {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }>;
    shared: z.ZodBoolean;
    isDefault: z.ZodBoolean;
    mine: z.ZodBoolean;
    authorName: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    config: {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    };
    authorName: string | null;
    updatedAt: string;
    isDefault: boolean;
    listKey: string;
    shared: boolean;
    mine: boolean;
}, {
    name: string;
    id: string;
    config: {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    };
    authorName: string | null;
    updatedAt: string;
    isDefault: boolean;
    listKey: string;
    shared: boolean;
    mine: boolean;
}>;
export type SavedView = z.infer<typeof SavedView>;
export declare const SavedViewList: z.ZodObject<{
    views: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        listKey: z.ZodString;
        name: z.ZodString;
        config: z.ZodObject<{
            q: z.ZodOptional<z.ZodString>;
            filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
                /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
                value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }, {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }>, "many">>;
            sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                dir: z.ZodEnum<["asc", "desc"]>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                dir: "asc" | "desc";
            }, {
                field: string;
                dir: "asc" | "desc";
            }>, "many">>;
            groupBy: z.ZodOptional<z.ZodString>;
            pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
            columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            view: z.ZodDefault<z.ZodEnum<["list", "card", "kanban"]>>;
        }, "strip", z.ZodTypeAny, {
            sort: {
                field: string;
                dir: "asc" | "desc";
            }[];
            pageSize: 50 | 10 | 100 | 25;
            view: "card" | "list" | "kanban";
            filters: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[];
            q?: string | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        }, {
            sort?: {
                field: string;
                dir: "asc" | "desc";
            }[] | undefined;
            q?: string | undefined;
            pageSize?: 50 | 10 | 100 | 25 | undefined;
            view?: "card" | "list" | "kanban" | undefined;
            filters?: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[] | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        }>;
        shared: z.ZodBoolean;
        isDefault: z.ZodBoolean;
        mine: z.ZodBoolean;
        authorName: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        config: {
            sort: {
                field: string;
                dir: "asc" | "desc";
            }[];
            pageSize: 50 | 10 | 100 | 25;
            view: "card" | "list" | "kanban";
            filters: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[];
            q?: string | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        };
        authorName: string | null;
        updatedAt: string;
        isDefault: boolean;
        listKey: string;
        shared: boolean;
        mine: boolean;
    }, {
        name: string;
        id: string;
        config: {
            sort?: {
                field: string;
                dir: "asc" | "desc";
            }[] | undefined;
            q?: string | undefined;
            pageSize?: 50 | 10 | 100 | 25 | undefined;
            view?: "card" | "list" | "kanban" | undefined;
            filters?: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[] | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        };
        authorName: string | null;
        updatedAt: string;
        isDefault: boolean;
        listKey: string;
        shared: boolean;
        mine: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    views: {
        name: string;
        id: string;
        config: {
            sort: {
                field: string;
                dir: "asc" | "desc";
            }[];
            pageSize: 50 | 10 | 100 | 25;
            view: "card" | "list" | "kanban";
            filters: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[];
            q?: string | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        };
        authorName: string | null;
        updatedAt: string;
        isDefault: boolean;
        listKey: string;
        shared: boolean;
        mine: boolean;
    }[];
}, {
    views: {
        name: string;
        id: string;
        config: {
            sort?: {
                field: string;
                dir: "asc" | "desc";
            }[] | undefined;
            q?: string | undefined;
            pageSize?: 50 | 10 | 100 | 25 | undefined;
            view?: "card" | "list" | "kanban" | undefined;
            filters?: {
                field: string;
                op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
                value?: string | number | boolean | (string | number)[] | undefined;
            }[] | undefined;
            groupBy?: string | undefined;
            columns?: string[] | undefined;
        };
        authorName: string | null;
        updatedAt: string;
        isDefault: boolean;
        listKey: string;
        shared: boolean;
        mine: boolean;
    }[];
}>;
export type SavedViewList = z.infer<typeof SavedViewList>;
export declare const CreateSavedViewRequest: z.ZodObject<{
    listKey: z.ZodString;
    name: z.ZodString;
    config: z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
            /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
            value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }>, "many">>;
        sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            dir: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            dir: "asc" | "desc";
        }, {
            field: string;
            dir: "asc" | "desc";
        }>, "many">>;
        groupBy: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
        columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        view: z.ZodDefault<z.ZodEnum<["list", "card", "kanban"]>>;
    }, "strip", z.ZodTypeAny, {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }, {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }>;
    shared: z.ZodDefault<z.ZodBoolean>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    config: {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    };
    isDefault: boolean;
    listKey: string;
    shared: boolean;
}, {
    name: string;
    config: {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    };
    listKey: string;
    isDefault?: boolean | undefined;
    shared?: boolean | undefined;
}>;
export type CreateSavedViewRequest = z.infer<typeof CreateSavedViewRequest>;
export declare const UpdateSavedViewRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            op: z.ZodEnum<["eq", "ne", "in", "nin", "contains", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]>;
            /** Absent for `isNull` / `isNotNull`, a pair for `between`, a list for `in` / `nin`. */
            value: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }, {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }>, "many">>;
        sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            dir: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            dir: "asc" | "desc";
        }, {
            field: string;
            dir: "asc" | "desc";
        }>, "many">>;
        groupBy: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>>;
        columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        view: z.ZodDefault<z.ZodEnum<["list", "card", "kanban"]>>;
    }, "strip", z.ZodTypeAny, {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }, {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    }>>;
    shared: z.ZodOptional<z.ZodBoolean>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    config?: {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    } | undefined;
    isDefault?: boolean | undefined;
    shared?: boolean | undefined;
}, {
    name?: string | undefined;
    config?: {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    } | undefined;
    isDefault?: boolean | undefined;
    shared?: boolean | undefined;
}>, {
    name?: string | undefined;
    config?: {
        sort: {
            field: string;
            dir: "asc" | "desc";
        }[];
        pageSize: 50 | 10 | 100 | 25;
        view: "card" | "list" | "kanban";
        filters: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[];
        q?: string | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    } | undefined;
    isDefault?: boolean | undefined;
    shared?: boolean | undefined;
}, {
    name?: string | undefined;
    config?: {
        sort?: {
            field: string;
            dir: "asc" | "desc";
        }[] | undefined;
        q?: string | undefined;
        pageSize?: 50 | 10 | 100 | 25 | undefined;
        view?: "card" | "list" | "kanban" | undefined;
        filters?: {
            field: string;
            op: "eq" | "ne" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "isNull" | "isNotNull";
            value?: string | number | boolean | (string | number)[] | undefined;
        }[] | undefined;
        groupBy?: string | undefined;
        columns?: string[] | undefined;
    } | undefined;
    isDefault?: boolean | undefined;
    shared?: boolean | undefined;
}>;
export type UpdateSavedViewRequest = z.infer<typeof UpdateSavedViewRequest>;
export declare const MAX_BULK_IDS = 200;
export declare const BulkRequest: z.ZodObject<{
    action: z.ZodString;
    ids: z.ZodArray<z.ZodString, "many">;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    action: string;
    ids: string[];
    params?: Record<string, unknown> | undefined;
}, {
    action: string;
    ids: string[];
    params?: Record<string, unknown> | undefined;
}>;
export type BulkRequest = z.infer<typeof BulkRequest>;
export declare const BulkResult: z.ZodObject<{
    id: z.ZodString;
    ok: z.ZodBoolean;
    /** The single command's own refusal, in its own words. */
    error: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    ok: boolean;
    status?: number | undefined;
    error?: string | undefined;
}, {
    id: string;
    ok: boolean;
    status?: number | undefined;
    error?: string | undefined;
}>;
export declare const BulkResponse: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ok: z.ZodBoolean;
        /** The single command's own refusal, in its own words. */
        error: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        ok: boolean;
        status?: number | undefined;
        error?: string | undefined;
    }, {
        id: string;
        ok: boolean;
        status?: number | undefined;
        error?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    results: {
        id: string;
        ok: boolean;
        status?: number | undefined;
        error?: string | undefined;
    }[];
}, {
    results: {
        id: string;
        ok: boolean;
        status?: number | undefined;
        error?: string | undefined;
    }[];
}>;
export type BulkResponse = z.infer<typeof BulkResponse>;
/**
 * What a list's `ids` route answers for select all (AC-LF15): the ids matching
 * the filter, at most `MAX_BULK_IDS`, and how many match. Above the cap the
 * screen asks to narrow the filter rather than act on part of it.
 */
export declare const ListIds: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    ids: string[];
}, {
    total: number;
    ids: string[];
}>;
export type ListIds = z.infer<typeof ListIds>;
/** Export caps (AC-LF7). */
export declare const MAX_EXPORT_ROWS = 10000;
/**
 * Moved here from `apps/app`'s `OPS_READ` so the saved views route and the app
 * read one table (058-list-framework). Each value is exactly what that list's
 * route declares; a list key absent here has no saved views.
 */
export declare const LIST_READ: {
    readonly "staff.employees": readonly ["people.view", "people.manage", "payroll.run"];
    readonly "staff.roster": readonly ["roster.manage", "attendance.record", "people.view"];
    readonly "staff.attendance": readonly ["attendance.record", "attendance.approve"];
    readonly "staff.leave-requests": readonly ["leave.approve"];
    readonly "staff.pay-runs": readonly ["payroll.draft", "payroll.run"];
    readonly "staff.shift-requests": readonly ["roster.manage"];
    readonly "staff.attendance-requests": readonly ["attendance.approve"];
    readonly "staff.leave-allocations": readonly ["leave.approve"];
    readonly "staff.leave-balances": readonly ["leave.approve", "people.manage"];
    readonly "staff.payslips": readonly ["payroll.run"];
    readonly "staff.loans": readonly ["payroll.run"];
    readonly "staff.pay-claims": readonly ["payroll.run"];
    readonly "staff.pay-adjustments": readonly ["payroll.run"];
    readonly "staff.contracts": readonly ["people.manage", "payroll.run"];
};
export type ListKey = keyof typeof LIST_READ;
export declare function isListKey(key: string): key is ListKey;
export {};
//# sourceMappingURL=list-query.d.ts.map