import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListQuery } from "@injishi/contracts";

import { CardGrid } from "../src/components/card-grid";
import { branchName, samplePage, sampleGroupKey, type SampleStaff } from "./list-sample";

/** The card view: the same page as the table, one card per person. Sample people only. */
function Cards({ groupBy, selectable = false }: { groupBy?: string; selectable?: boolean }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const page = samplePage(ListQuery.parse({ groupBy, pageSize: 25 }));
  return (
    <CardGrid
      rows={page.items}
      getRowId={(r: SampleStaff) => r.id}
      labelOf={(r) => r.name}
      renderCard={(r) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{r.name}</span>
          <span className="text-xs text-muted-foreground">
            {r.position} · {branchName(r.branch)}
          </span>
        </div>
      )}
      selection={selectable ? { selected, onChange: setSelected } : undefined}
      group={groupBy && page.groups ? { keyOf: (r) => sampleGroupKey(r, groupBy), groups: page.groups } : undefined}
    />
  );
}

const meta = {
  title: "Lists/CardGrid",
  component: Cards,
} satisfies Meta<typeof Cards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Grouped by status, with a selection box on every card. */
export const GroupedAndSelectable: Story = { args: { groupBy: "status", selectable: true } };
