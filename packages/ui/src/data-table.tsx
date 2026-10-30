"use client";

import { Dropdown, type Key, Label, Pagination, type Selection, type SortDescriptor } from "@heroui/react";
import { ActionBar, DataGrid, type DataGridColumn, ListView } from "@heroui-pro/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActionButton, IconAction } from "./buttons.tsx";
import { formatNumber } from "./format.tsx";
import type { IconKey } from "./icon.tsx";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "./states.tsx";
import { FilterMenu, SearchBar } from "./table.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface DataColumn<T> {
  id: string;
  /** Sentence case: "Tenant", "Rent", "Next step". */
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable by this value (numbers sort as numbers, text as words). */
  sortValue?: (row: T) => string | number | null | undefined;
  /** "end" for money and counts (with `<Money>` in the cell). @default "start" */
  align?: "start" | "end";
  /** The column that names the row (one per table). @default the first column */
  isRowHeader?: boolean;
  /** Hide a secondary column on narrower desktops. */
  hideBelow?: "lg" | "xl";
  /** Hidden until chosen in the Columns menu (a table with `columnToggle`). */
  defaultHidden?: boolean;
}

export interface DataTableSelection {
  selectedKeys: Selection;
  onSelectionChange: (keys: Selection) => void;
  /** The bulk actions shown in the action bar while rows are selected (`ActionButton`s). */
  bulkActions: ReactNode;
  /** What a row is, for "3 leases selected". @default "rows" */
  noun?: string;
}

/** How a row reads below md, where the table becomes a list. Defaults: the first, second and last columns. */
export interface DataTableMobile<T> {
  title: (row: T) => ReactNode;
  description?: (row: T) => ReactNode;
  /** A picture or avatar before the title. */
  leading?: (row: T) => ReactNode;
  /** The figure or status on the right (money, a status chip). */
  trailing?: (row: T) => ReactNode;
}

/**
 * A filter of the toolbar: a menu of choices, the first one meaning "no filter" (All). Nothing is chosen
 * for the person: it starts on the first choice unless the page's URL says otherwise.
 */
export interface TableFilter<T> {
  id: string;
  /** The visible name ("Status"). */
  name: string;
  icon?: IconKey;
  /** The first is "All" (no filter). */
  options: readonly { id: string; label: string; count?: number }[];
  /** Controlled (the page keeps it in the URL); else the table keeps it. */
  value?: string;
  onChange?: (value: string) => void;
  /** Client side: does this row pass the chosen option? Leave out when the server filters. */
  match?: (row: T, value: string) => boolean;
}

export interface TableSearch<T> {
  /** A hint of what can be found ("Tenant, unit or reference"). */
  placeholder: string;
  /** For screen readers. @default "Search" */
  label?: string;
  /** Controlled (the page keeps it in the URL and the server searches); else the table filters. */
  value?: string;
  onChange?: (value: string) => void;
  /** Client side: the words a row can be found by. */
  text?: (row: T) => string;
}

