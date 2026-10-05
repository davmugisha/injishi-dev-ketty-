"use client";

import * as React from "react";
import type { ListGroup, ListSort } from "@injishi/contracts";
import {
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { cn } from "@injishi/utils";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Checkbox } from "./checkbox";

/**
 * Sorting and selection are the two table features a list needs; the server
 * does the sorting itself (`manualSorting`), so no sorted row model is loaded.
 * Declared once, outside any component, as TanStack Table v9 asks.
 */
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature });

/** One column of a list. The app owns how a cell looks; the list spec owns what may sort. */
export interface DataColumn<Row> {
  /** The column's key. When it names a sortable field of the list spec, its header sorts by it. */
  readonly key: string;
  readonly header: string;
  readonly cell: (row: Row) => React.ReactNode;
  /** Numbers and money read from the right. */
  readonly align?: "start" | "end";
  /** Let this column's text wrap. Cells keep to one line otherwise, and a wide table scrolls sideways. */
  readonly wrap?: boolean;
}

/** How many columns may sort at once, the same cap `ListQuery` puts on `sort`. */
const MAX_SORTS = 3;

/** The rows that open each group, when a page is grouped. */
function groupStarts<Row>(
  rows: readonly Row[],
  keyOf: (row: Row) => string | null,
): Map<number, string | null> {
  const starts = new Map<number, string | null>();
  let last: string | null | undefined;
  rows.forEach((row, i) => {
    const key = keyOf(row);
    if (i === 0 || key !== last) starts.set(i, key);
    last = key;
  });
  return starts;
}

export interface DataTableProps<Row extends RowData> {
  readonly rows: readonly Row[];
  readonly columns: readonly DataColumn<Row>[];
  readonly getRowId: (row: Row) => string;
  /** What a screen reader announces the table as. */
  readonly caption: string;
  /** The list spec's sortable field keys. A header sorts only when its key is one. */
  readonly sortable: ReadonlySet<string>;
  readonly sort: readonly ListSort[];
  readonly onSortChange: (sort: ListSort[]) => void;
  /** Row selection for bulk actions. Ids may include rows on other pages (select all). */
  readonly selection?: {
    readonly selected: ReadonlySet<string>;
    readonly onChange: (selected: Set<string>) => void;
  };
  /** A grouped page: rows arrive group by group, and each group opens with its own header row. */
  readonly group?: {
    readonly keyOf: (row: Row) => string | null;
    readonly groups: readonly ListGroup[];
  };
  readonly className?: string;
}

/**
 * The list view of `DataView` (058-list-framework AC-LF1, AC-LF2, AC-LF11).
 *
 * A native `<table>` with header cells, so a screen reader announces rows and
 * columns, and a `<caption>` naming it. Everything runs on the server: a header
 * click asks for a new sort, the page arrives sorted, and the table only draws
 * it. Click a header to sort by it alone; shift click to add it as the next key,
 * up to three, the cap the list query carries.
 *
 * A sort the spec does not allow is not offered at all: a header whose key is
 * not a sortable field is plain text. That is also how a work figure stays
 * unranked here, since `defineListSpec` refuses to make one sortable (AC-LF12).
 */
function DataTable<Row extends RowData>({
  rows,
  columns,
  getRowId,
  caption,
  sortable,
  sort,
  onSortChange,
  selection,
  group,
  className,
}: DataTableProps<Row>) {
  const sorting = React.useMemo<SortingState>(
    () => sort.map((s) => ({ id: s.field, desc: s.dir === "desc" })),
    [sort],
  );
  const rowSelection = React.useMemo<RowSelectionState>(
    () => Object.fromEntries([...(selection?.selected ?? [])].map((id) => [id, true])),
    [selection?.selected],
  );

  const defs = React.useMemo<ColumnDef<typeof features, Row>[]>(() => {
    const data: ColumnDef<typeof features, Row>[] = columns.map((column) => ({
      id: column.key,
      header: column.header,
      // Sorting is the server's, but TanStack only offers a column for sorting
      // when it has an accessor, so each one reads its own key.
      accessorFn: () => column.key,
      enableSorting: sortable.has(column.key),
      cell: (context) => column.cell(context.row.original),
      meta: { align: column.align ?? "start", wrap: column.wrap ?? false },
    }));
    if (!selection) return data;
    const select: ColumnDef<typeof features, Row> = {
      id: "__select",
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select every row on this page"
          isSelected={table.getIsAllPageRowsSelected()}
          isIndeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onChange={(value: boolean) => table.toggleAllPageRowsSelected(value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select this row"
          isSelected={row.getIsSelected()}
          onChange={(value: boolean) => row.toggleSelected(value)}
        />
      ),
    };
    return [select, ...data];
  }, [columns, sortable, selection]);

  const onSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortChange(next.slice(0, MAX_SORTS).map((s) => ({ field: s.id, dir: s.desc ? "desc" : "asc" })));
    },
    [sorting, onSortChange],
  );
  const onRowSelectionChange = React.useCallback(
    (updater: Updater<RowSelectionState>) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      selection?.onChange(new Set(Object.keys(next).filter((id) => next[id])));
    },
    [rowSelection, selection],
  );

  const table = useTable({
    features,
    columns: defs,
    data: rows as Row[],
    getRowId: (row) => getRowId(row),
    state: { sorting, rowSelection },
    manualSorting: true,
    enableMultiSort: true,
    maxMultiSortColCount: MAX_SORTS,
    onSortingChange,
    enableRowSelection: Boolean(selection),
    onRowSelectionChange,
  });

  const tableRows = table.getRowModel().rows;
  const starts = group ? groupStarts(rows, group.keyOf) : null;
  const span = defs.length;

  return (
    <div className={cn("w-full overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border">
              {headerGroup.headers.map((header) => {
                const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
                const direction = header.column.getIsSorted();
                const index = header.column.getSortIndex();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground",
                      align === "end" ? "text-right" : "text-left",
                      header.column.id === "__select" && "w-10",
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                          direction && "text-foreground",
                        )}
                      >
                        <table.FlexRender header={header} />
                        {direction === "asc" ? (
                          <ArrowUpIcon aria-hidden className="size-3.5" />
                        ) : direction === "desc" ? (
                          <ArrowDownIcon aria-hidden className="size-3.5" />
                        ) : (
                          <ChevronsUpDownIcon aria-hidden className="size-3.5 opacity-50" />
                        )}
                        {direction && sorting.length > 1 ? (
                          <span className="text-2xs tabular-nums">{index + 1}</span>
                        ) : null}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {tableRows.map((row, i) => {
            const groupKey = starts?.get(i);
            const opensGroup = starts !== null && starts.has(i);
            const info = opensGroup ? group?.groups.find((g) => g.key === groupKey) : undefined;
            return (
              <React.Fragment key={row.id}>
                {opensGroup ? (
                  <tr className="border-b border-border bg-secondary">
                    <th scope="colgroup" colSpan={span} className="px-3 py-1.5 text-left text-xs font-semibold">
                      {info?.label ?? (groupKey === null ? "None" : groupKey)}
                      {info ? (
                        <span className="ml-2 font-normal tabular-nums text-muted-foreground">{info.count}</span>
                      ) : null}
                    </th>
                  </tr>
                ) : null}
                <tr
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="border-b border-border transition-colors duration-quick hover:bg-secondary data-[state=selected]:bg-secondary"
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: string; wrap?: boolean } | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-2 align-middle text-foreground",
                          !meta?.wrap && "whitespace-nowrap",
                          meta?.align === "end" && "text-right tabular-nums",
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
