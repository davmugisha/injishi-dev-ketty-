import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { BulkBar } from "../src/components/bulk-bar";
import { SAMPLE_ROWS } from "./list-sample";

/**
 * The bar a selection brings up. Press "Approve" to see a partial success: one
 * row refused in the command's own words, the others done. Sample rows only.
 */
function Bar({ matching = 14 }: { matching?: number }) {
  const [selected, setSelected] = React.useState<string[]>(SAMPLE_ROWS.slice(0, 3).map((r) => r.id));
  return (
    <BulkBar
      selected={selected.length}
      total={matching}
      actions={[
        { key: "approve", label: "Approve" },
        { key: "reject", label: "Refuse", danger: true },
      ]}
      onSelectAll={async () => ({
        ids: SAMPLE_ROWS.slice(0, Math.min(matching, 200)).map((r) => r.id),
        total: matching,
      })}
      onSelect={setSelected}
      onClear={() => setSelected([])}
      onAction={async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return {
          results: selected.map((id, i) =>
            i === 0 ? { id, ok: false, status: 409, error: "This request was already decided." } : { id, ok: true },
          ),
        };
      }}
      labelOf={(id) => SAMPLE_ROWS.find((r) => r.id === id)?.name}
    />
  );
}

const meta = {
  title: "Lists/BulkBar",
  component: Bar,
} satisfies Meta<typeof Bar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The filter matches more than one action takes: select all refuses and says why. */
export const OverTheCap: Story = { args: { matching: 340 } };