/** Pages counted by the server: the table shows the footer and asks for another page. */
export interface TablePages {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  /** What the table lists, for screen readers ("Leases"). */
  label: string;
  rows: readonly T[];
  rowKey: (row: T) => string;
  columns: DataColumn<T>[];
  /** Pressing a row (or Enter on it) opens it, usually in a side panel. */
  onRowAction?: (row: T) => void;
  /** The last column, headed "Actions": icon-only `IconAction`s, the next step first. */
  rowActions?: (row: T) => ReactNode;
  selection?: DataTableSelection;
  /** @default no sort (the order given) */
  defaultSort?: { column: string; direction: "ascending" | "descending" };
  /** Shown instead of the table when there is nothing at all: an `EmptyBlock` with the next step. */
  empty?: ReactNode;
  mobile?: DataTableMobile<T>;
  /** The toolbar's search. */
  search?: TableSearch<T>;
  /** The toolbar's filter menus, in reading order. */
  filters?: TableFilter<T>[];
  /** Buttons at the end of the toolbar (Export). The page's main action belongs in its header. */
  toolbarEnd?: ReactNode;
  /** A Columns menu to show or hide the columns that are not the row's name. */
  columnToggle?: boolean;
  /** Rows per page when the table pages itself. @default 20 */
  pageSize?: number;
  /** Pages counted by the server. */
  pages?: TablePages;
  /** What one and many rows are, for "1 to 20 of 54 leases". @default label in lower case */
  noun?: { one: string; many: string };
  /** The rows are on their way: a skeleton in the table's shape. */
  isLoading?: boolean;
  /** The rows could not be read: what failed, with Retry. */
  error?: ReactNode;
  onRetry?: () => void;
  /** Clears a server-side search and filters (the table clears its own). */
  onClearFilters?: () => void;
  className?: string;
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const HIDE: Record<NonNullable<DataColumn<unknown>["hideBelow"]>, string> = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

type Row<T> = { id: string; row: T };

/**
 * One list of records, the same on every screen (HeroUI Pro `DataGrid`): a toolbar row with the search,
 * the filter menus and a Columns menu; a sortable table from md up and a list of rows below it (nothing
 * scrolls sideways on a phone); an Actions column of icon-only actions; pages in the footer; and its
 * loading, empty, no-match and error states. Rows open on press.
 */
export function DataTable<T>({
  label,
  rows,
  rowKey,
  columns,
  onRowAction,
  rowActions,
  selection,
  defaultSort,
  empty,
  mobile,
  search,
  filters,
  toolbarEnd,
  columnToggle = false,
  pageSize = 20,
  pages,
  noun,
  isLoading = false,
  error,
  onRetry,
  onClearFilters,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDescriptor | undefined>(defaultSort);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)),
  );

  const q = search?.value ?? query;
  const choiceOf = (f: TableFilter<T>) => f.value ?? chosen[f.id] ?? f.options[0]?.id ?? "all";
  const filterValues = (filters ?? []).map((f) => [f.id, choiceOf(f)] as const);
  const filtered = q.trim() !== "" || (filters ?? []).some((f) => choiceOf(f) !== f.options[0]?.id);

  const visible = useMemo(() => {
    const words = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (words && search?.value === undefined && search?.text && !search.text(row).toLowerCase().includes(words))
        return false;
      for (const f of filters ?? []) {
        const v = f.value ?? chosen[f.id] ?? f.options[0]?.id;
        if (f.match && v !== undefined && v !== f.options[0]?.id && !f.match(row, v)) return false;
      }
      return true;
    });
  }, [rows, q, search, filters, chosen]);

  const sorted = useMemo(() => {
    const column = sort ? columns.find((c) => c.id === sort.column) : undefined;
    if (!column?.sortValue) return visible;
    const value = column.sortValue;
    const sign = sort?.direction === "descending" ? -1 : 1;
    return [...visible].sort((a, b) => sign * compare(value(a), value(b)));
  }, [visible, columns, sort]);

  // A change of search or filter starts again on the first page.
  const filterKey = `${q}|${filterValues.map(([k, v]) => `${k}=${v}`).join("&")}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on the key, not on its parts
  useEffect(() => setPage(1), [filterKey]);

  const serverPaged = Boolean(pages);
  const size = pages?.pageSize ?? pageSize;
  const total = pages?.total ?? sorted.length;
  const current = pages?.page ?? page;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const shown: Row<T>[] = useMemo(() => {
    const list = serverPaged ? sorted : sorted.slice((current - 1) * size, current * size);
    return list.map((row) => ({ id: rowKey(row), row }));
  }, [sorted, serverPaged, current, size, rowKey]);
  const goTo = (p: number) => (pages ? pages.onPageChange(p) : setPage(p));

  const clear = () => {
    setQuery("");
    setChosen({});
    search?.onChange?.("");
    for (const f of filters ?? []) if (f.value !== undefined) f.onChange?.(f.options[0]?.id ?? "all");
    onClearFilters?.();
  };

  const rowHeader = columns.find((c) => c.isRowHeader) ?? columns[0];
  const shownColumns = columns.filter((c) => c === rowHeader || !hidden.has(c.id));
  const byKey = useMemo(() => new Map(shown.map((r) => [r.id, r.row])), [shown]);
  const open = onRowAction
    ? (key: Key) => {
        const row = byKey.get(String(key));
        if (row !== undefined) onRowAction(row);
      }
    : undefined;
  const view: DataTableMobile<T> = mobile ?? {
    title: columns[0].cell,
    description: columns[1]?.cell,
    trailing: columns.length > 2 ? columns[columns.length - 1].cell : undefined,
  };
  const selectedCount = selection ? (selection.selectedKeys === "all" ? rows.length : selection.selectedKeys.size) : 0;
  const words = noun ?? { one: label.toLowerCase(), many: label.toLowerCase() };

  const gridColumns = useMemo<DataGridColumn<Row<T>>[]>(() => {
    const list: DataGridColumn<Row<T>>[] = shownColumns.map((c) => ({
      id: c.id,
      header: c.header,
      isRowHeader: c === rowHeader,
      allowsSorting: Boolean(c.sortValue),
      align: c.align ?? "start",
      headerClassName: cx(c.hideBelow && HIDE[c.hideBelow]),
      cellClassName: cx(c.align === "end" && "tabular", c.hideBelow && HIDE[c.hideBelow]),
      cell: (item: Row<T>) => c.cell(item.row),
    }));
    if (rowActions) {
      list.push({
        id: "__actions",
        header: "Actions",
        align: "end",
        cell: (item: Row<T>) => rowActions(item.row),
      });
    }
    return list;
  }, [shownColumns, rowHeader, rowActions]);

  const hideable = columns.filter((c) => c !== rowHeader);
  const toolbar =
    search || (filters && filters.length > 0) || toolbarEnd || (columnToggle && hideable.length > 0) ? (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {search ? (
          <SearchBar
            label={search.label ?? `Search ${label.toLowerCase()}`}
            value={q}
            onChange={(v) => (search.onChange ? search.onChange(v) : setQuery(v))}
            placeholder={search.placeholder}
            className="w-full sm:w-64"
          />
        ) : null}
        {(filters ?? []).map((f) => (
          <FilterMenu
            key={f.id}
            label={f.name}
            name={f.name}
            icon={f.icon}
            options={f.options}
            value={choiceOf(f)}
            onChange={(v) => (f.onChange ? f.onChange(v) : setChosen((prev) => ({ ...prev, [f.id]: v })))}
          />
        ))}
        {filtered ? (
          <ActionButton icon="Xmark" intent="ghost" size="sm" onPress={clear}>
            Clear
          </ActionButton>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {columnToggle && hideable.length > 0 ? (
            <ColumnsMenu
              columns={hideable}
              hidden={hidden}
              onChange={(next) => setHidden(next)}
              className="hidden md:inline-flex"
            />
          ) : null}
          {toolbarEnd}
        </div>
      </div>
    ) : null;

  const footer =
    pageCount > 1 ? (
      <Pages
        page={current}
        pageCount={pageCount}
        from={(current - 1) * size + 1}
        to={Math.min(total, current * size)}
        total={total}
        noun={total === 1 ? words.one : words.many}
        onChange={goTo}
      />
    ) : null;

  let body: ReactNode;
  if (error) {
    body = <ErrorBlock title={error} onRetry={onRetry} />;
  } else if (isLoading) {
    body = <LoadingBlock shape="table" label={label.toLowerCase()} rows={6} />;
  } else if (rows.length === 0 && !filtered && !serverPaged) {
    body = empty ?? <EmptyBlock icon="Tray" title={`No ${words.many} yet`} />;
  } else if (shown.length === 0 && (filtered || serverPaged)) {
    body =
      filtered || !empty ? (
        <EmptyBlock
          icon="Magnifier"
          title={`No ${words.many} match`}
          action={
            filtered ? (
              <ActionButton icon="Xmark" size="sm" onPress={clear}>
                Clear filters
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        empty
      );
  } else {
    body = (
      <>
        <DataGrid
          aria-label={label}
          className="hidden md:block"
          data={shown}
          columns={gridColumns}
          getRowId={(r) => r.id}
          sortDescriptor={sort}
          onSortChange={setSort}
          onRowAction={open}
          selectionMode={selection ? "multiple" : "none"}
          showSelectionCheckboxes={Boolean(selection)}
          selectedKeys={selection?.selectedKeys}
          onSelectionChange={selection?.onSelectionChange}
          footer={footer}
          footerClassName="justify-between"
        />

        <div className="flex flex-col gap-2 md:hidden">
          <ListView
            aria-label={label}
            items={shown}
            onAction={open}
            selectionMode={selection ? "multiple" : "none"}
            selectedKeys={selection?.selectedKeys}
            onSelectionChange={selection?.onSelectionChange}
          >
            {({ id, row }) => (
              <ListView.Item id={id} textValue={id} className="items-start">
                <ListView.ItemContent className="items-start gap-3">
                  {view.leading ? <div className="shrink-0">{view.leading(row)}</div> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <ListView.Title className="whitespace-normal">{view.title(row)}</ListView.Title>
                    {view.description ? (
                      <ListView.Description className="whitespace-normal">{view.description(row)}</ListView.Description>
                    ) : null}
                  </div>
                </ListView.ItemContent>
                {view.trailing || rowActions ? (
                  <ListView.ItemAction className="flex shrink-0 flex-col items-end gap-1 self-start">
                    {view.trailing ? view.trailing(row) : null}
                    {rowActions ? <div className="-mr-1.5 [&>*]:gap-0.5">{rowActions(row)}</div> : null}
                  </ListView.ItemAction>
                ) : null}
              </ListView.Item>
            )}
          </ListView>
          {footer ? <div className="px-1">{footer}</div> : null}
        </div>
      </>
    );
  }

  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      {toolbar}
      {body}
      {selection ? (
        <ActionBar aria-label={`Actions for the selected ${selection.noun ?? "rows"}`} isOpen={selectedCount > 0}>
          <ActionBar.Prefix>
            <span className="text-sm font-medium whitespace-nowrap tabular">
              {formatNumber(selectedCount)} {selection.noun ?? "rows"} selected
            </span>
          </ActionBar.Prefix>
          <ActionBar.Content>{selection.bulkActions}</ActionBar.Content>
          <ActionBar.Suffix>
            <IconAction icon="Xmark" label="Clear selection" onPress={() => selection.onSelectionChange(new Set())} />
          </ActionBar.Suffix>
        </ActionBar>
      ) : null}
    </div>
  );
}

/** "1 to 20 of 54 leases" and the page buttons (HeroUI Pagination), in the table's footer. */
function Pages({
  page,
  pageCount,
  from,
  to,
  total,
  noun,
  onChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  noun: string;
  onChange: (page: number) => void;
}) {
  // At most five numbers: the first, the last, and the pages around this one.
  const numbers: (number | "gap")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== "gap") numbers.push("gap");
  }
  return (
    <Pagination size="sm" className="w-full flex-wrap justify-between gap-2">
      <Pagination.Summary className="text-xs text-muted tabular">
        {formatNumber(from)} to {formatNumber(to)} of {formatNumber(total)} {noun}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page <= 1} onPress={() => onChange(page - 1)} aria-label="Previous page">
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {numbers.map((n, i) =>
          n === "gap" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
            <Pagination.Item key={`gap-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={n} className="hidden sm:list-item">
              <Pagination.Link isActive={n === page} onPress={() => onChange(n)} aria-label={`Page ${n}`}>
                {n}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={page >= pageCount} onPress={() => onChange(page + 1)} aria-label="Next page">
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/** The Columns menu: a tick per column that can be hidden. */
function ColumnsMenu<T>({
  columns,
  hidden,
  onChange,
  className,
}: {
  columns: DataColumn<T>[];
  hidden: Set<string>;
  onChange: (hidden: Set<string>) => void;
  className?: string;
}) {
  const shown = new Set(columns.filter((c) => !hidden.has(c.id)).map((c) => c.id));
  return (
    <Dropdown>
      <ActionButton icon="Sliders" size="sm" intent="ghost" className={className}>
        Columns
      </ActionButton>
      <Dropdown.Popover placement="bottom end" className="min-w-48">
        <Dropdown.Menu
          aria-label="Columns to show"
          selectionMode="multiple"
          selectedKeys={shown}
          onSelectionChange={(keys) => {
            const on = keys === "all" ? new Set(columns.map((c) => c.id)) : new Set([...keys].map(String));
            onChange(new Set(columns.filter((c) => !on.has(c.id)).map((c) => c.id)));
          }}
        >
          {columns.map((c) => (
            <Dropdown.Item key={c.id} id={c.id} textValue={c.header}>
              <Dropdown.ItemIndicator />
              <Label>{c.header}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
