"use client";

import { Card, type SortDescriptor } from "@heroui/react";
import { DataGrid, ListView } from "@heroui-pro/react";
import type { ReactNode } from "react";
import { IconAction } from "./buttons.tsx";
import { formatNumber } from "./format.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface GridColumn<T> {
  id: string;
  /** Sentence case: "Person", "Last sign in". */
  header: string;
  cell: (row: T) => ReactNode;
  /** The server sorts by this column when pressed. */
  sortable?: boolean;
  /** The column that names the row (one per grid). @default the first column */
  isRowHeader?: boolean;
  /** "end" for counts and dates that line up. @default "start" */
  align?: "start" | "end";
  /** Initial width (px, %, or fr). */
  width?: number | `${number}%` | `${number}fr`;
  minWidth?: number;
}

export interface GridPaging {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface GridSort {
  column: string;
  direction: "ascending" | "descending";
}

export interface ServerDataGridProps<T extends object> {
  /** What the grid lists, for screen readers ("People"). */
  label: string;
  rows: readonly T[];
  rowKey: (row: T) => string;
  columns: GridColumn<T>[];
  /** Sorting done by the server: the current sort, and what to do when a header is pressed. */
  sort?: GridSort | null;
  onSortChange?: (sort: GridSort) => void;
  paging?: GridPaging;
  /** Pressing a row (or Enter on it) opens it. */
  onRowAction?: (row: T) => void;
  /** Shown in place of the rows when there are none: an `EmptyBlock`. */
  empty?: ReactNode;
  /** How a row reads below md, where the grid becomes a list. Defaults: the first two columns. */
  mobile?: { title: (row: T) => ReactNode; description?: (row: T) => ReactNode; trailing?: (row: T) => ReactNode };
  /** Dims the rows while the next page or sort loads. */
  isLoading?: boolean;
  className?: string;
}

/**
 * A server-backed list (2026-11-02): HeroUI Pro's DataGrid from md up, a list of rows below it, with the
 * sort and the page held by the caller (usually in the URL) so the server answers exactly one page. Use it
 * where a list can be longer than one screen and the server already filters; `DataTable` stays the
 * choice for short lists sorted in the browser.
 */
export function ServerDataGrid<T extends object>({
  label,
  rows,
  rowKey,
  columns,
  sort,
  onSortChange,
  paging,
  onRowAction,
  empty,
  mobile,
  isLoading,
  className,
}: ServerDataGridProps<T>) {
  const byKey = new Map(rows.map((r) => [rowKey(r), r]));
  const open = onRowAction
    ? (key: string | number) => {
        const row = byKey.get(String(key));
        if (row) onRowAction(row);
      }
    : undefined;
  const rowHeader = columns.find((c) => c.isRowHeader) ?? columns[0];
  const view = mobile ?? { title: columns[0]?.cell ?? (() => null), description: columns[1]?.cell };
  const footer = paging ? <GridFooter paging={paging} shown={rows.length} /> : null;

  if (rows.length === 0 && empty) {
    return (
      <div className={cx("flex min-w-0 flex-col gap-2", className)}>
        <Card className="min-w-0">{empty}</Card>
        {paging && paging.page > 1 ? footer : null}
      </div>
    );
  }

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", isLoading && "opacity-60 transition-opacity", className)}>
      <div className="hidden md:block">
        <DataGrid<T>
          aria-label={label}
          data={[...rows]}
          getRowId={rowKey}
          onRowAction={open}
          sortDescriptor={sort ? { column: sort.column, direction: sort.direction } : undefined}
          onSortChange={(d: SortDescriptor) =>
            onSortChange?.({
              column: String(d.column),
              direction: d.direction === "descending" ? "descending" : "ascending",
            })
          }
          columns={columns.map((c) => ({
            id: c.id,
            header: c.header,
            cell: (row: T) => c.cell(row),
            allowsSorting: Boolean(c.sortable),
            isRowHeader: c === rowHeader,
            align: c.align ?? "start",
            width: c.width,
            minWidth: c.minWidth,
            cellClassName: c.align === "end" ? "tabular" : undefined,
          }))}
          footer={footer}
          footerClassName="justify-between"
        />
      </div>
      <div className="md:hidden">
        <ListView aria-label={label} items={rows.map((row) => ({ id: rowKey(row), row }))} onAction={open}>
          {({ id, row }) => (
            <ListView.Item id={id} textValue={id} className="items-start">
              <ListView.ItemContent className="items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ListView.Title className="whitespace-normal">{view.title(row)}</ListView.Title>
                  {view.description ? (
                    <ListView.Description className="whitespace-normal">{view.description(row)}</ListView.Description>
                  ) : null}
                </div>
              </ListView.ItemContent>
              {view.trailing ? (
                <ListView.ItemAction className="flex shrink-0 flex-col items-end gap-1 self-start">
                  {view.trailing(row)}
                </ListView.ItemAction>
              ) : null}
            </ListView.Item>
          )}
        </ListView>
        {footer}
      </div>
    </div>
  );
}

function GridFooter({ paging, shown }: { paging: GridPaging; shown: number }) {
  const first = paging.total === 0 ? 0 : (paging.page - 1) * paging.pageSize + 1;
  const last = (paging.page - 1) * paging.pageSize + shown;
  const pages = Math.max(1, Math.ceil(paging.total / paging.pageSize));
  return (
    <div className="flex w-full items-center justify-between gap-3 px-1 py-1 text-[13px] text-muted">
      <span className="tabular">
        {paging.total === 0
          ? "Nothing to show"
          : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(paging.total)}`}
      </span>
      <span className="flex items-center gap-1">
        <IconAction
          icon="ChevronLeft"
          label="Previous page"
          isDisabled={paging.page <= 1}
          onPress={() => paging.onPageChange(paging.page - 1)}
        />
        <span className="tabular">
          Page {formatNumber(paging.page)} of {formatNumber(pages)}
        </span>
        <IconAction
          icon="ChevronRight"
          label="Next page"
          isDisabled={paging.page >= pages}
          onPress={() => paging.onPageChange(paging.page + 1)}
        />
      </span>
    </div>
  );
}
