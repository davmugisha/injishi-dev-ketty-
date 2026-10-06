"use client";

/**
 * DataGrid, from HeroUI Pro (`@heroui-pro/react`, a paid licence).
 *
 * A table with one column definition per field: sorting, row selection,
 * pinned and resizable columns, a footer, an empty state and virtualization,
 * on the HeroUI Table and React Aria. It replaces the hand built CSS grids the
 * operator app's lists were drawn with, where each row was its own grid and an
 * `auto` action column let Dates and Status drift from row to row
 * (Reservations, layout audit 2026-10-05): one grid, one set of columns.
 *
 * Not a compound component: `columns`, `data` and `getRowId` describe the
 * whole table, and a column's `cell` renders anything. `aria-label` is
 * required by the type, because a table with no name is not announced.
 *
 * Apps reach Pro only through this package; see `kpi.tsx` for why, and for
 * the install token every build needs.
 */
export { DataGrid } from "@heroui-pro/react";
export type {
  DataGridProps,
  DataGridColumn,
  DataGridSelection,
  DataGridSortDescriptor,
  DataGridSortDirection,
} from "@heroui-pro/react";
