"use client";

import {
  Card,
  Checkbox,
  Chip,
  type Key,
  ListBox,
  SearchField,
  Select,
  type Selection,
  type SortDescriptor,
  Table,
  Tabs,
} from "@heroui/react";
import { ActionBar, ListView, Segment } from "@heroui-pro/react";
import { type ReactNode, useMemo, useState } from "react";
import { IconAction } from "./buttons.tsx";
import { formatNumber } from "./format.tsx";
import { Icon, type IconKey } from "./icon.tsx";

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
  /** Shown instead of the table when there are no rows: an `EmptyBlock` with the next step. */
  empty?: ReactNode;
  mobile?: DataTableMobile<T>;
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

/**
 * One list of records: a sortable table from md up, a list of rows below it (nothing scrolls sideways
 * on a phone). Rows open on press; the Actions column holds icon-only actions with tooltips; with
 * `selection`, rows get checkboxes and the selected ones get an action bar.
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
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortDescriptor | undefined>(defaultSort);
  const byKey = useMemo(() => new Map(rows.map((r) => [rowKey(r), r])), [rows, rowKey]);
  const sorted = useMemo(() => {
    const column = sort ? columns.find((c) => c.id === sort.column) : undefined;
    if (!column?.sortValue) return [...rows];
    const value = column.sortValue;
    const sign = sort?.direction === "descending" ? -1 : 1;
    return [...rows].sort((a, b) => sign * compare(value(a), value(b)));
  }, [rows, columns, sort]);

  if (rows.length === 0 && empty) {
    return <Card className={cx("min-w-0", className)}>{empty}</Card>;
  }

  const rowHeader = columns.find((c) => c.isRowHeader) ?? columns[0];
  const open = onRowAction
    ? (key: Key) => byKey.has(String(key)) && onRowAction(byKey.get(String(key)) as T)
    : undefined;
  const view: DataTableMobile<T> = mobile ?? {
    title: columns[0].cell,
    description: columns[1]?.cell,
    trailing: columns.length > 2 ? columns[columns.length - 1].cell : undefined,
  };
  const selectedCount = selection ? (selection.selectedKeys === "all" ? rows.length : selection.selectedKeys.size) : 0;

  return (
    <div className={cx("min-w-0", className)}>
      <Table className="hidden md:block">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={label}
            sortDescriptor={sort}
            onSortChange={setSort}
            onRowAction={open}
            selectionMode={selection ? "multiple" : "none"}
            selectionBehavior="toggle"
            selectedKeys={selection?.selectedKeys}
            onSelectionChange={selection?.onSelectionChange}
          >
            <Table.Header>
              {selection ? (
                <Table.Column className="w-10">
                  <SelectionBox label="Select all" />
                </Table.Column>
              ) : null}
              {columns.map((c) => (
                <Table.Column
                  key={c.id}
                  id={c.id}
                  isRowHeader={c === rowHeader}
                  allowsSorting={Boolean(c.sortValue)}
                  className={cx(c.align === "end" && "text-right", c.hideBelow && HIDE[c.hideBelow])}
                >
                  {({ sortDirection }) =>
                    c.sortValue ? (
                      <Table.SortableColumnHeader
                        sortDirection={sortDirection}
                        className={cx(c.align === "end" && "justify-end")}
                      >
                        {c.header}
                      </Table.SortableColumnHeader>
                    ) : (
                      c.header
                    )
                  }
                </Table.Column>
              ))}
              {rowActions ? <Table.Column className="text-right">Actions</Table.Column> : null}
            </Table.Header>
            <Table.Body items={sorted.map((row) => ({ id: rowKey(row), row }))}>
              {({ id, row }) => (
                <Table.Row id={id} className={cx(onRowAction && "cursor-pointer")}>
                  {selection ? (
                    <Table.Cell>
                      <SelectionBox label="Select row" />
                    </Table.Cell>
                  ) : null}
                  {columns.map((c) => (
                    <Table.Cell
                      key={c.id}
                      className={cx(c.align === "end" && "text-right tabular", c.hideBelow && HIDE[c.hideBelow])}
                    >
                      {c.cell(row)}
                    </Table.Cell>
                  ))}
                  {rowActions ? <Table.Cell className="text-right">{rowActions(row)}</Table.Cell> : null}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <ListView
        aria-label={label}
        className="md:hidden"
        items={sorted.map((row) => ({ id: rowKey(row), row }))}
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
            {/* The figure or status, and the row's icon actions under it on the right: never a line of their own. */}
            {view.trailing || rowActions ? (
              <ListView.ItemAction className="flex shrink-0 flex-col items-end gap-1 self-start">
                {view.trailing ? view.trailing(row) : null}
                {rowActions ? <div className="-mr-1.5 [&>*]:gap-0.5">{rowActions(row)}</div> : null}
              </ListView.ItemAction>
            ) : null}
          </ListView.Item>
        )}
      </ListView>

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

