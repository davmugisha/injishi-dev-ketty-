import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusChips } from "../src/components/status-chips";
import { SAMPLE_FIELDS } from "./list-sample";

/** Quick status filters with their counts. Sample counts only. */
const FIELD = SAMPLE_FIELDS.find((f) => f.key === "status") ?? SAMPLE_FIELDS[0];

function Chips({ start = null }: { start?: string | null }) {
  const [value, setValue] = React.useState<string | null>(start);
  return (
    <StatusChips
      field={FIELD}
      counts={[
        { value: "active", count: 120 },
        { value: "offboarded", count: 12 },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

const meta = {
  title: "Lists/StatusChips",
  component: Chips,
} satisfies Meta<typeof Chips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** "Left" chosen; every chip keeps its count, because the counts ignore the status filter. */
export const Chosen: Story = { args: { start: "offboarded" } };
