import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListQuery, type ListReader } from "@injishi/contracts";

import { Badge } from "../src/components/badge";
import { Button } from "../src/components/button";
import type { DataColumn } from "../src/components/data-table";
import { DataView } from "../src/components/data-view";
import type { ListViewState } from "../src/lib/use-list-state";
import {
  SAMPLE_BRANCHES,
  SAMPLE_ROWS,
  SAMPLE_SPEC,
  branchName,
  samplePage,
  sampleGroupKey,
  type SampleStaff,
} from "./list-sample";

/**
 * The one list screen (058-list-framework). Search, filters, status chips,
 * sort by header (shift click for a second key), grouping, columns, the card
 * and board views, saved views and bulk actions, all over the sample staff
 * list answered in memory the way a route answers it. Sample people only.
 */
const COLUMNS: DataColumn<SampleStaff>[] = [
  { key: "number", header: "Number", cell: (r) => <span className="tabular-nums">{r.number}</span> },
  { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "position", header: "Position", cell: (r) => r.position },
  { key: "branch", header: "Branch", cell: (r) => branchName(r.branch) },
  { key: "hiredOn", header: "Hired on", cell: (r) => r.hiredOn },
  {
    key: "status",
    header: "Status",
    cell: (r) => <Badge variant={r.status === "active" ? "success" : "default"}>{r.status === "active" ? "Working" : "Left"}</Badge>,
  },
  { key: "wage", header: "Monthly wage", align: "end", cell: (r) => `${r.wage.toLocaleString("en-RW")} RWF` },
];

function Screen({
  reader = "full",
  status = "ready",
  rows = SAMPLE_ROWS,
  refuseMoves = false,
  start,
}: {
  reader?: "basic" | "full" | ListReader;
  status?: "loading" | "error" | "ready";
  rows?: readonly SampleStaff[];
  refuseMoves?: boolean;
  start?: Partial<ListViewState>;
}) {
  const [state, setState] = React.useState<ListViewState>({
    query: ListQuery.parse({}),
    view: "list",
    columns: null,
    ...start,
  });
  const [data, setData] = React.useState(rows);
  const page = status === "ready" ? samplePage(state.query, data) : undefined;
  return (
    <DataView
      spec={SAMPLE_SPEC}
      reader={reader}
      state={state}
      onStateChange={(next) => setState(next)}
      page={page}
      status={status}
      onRetry={() => undefined}
      columns={COLUMNS}
      defaultColumns={["number", "name", "position", "branch", "status"]}
      getRowId={(r) => r.id}
      labelOf={(r) => r.name}
      groupKeyOf={sampleGroupKey}
      caption="Staff"
      searchPlaceholder="Search name or number"
      refOptions={{ branch: SAMPLE_BRANCHES }}
      card={(r) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{r.name}</span>
          <span className="text-xs text-muted-foreground">
            {r.position} · {branchName(r.branch)}
          </span>
        </div>
      )}
      board={{
        stageOf: (r) => r.stage,
        onMove: async (row, stage) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (refuseMoves) throw new Error("An offer needs a signed contract first.");
          setData((all) => all.map((r) => (r.id === row.id ? { ...r, stage: stage as SampleStaff["stage"] } : r)));
        },
      }}
      bulk={{
        actions: [{ key: "remind", label: "Send a reminder" }],
        onSelectAll: async () => {
          const all = samplePage({ ...state.query, page: 1, pageSize: 100 }, data);
          return { ids: all.items.map((r) => r.id), total: all.total };
        },
        onAction: async (_key, ids) => ({
          results: ids.map((id, i) => (i === 1 ? { id, ok: false, status: 409, error: "Already reminded today." } : { id, ok: true })),
        }),
      }}
      savedViews={{
        views: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            listKey: SAMPLE_SPEC.key,
            name: "Kitchen, working",
            config: { filters: [{ field: "status", op: "eq", value: "active" }], sort: [], pageSize: 25, view: "list" },
            shared: true,
            isDefault: false,
            mine: false,
            authorName: "Mukamana Béatrice",
            updatedAt: "2026-10-01T08:00:00.000Z",
          },
        ],
        create: async () => undefined,
        update: async () => undefined,
        remove: async () => undefined,
      }}
      onExport={() => undefined}
      empty={{
        title: "Nobody is on file yet",
        body: "Add the people who work here, with or without an account.",
        action: <Button size="sm">Add a person</Button>,
      }}
    />
  );
}

const meta = {
  title: "Lists/DataView",
  component: Screen,
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything on: try a filter, a group, a shift click sort, the card and board views. */
export const Default: Story = {};

/** A `people.view` reader: the wage column, its filter and its sort do not exist (AC-LF4). */
export const BasicReader: Story = { args: { reader: "basic" } };

/** Grouped by branch: rows arrive group by group, each with its count (AC-LF14). */
export const Grouped: Story = { args: { start: { query: ListQuery.parse({ groupBy: "branch" }) } } };

/** The board. Moves succeed after a short wait. */
export const Board: Story = { args: { start: { view: "kanban", query: ListQuery.parse({ pageSize: 100 }) } } };

/** The board refusing: the card goes back, and the server's words show above it (AC-LF8). */
export const BoardRefusing: Story = {
  args: { refuseMoves: true, start: { view: "kanban", query: ListQuery.parse({ pageSize: 100 }) } },
};

/** First load. */
export const Loading: Story = { args: { status: "loading" } };

/** A failed read is an error with a retry, never an empty list (AC-LF9). */
export const Failed: Story = { args: { status: "error" } };

/** Nobody on file at all: the module's own words and its create action. */
export const Empty: Story = { args: { rows: [] } };

/** Filters that match nobody offer to clear them, not "nobody here". */
export const NothingMatches: Story = { args: { start: { query: ListQuery.parse({ q: "zzz" }) } } };
