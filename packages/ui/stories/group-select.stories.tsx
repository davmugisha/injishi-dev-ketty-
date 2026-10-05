import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { GroupSelect } from "../src/components/group-select";
import { SAMPLE_FIELDS } from "./list-sample";

/** Group by one field, from the fields the spec lets group. */
function Grouping() {
  const [value, setValue] = React.useState<string | undefined>(undefined);
  return <GroupSelect fields={SAMPLE_FIELDS.filter((f) => f.groupable)} value={value} onChange={setValue} />;
}

const meta = {
  title: "Lists/GroupSelect",
  component: Grouping,
} satisfies Meta<typeof Grouping>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
