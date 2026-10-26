"use client";

import {
  ListQuery,
  ListViewKind,
  decodeListQuery,
  encodeListQuery,
  fitListQuery,
  type ListReader,
  type ListSpec,
  type ListView,
  type SavedViewConfig,
} from "@injishi/contracts";
import * as React from "react";

/**
 * What a list screen shows (058-list-framework AC-LF2): the query, which view,
 * and which columns, all of it in the URL so a copied link opens the same view.
 * The selection is the one thing a link does not carry.
 */
export interface ListViewState {
  readonly query: ListQuery;
  readonly view: ListViewKind;
  /** The columns shown, in order; null is the screen's own default set. */
  readonly columns: readonly string[] | null;
}

/** The URL keys beside the query's own (`q`, `f`, `s`, `g`, `page`, `size`). */
const VIEW_KEY = "v";
const COLUMNS_KEY = "cols";
const LIST_KEYS = ["q", "f", "s", "g", "page", "size", VIEW_KEY, COLUMNS_KEY] as const;

export interface ReadListState {
  readonly state: ListViewState;
  /**
   * The URL or the view asked for something this reader cannot use (a field
   * that is sensitive for them, a filter that no longer fits), and it was left
   * out. The screen says so (AC-LF16) rather than silently meaning less.
   */
  readonly dropped: boolean;
  /** The URL names no list state at all, which is when a default view opens. */
  readonly empty: boolean;
}

function viewOf(raw: string | null | undefined, spec: ListSpec): ListViewKind {
  const parsed = ListViewKind.safeParse(raw ?? "list");
  if (!parsed.success) return "list";
  return parsed.data === "kanban" && !spec.stageField ? "list" : parsed.data;
}

/** The parts of a query a reader can lose to `fitListQuery`, for comparing. */
function shapeOf(query: ListQuery): string {
  return JSON.stringify([query.q ?? "", query.filters, query.sort, query.groupBy ?? ""]);
}

/** Read the list state out of a search string, fitted to the spec and the reader. */
export function readListState(search: string, spec: ListSpec, reader: ListView | ListReader): ReadListState {
  const params = new URLSearchParams(search);
  const empty = !LIST_KEYS.some((key) => params.has(key));
  const decoded = decodeListQuery(params);
  const asked = decoded.ok ? decoded.query : ListQuery.parse({});
  const query = fitListQuery(spec, asked, reader);
  const columns = params.get(COLUMNS_KEY);
  return {
    state: {
      query,
      view: viewOf(params.get(VIEW_KEY), spec),
      columns: columns ? columns.split(",").filter(Boolean) : null,
    },
    dropped: !decoded.ok || shapeOf(asked) !== shapeOf(query),
    empty,
  };
}

/** Write the list state into a search string, keeping any parameter that is not the list's. */
export function writeListState(search: string, state: ListViewState): string {
  const params = new URLSearchParams(search);
  for (const key of LIST_KEYS) params.delete(key);
  for (const [key, value] of Object.entries(encodeListQuery(state.query))) params.set(key, value);
  if (state.view !== "list") params.set(VIEW_KEY, state.view);
  if (state.columns) params.set(COLUMNS_KEY, state.columns.join(","));
  const out = params.toString();
  return out ? `?${out}` : "";
}

/** A saved view as list state: its query from page one, its view and its columns. */
export function stateOfSavedView(config: SavedViewConfig): ListViewState {
  return {
    query: ListQuery.parse({
      q: config.q,
      filters: config.filters,
      sort: config.sort,
      groupBy: config.groupBy,
      pageSize: config.pageSize,
    }),
    view: config.view,
    columns: config.columns ?? null,
  };
}

/** The list state as a saved view stores it: everything but the page. */
export function savedViewConfigOf(state: ListViewState): SavedViewConfig {
  const { q, filters, sort, groupBy, pageSize } = state.query;
  return {
    ...(q ? { q } : {}),
    filters,
    sort,
    ...(groupBy ? { groupBy } : {}),
    pageSize,
    ...(state.columns ? { columns: [...state.columns] } : {}),
    view: state.view,
  };
}

export interface UseListStateOptions {
  /**
   * The current search string, as the app's router reports it (`useSearchParams`
   * in Next). The URL is the one source of truth: this hook derives the state
   * from it on every render and writes it back through the history API, which
   * the router observes, so a server render and the first client render agree.
   */
  readonly search: string;
  /** Who reads: their file view, and whether the route shows them work figures. */
  readonly reader: ListView | ListReader;
  /** The person's default saved view, opened once when they arrive with an empty URL (AC-LF5). */
  readonly defaultView?: SavedViewConfig | null;
}

export interface UseListState {
  readonly state: ListViewState;
  /** Replace the state. A change to anything but the page goes back to page one. */
  readonly setState: (next: ListViewState | ((current: ListViewState) => ListViewState)) => void;
  /** Parts of the URL or of an opened view were left out because they did not fit (AC-LF16). */
  readonly dropped: boolean;
  readonly dismissDropped: () => void;
}

/**
 * The list screen's state, kept in the URL (058-list-framework AC-LF2).
 *
 * Framework free on purpose: `@injishi/ui` imports no router. The app passes
 * the search string it already reads, and writes go through
 * `window.history.replaceState`, which Next's App Router mirrors into
 * `useSearchParams` without a server round trip. Replace, not push: typing a
 * search or moving a filter should not fill the back button with every step.
 */
export function useListState(spec: ListSpec, options: UseListStateOptions): UseListState {
  const { search, reader, defaultView } = options;
  const view = typeof reader === "string" ? reader : reader.view;
  const figures = typeof reader === "string" ? false : Boolean(reader.figures);
  const read = React.useMemo(
    () => readListState(search, spec, { view, figures }),
    [search, spec, view, figures],
  );
  const current = React.useRef(read.state);
  current.current = read.state;

  const setState = React.useCallback<UseListState["setState"]>((next) => {
    const before = current.current;
    const after = typeof next === "function" ? next(before) : next;
    const pageOnly =
      shapeOf(before.query) === shapeOf(after.query) && before.query.pageSize === after.query.pageSize;
    const settled = pageOnly ? after : { ...after, query: { ...after.query, page: 1 } };
    const url = `${window.location.pathname}${writeListState(window.location.search, settled)}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, []);

  // A default view opens once, and only for a person who arrived with nothing
  // in the URL: a pasted link always wins over a preference.
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current || !defaultView) return;
    opened.current = true;
    if (read.empty) setState(stateOfSavedView(defaultView));
  }, [defaultView, read.empty, setState]);

  // What did not fit is taken out of the URL too, so the address and a copied
  // link carry what the screen actually shows; the notice stays until read.
  const [dropped, setDropped] = React.useState(false);
  React.useEffect(() => {
    if (!read.dropped) return;
    setDropped(true);
    setState(read.state);
  }, [read.dropped, read.state, setState]);
  const dismissDropped = React.useCallback(() => setDropped(false), []);

  return { state: read.state, setState, dropped, dismissDropped };
}
