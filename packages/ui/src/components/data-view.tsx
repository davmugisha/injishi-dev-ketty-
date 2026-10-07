"use client";

import * as React from "react";
import {
  visibleFields,
  type BulkResponse,
  type ListIds,
  type ListPage,
  type ListReader,
  type ListSpec,
  type ListView,
  type ListViewKind,
  type SavedView,
  type SavedViewConfig,
} from "@injishi/contracts";
import type { RowData } from "@tanstack/react-table";
import { cn } from "@injishi/utils";
import { DownloadIcon, KanbanSquareIcon, LayoutGridIcon, ListIcon, SearchIcon, XIcon } from "lucide-react";

import { savedViewConfigOf, stateOfSavedView, type ListViewState } from "../lib/use-list-state";
import { BulkBar, type BulkAction } from "./bulk-bar";
import { Button } from "./button";
import { CardGrid } from "./card-grid";
import { ColumnChooser } from "./column-chooser";
import { DataTable, type DataColumn } from "./data-table";
import { FilterPanel, type RefOption } from "./filter-panel";
import { GroupSelect } from "./group-select";
import { Input } from "./input";
import { KanbanBoard } from "./kanban-board";
import { Pager } from "./pager";
import { SavedViewsMenu } from "./saved-views-menu";
import { Skeleton } from "./skeleton";
import { StatusChips } from "./status-chips";

/** How long typing rests before the search is sent. */
const SEARCH_REST_MS = 300;
/** The most cards a board loads at once (AC-LF14). */
const BOARD_PAGE_SIZE = 100;

export interface DataViewProps<Row extends RowData> {
  readonly spec: ListSpec;
  /** The caller's file view, and whether the route shows them work figures. */
  readonly reader: ListView | ListReader;
  /** From `useListState`: the URL's view of the list. */
  readonly state: ListViewState;
  readonly onStateChange: (next: ListViewState) => void;
  /** Parts of the URL or of an opened view were left out because they did not fit (AC-LF16). */
  readonly dropped?: boolean;
  readonly onDismissDropped?: () => void;

  /** The page for `state`, undefined while the first one loads. */
  readonly page: ListPage<Row> | undefined;
  readonly status: "loading" | "error" | "ready";
  readonly onRetry: () => void;

  readonly columns: readonly DataColumn<Row>[];
  /** The columns shown until a person chooses; every column when absent. */
  readonly defaultColumns?: readonly string[];
  readonly getRowId: (row: Row) => string;
  /** The row's name, for selection labels, board announcements and bulk refusals. */
  readonly labelOf: (row: Row) => string;
  /** The raw value of a groupable field on a row, as the server keys the group (a bool as "true"). */
  readonly groupKeyOf?: (row: Row, field: string) => string | null;
  /** What a screen reader calls the table. */
  readonly caption: string;
  readonly searchPlaceholder?: string;

  /** A card's content; offers the card view. */
  readonly card?: (row: Row) => React.ReactNode;
  /** The board's move command; offers the board view when the spec has a stage field. */
  readonly board?: {
    readonly stageOf: (row: Row) => string;
    readonly onMove: (row: Row, stage: string) => Promise<void>;
    readonly canMove?: (row: Row) => boolean;
  };
  /** Choices for each `ref` filter (branch names, positions). */
  readonly refOptions?: Readonly<Record<string, readonly RefOption[]>>;
  readonly bulk?: {
    readonly actions: readonly BulkAction[];
    readonly onSelectAll: () => Promise<ListIds>;
    readonly onAction: (key: string, ids: string[]) => Promise<BulkResponse>;
  };
  readonly savedViews?: {
    readonly views: readonly SavedView[] | undefined;
    readonly create: (input: { name: string; shared: boolean; isDefault: boolean; config: SavedViewConfig }) => Promise<unknown>;
    readonly update: (id: string, patch: { config?: SavedViewConfig; isDefault?: boolean }) => Promise<unknown>;
    readonly remove: (id: string) => Promise<unknown>;
  };
  /** Download the current view as CSV, with the columns shown. */
  readonly onExport?: (columns: readonly string[]) => void;
  /** A list with no rows at all: the module's own words and its create action, when the caller may create. */
  readonly empty: { readonly title: string; readonly body?: string; readonly action?: React.ReactNode };
  readonly className?: string;
}

