import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ListFilter } from "@injishi/contracts";

import { FilterPanel } from "../src/components/filter-panel";
import { SAMPLE_BRANCHES, SAMPLE_SPEC } from "./list-sample";

/**
 * The filter panel, built from the list spec. Each field offers only the
 * conditions its type allows, a row that does not fit says why, and the
 * monthly wage exists only for a full reader. Sample list only.
 */
function Panel({ reader = "full", start = [] }: { reader?: "basic" | "full"; start?: ListFilter[] }) {
  const [filters, setFilters] = React.useState<ListFilter[]>(start);
  return (
    <div className="flex flex-col gap-3">
      <FilterPanel
        spec={SAMPLE_SPEC}
        reader={reader}
        filters={filters}
        onChange={setFilters}
        refOptions={{ branch: SAMPLE_BRANCHES }}
        exclude={["status"]}
      />
      <pre className="text-xs text-muted-foreground">{JSON.stringify(filters, null, 2)}</pre>
    </div>
  );
}

const meta = {
  title: "Lists/FilterPanel",
  component: Panel,
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Two filters already applied. */
export const WithFilters: Story = {
  args: {
    start: [
      { field: "branch", op: "in", value: ["b-kiyovu", "b-rubavu"] },
      { field: "hiredOn", op: "gte", value: "2024-01-01" },
    ],
  },
};

/** A `people.view` reader: the wage is not offered at all. */
export const BasicReader: Story = { args: { reader: "basic" } };