function SelectionBox({ label }: { label: string }) {
  return (
    <Checkbox slot="selection" aria-label={label}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export interface FilterTab {
  id: string;
  label: string;
  /** The number of records under the tab; omit while unknown. */
  count?: number;
}

/**
 * The status filter of a list page, each choice with its count. Keeping the choice in the URL is the page's
 * job (`?tab=`). "menu" (the default) is a filter: one dropdown that names what it filters and what is
 * chosen ("Stage: Active 12"), so it sits in one row with the search and reads as a filter, not a page.
 * "tabs" is for real sections of one record; "segment" for a compact switch of two to four views.
 */
export function FilterTabs({
  label,
  tabs,
  selectedKey,
  onSelectionChange,
  variant = "menu",
  name,
  icon,
  className,
}: {
  /** What the tabs filter, for screen readers ("Lease status"). */
  label: string;
  tabs: FilterTab[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  variant?: "menu" | "tabs" | "segment";
  /** The menu's visible name ("Stage"); @default "Show" */
  name?: string;
  icon?: IconKey;
  className?: string;
}) {
  if (variant === "menu") {
    return (
      <FilterMenu
        label={label}
        name={name ?? "Show"}
        icon={icon}
        options={tabs}
        value={selectedKey}
        onChange={onSelectionChange}
        className={className}
      />
    );
  }
  if (variant === "segment") {
    // As the feature screens write it: the count after the words ("Money 3").
    return (
      <Segment
        aria-label={label}
        selectedKey={selectedKey}
        onSelectionChange={(k) => onSelectionChange(String(k))}
        className={cx("w-fit max-w-full self-start", className)}
      >
        {tabs.map((t) => (
          <Segment.Item key={t.id} id={t.id}>
            {t.label}
            {t.count == null ? null : <span className="tabular"> {formatNumber(t.count)}</span>}
          </Segment.Item>
        ))}
      </Segment>
    );
  }

  // The tabs of the feature screens: secondary Tabs sized to their words, a Chip with the count, the
  // indicator under the selected one. The row scrolls sideways on a phone rather than wrapping.
  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(k) => onSelectionChange(String(k))}
      variant="secondary"
      className={cx("min-w-0", className)}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label={label} className="justify-start">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} className="w-auto gap-2 px-3 whitespace-nowrap">
              {t.label}
              {t.count == null ? null : (
                <Chip size="sm" className="tabular">
                  {formatNumber(t.count)}
                  <span className="sr-only"> {t.count === 1 ? "item" : "items"}</span>
                </Chip>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

/**
 * A filter of a list: a field-like button that says what it filters and what is chosen ("Stage  Active"),
 * opening a list of the choices with their counts and a tick on the chosen one. Set (anything but the
 * first choice) it takes the accent tint, so a filtered list is plain to see.
 */
export function FilterMenu({
  label,
  name,
  icon = "Funnel",
  options,
  value,
  onChange,
  className,
}: {
  /** What it filters, for screen readers ("Lease stage"). */
  label: string;
  /** The visible name before the choice ("Stage"). */
  name: string;
  icon?: IconKey;
  options: readonly { id: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const isSet = options.length > 0 && value !== options[0]?.id;
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(k) => (k != null ? onChange(String(k)) : undefined)}
      className={cx("w-auto min-w-0 shrink-0", className)}
    >
      <Select.Trigger
        className={cx(
          "h-9 gap-2 rounded-lg border pr-9 pl-3 shadow-none",
          isSet ? "border-accent/50 bg-accent-soft text-accent-soft-foreground" : "border-separator bg-surface",
        )}
      >
        <Icon name={icon} className={cx("size-4 shrink-0", isSet ? "text-accent" : "text-muted")} />
        <span className={cx("shrink-0 text-sm", isSet ? "text-accent" : "text-muted")}>{name}</span>
        {/* Only the words: the count is for the list. */}
        <Select.Value className="truncate text-sm font-medium">{({ selectedText }) => selectedText}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-56">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label} className="gap-3">
              <span className="flex-1 truncate">{o.label}</span>
              {o.count == null ? null : <span className="text-xs text-muted tabular">{formatNumber(o.count)}</span>}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** The search box of a list page. Keeping the query in the URL is the page's job. */
export function SearchBar({
  label,
  value,
  defaultValue,
  onChange,
  onSubmit,
  placeholder,
  className,
}: {
  /** What it searches, for screen readers ("Search leases"). */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** A hint of what can be found ("Tenant, unit or reference"). */
  placeholder?: string;
  className?: string;
}) {
  return (
    <SearchField
      aria-label={label}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onSubmit={onSubmit}
      className={cx("w-full min-w-0 md:w-64", className)}
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} />
        <SearchField.ClearButton aria-label="Clear search" />
      </SearchField.Group>
    </SearchField>
  );
}

/**
 * The one row above a list: the filters on the left (the status menu first, then any other filter), the
 * search at the end. It wraps on a narrow screen, the search taking the full width on a phone.
 */
export function ListToolbar({
  tabs,
  children,
  className,
}: {
  /** The status filter: a `FilterTabs` (its "menu" variant). */
  tabs?: ReactNode;
  /** `SearchBar`, `FilterSelect`s, a view switch: in reading order. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "ij-toolbar flex min-w-0 flex-wrap items-center gap-2 [&>.search-field]:w-full sm:[&>.search-field]:ml-auto sm:[&>.search-field]:w-64",
        className,
      )}
    >
      {tabs}
      {children}
    </div>
  );
}

/** A compact filter for a toolbar: the chosen option is the label ("All units"); the name is for screen readers. */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** What it filters, for screen readers ("Unit"). */
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(k) => (k != null ? onChange(String(k)) : undefined)}
      className={cx("w-auto min-w-0 shrink-0", className)}
    >
      <Select.Trigger className="h-9 gap-2 rounded-lg border border-separator bg-surface pr-9 pl-3 shadow-none">
        <Select.Value className="truncate text-sm font-medium" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-48">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