function ViewSwitch({
  views,
  value,
  onChange,
}: {
  views: readonly ListViewKind[];
  value: ListViewKind;
  onChange: (view: ListViewKind) => void;
}) {
  if (views.length < 2) return null;
  const icon = { list: ListIcon, card: LayoutGridIcon, kanban: KanbanSquareIcon };
  const name = { list: "List", card: "Cards", kanban: "Board" };
  return (
    <div role="group" aria-label="View" className="inline-flex rounded border border-border p-0.5">
      {views.map((view) => {
        const Icon = icon[view];
        return (
          <button
            key={view}
            type="button"
            aria-pressed={view === value}
            onClick={() => onChange(view)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm outline-none transition-colors duration-quick",
              "focus-visible:ring-2 focus-visible:ring-ring",
              view === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {name[view]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The one list screen (058-list-framework AC-LF1 to AC-LF16).
 *
 * Search, filters, status chips, sort, grouping, columns, a list, card or board
 * view, saved views, export, selection and bulk actions, built from one list
 * spec and one page of rows. Presentational on purpose: the app's data layer
 * reads the page for `state` and passes it in, with the commands as callbacks,
 * so this never fetches and never decides a permission. What a reader may
 * filter, sort, group or see comes from `visibleFields`, the same function the
 * server refuses from.
 *
 * Loading, failing and empty are three different screens (AC-LF9): a failed
 * read shows the error and a retry, never an empty list, and "nothing matches
 * these filters" offers to clear them rather than reading as "nobody here".
 */
function DataView<Row extends RowData>({
  spec,
  reader,
  state,
  onStateChange,
  dropped = false,
  onDismissDropped,
  page,
  status,
  onRetry,
  columns,
  defaultColumns,
  getRowId,
  labelOf,
  groupKeyOf,
  caption,
  searchPlaceholder = "Search",
  card,
  board,
  refOptions,
  bulk,
  savedViews,
  onExport,
  empty,
  className,
}: DataViewProps<Row>) {
  const { query } = state;
  const fields = React.useMemo(() => visibleFields(spec, reader), [spec, reader]);
  const fieldKeys = React.useMemo(() => new Set(spec.fields.map((f) => f.key)), [spec]);
  const seen = React.useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const sortable = React.useMemo(() => new Set(fields.filter((f) => f.sortable).map((f) => f.key)), [fields]);
  const groupable = React.useMemo(() => fields.filter((f) => f.groupable), [fields]);
  const statusField = spec.statusField ? fields.find((f) => f.key === spec.statusField) : undefined;
  const stageField = spec.stageField ? fields.find((f) => f.key === spec.stageField) : undefined;

  // A column named after a field the reader cannot see does not exist for them (AC-LF4, AC-LF12).
  const allowed = React.useMemo(
    () => columns.filter((c) => !fieldKeys.has(c.key) || seen.has(c.key)),
    [columns, fieldKeys, seen],
  );
  const defaults = React.useMemo(
    () => (defaultColumns ?? allowed.map((c) => c.key)).filter((k) => allowed.some((c) => c.key === k)),
    [defaultColumns, allowed],
  );
  const shownKeys = (state.columns ?? defaults).filter((k) => allowed.some((c) => c.key === k));
  const shown = shownKeys
    .map((k) => allowed.find((c) => c.key === k))
    .filter((c): c is DataColumn<Row> => c !== undefined);

  const views: ListViewKind[] = ["list", ...(card ? (["card"] as const) : []), ...(board && stageField ? (["kanban"] as const) : [])];
  const view = views.includes(state.view) ? state.view : "list";

  const set = (patch: Partial<ListViewState>) => onStateChange({ ...state, ...patch });
  const setQuery = (patch: Partial<typeof query>) => set({ query: { ...query, ...patch } });

  // Search waits for typing to rest, and follows the URL when a view replaces it.
  const [text, setText] = React.useState(query.q ?? "");
  React.useEffect(() => setText(query.q ?? ""), [query.q]);
  React.useEffect(() => {
    if (text === (query.q ?? "")) return;
    const timer = setTimeout(() => setQuery({ q: text.trim() === "" ? undefined : text.trim() }), SEARCH_REST_MS);
    return () => clearTimeout(timer);
    // Only the text starts a search; the query it writes is read fresh when the timer fires.
  }, [text]);

  // The selection is the one thing the URL does not carry, and a new query starts it again.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const queryShape = JSON.stringify([query.q, query.filters, query.groupBy]);
  React.useEffect(() => setSelected(new Set()), [queryShape]);
  const selection = bulk ? { selected, onChange: setSelected } : undefined;

  // The saved view on screen, until the screen moves away from it.
  const [opened, setOpened] = React.useState<{ id: string; config: string } | null>(null);
  const configNow = JSON.stringify(savedViewConfigOf(state));
  const activeId = opened && opened.config === configNow ? opened.id : null;

  const statusValue = (() => {
    if (!statusField) return null;
    const f = query.filters.find((x) => x.field === statusField.key && x.op === "eq");
    return typeof f?.value === "string" ? f.value : null;
  })();
  const setStatus = (value: string | null) => {
    if (!statusField) return;
    const rest = query.filters.filter((x) => x.field !== statusField.key);
    setQuery({ filters: value === null ? rest : [...rest, { field: statusField.key, op: "eq", value }] });
  };

  const changeView = (next: ListViewKind) =>
    set(next === "kanban" ? { view: next, query: { ...query, page: 1, pageSize: BOARD_PAGE_SIZE } } : { view: next });

  const rows = page?.items ?? [];
  const groupBy = query.groupBy;
  const group =
    groupBy && groupKeyOf && page?.groups
      ? { keyOf: (row: Row) => groupKeyOf(row, groupBy), groups: page.groups }
      : undefined;
  const filtered = (query.q ?? "") !== "" || query.filters.length > 0;
  const rowById = new Map(rows.map((row) => [getRowId(row), row]));

  const stages =
    page?.stages ??
    (stageField?.enumValues ?? []).map((key) => ({ key, label: stageField?.enumLabels?.[key] ?? key }));

  let body: React.ReactNode;
  if (status === "error") {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border p-6">
        <p className="text-sm text-foreground">We couldn&apos;t load this list. Nothing is lost; this is on our side.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (status === "loading" || page === undefined) {
    body = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (page.total === 0 && filtered) {
    body = (
      <div className="flex flex-col items-start gap-3 rounded-card border border-border p-6">
        <p className="text-sm text-foreground">Nothing matches these filters.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery({ q: undefined, filters: [] })}
        >
          Clear the search and filters
        </Button>
      </div>
    );
  } else if (page.total === 0) {
    body = (
      <div className="flex flex-col items-start gap-2 rounded-card border border-border p-6">
        <p className="text-sm font-semibold text-foreground">{empty.title}</p>
        {empty.body ? <p className="text-sm text-muted-foreground">{empty.body}</p> : null}
        {empty.action}
      </div>
    );
  } else if (view === "kanban" && board) {
    body = (
      <KanbanBoard
        stages={stages}
        rows={rows}
        getRowId={getRowId}
        stageOf={board.stageOf}
        labelOf={labelOf}
        renderCard={card ?? labelOf}
        onMove={board.onMove}
        canMove={board.canMove}
        total={page.total}
      />
    );
  } else if (view === "card" && card) {
    body = (
      <CardGrid rows={rows} getRowId={getRowId} renderCard={card} labelOf={labelOf} selection={selection} group={group} />
    );
  } else {
    body = (
      <DataTable
        rows={rows}
        columns={shown}
        getRowId={getRowId}
        caption={caption}
        sortable={sortable}
        sort={query.sort}
        onSortChange={(sort) => setQuery({ sort })}
        selection={selection}
        group={group}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {(spec.searchFields ?? []).length > 0 ? (
          <label className="relative flex min-w-48 flex-1 items-center">
            <SearchIcon aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              type="search"
              size="sm"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={text}
              maxLength={100}
              onChange={(event) => setText(event.target.value)}
              className="pl-9"
            />
          </label>
        ) : (
          <div className="flex-1" />
        )}
        <FilterPanel
          spec={spec}
          reader={reader}
          filters={query.filters}
          onChange={(filters) => setQuery({ filters })}
          refOptions={refOptions}
          exclude={statusField ? [statusField.key] : []}
        />
        <GroupSelect
          fields={groupable}
          value={groupBy}
          onChange={(value) => setQuery({ groupBy: value })}
        />
        {view === "list" ? (
          <ColumnChooser
            columns={allowed}
            shown={state.columns}
            defaults={defaults}
            onChange={(next) => set({ columns: next })}
          />
        ) : null}
        <ViewSwitch views={views} value={view} onChange={changeView} />
        {savedViews ? (
          <SavedViewsMenu
            views={savedViews.views}
            activeId={activeId}
            onOpen={(saved) => {
              setOpened({ id: saved.id, config: JSON.stringify(savedViewConfigOf(stateOfSavedView(saved.config))) });
              onStateChange(stateOfSavedView(saved.config));
            }}
            onSave={async (input) => {
              await savedViews.create({ ...input, config: savedViewConfigOf(state) });
            }}
            onOverwrite={async (saved) => {
              await savedViews.update(saved.id, { config: savedViewConfigOf(state) });
              setOpened({ id: saved.id, config: configNow });
            }}
            onSetDefault={async (saved, isDefault) => {
              await savedViews.update(saved.id, { isDefault });
            }}
            onDelete={async (saved) => {
              await savedViews.remove(saved.id);
              setOpened(null);
            }}
          />
        ) : null}
        {onExport ? (
          <Button variant="ghost" size="sm" onClick={() => onExport(shownKeys)} disabled={!page || page.total === 0}>
            <DownloadIcon aria-hidden className="size-4" />
            Export
          </Button>
        ) : null}
      </div>

      {statusField ? <StatusChips field={statusField} counts={page?.statusCounts} value={statusValue} onChange={setStatus} /> : null}

      {dropped ? (
        <div role="status" className="flex items-start gap-3 rounded-card border border-border bg-secondary p-3 text-sm">
          <p className="flex-1 text-foreground">
            Part of this view uses fields you cannot see, or no longer fits this list, so it was left out. What you see is
            everything you may read.
          </p>
          {onDismissDropped ? (
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismissDropped}>
              <XIcon aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {bulk && page ? (
        <BulkBar
          selected={selected.size}
          total={page.total}
          actions={bulk.actions}
          onSelectAll={bulk.onSelectAll}
          onSelect={(ids) => setSelected(new Set(ids))}
          onClear={() => setSelected(new Set())}
          onAction={async (key) => {
            const answer = await bulk.onAction(key, [...selected]);
            setSelected(new Set(answer.results.filter((r) => !r.ok).map((r) => r.id)));
            return answer;
          }}
          labelOf={(id) => {
            const row = rowById.get(id);
            return row ? labelOf(row) : undefined;
          }}
        />
      ) : null}

      {body}

      {page && page.total > 0 && view !== "kanban" ? (
        <Pager
          page={query.page}
          pageSize={query.pageSize}
          total={page.total}
          onPageChange={(p) => setQuery({ page: p })}
          onPageSizeChange={(size) => setQuery({ pageSize: size })}
        />
      ) : null}
    </div>
  );
}

export { DataView };
export type { DataColumn };
