import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListQuery, type ListSort } from "@injishi/contracts";

import { DataTable, type DataColumn } from "../src/components/data-table";
import { SAMPLE_FIELDS, branchName, samplePage, sampleGroupKey, type SampleStaff } from "./list-sample";

/**
 * The list view on its own: a native table, sorted on the server. Click a
 * header to sort by it alone; shift click to add it as the next key. A header
 * whose field the spec does not let sort is plain text. Sample people only.
 */
const COLUMNS: DataColumn<SampleStaff>[] = [
  { key: "number", header: "Number", cell: (r) => r.number },
  { key: "name", header: "Name", cell: (r) => r.name },
  { key: "position", header: "Position", cell: (r) => r.position },
  { key: "branch", header: "Branch", cell: (r) => branchName(r.branch) },
  { key: "hiredOn", header: "Hired on", cell: (r) => r.hiredOn },
];
const SORTABLE = new Set(SAMPLE_FIELDS.filter((f) => f.sortable).map((f) => f.key));

function Table({ groupBy, selectable = false }: { groupBy?: string; selectable?: boolean }) {
  const [sort, setSort] = React.useState<ListSort[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const page = samplePage(ListQuery.parse({ sort, groupBy, pageSize: 25 }));
  return (
    <DataTable
      rows={page.items}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      caption="Staff"
      sortable={SORTABLE}
      sort={sort}
      onSortChange={setSort}
      selection={selectable ? { selected, onChange: setSelected } : undefined}
      group={groupBy && page.groups ? { keyOf: (r) => sampleGroupKey(r, groupBy), groups: page.groups } : undefined}
    />
  );
}

const meta = {
  title: "Lists/DataTable",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Rows grouped by branch, each group opening with its own header row and count. */
export const Grouped: Story = { args: { groupBy: "branch" } };

/** With a selection column: the header box selects every row on the page. */
export const Selectable: Story = { args: { selectable: true } };
