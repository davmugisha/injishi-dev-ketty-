import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ColumnChooser } from "../src/components/column-chooser";

/** Show and hide columns; the last shown one cannot be hidden. */
const COLUMNS = [
  { key: "number", header: "Number" },
  { key: "name", header: "Name" },
  { key: "position", header: "Position" },
  { key: "branch", header: "Branch" },
  { key: "hiredOn", header: "Hired on" },
];
const DEFAULTS = ["number", "name", "position", "branch"];

function Chooser() {
  const [shown, setShown] = React.useState<string[] | null>(null);
  return (
    <div className="flex items-center gap-3">
      <ColumnChooser columns={COLUMNS} shown={shown} defaults={DEFAULTS} onChange={setShown} />
      <span className="text-sm text-muted-foreground">{(shown ?? DEFAULTS).join(", ")}</span>
    </div>
  );
}

const meta = {
  title: "Lists/ColumnChooser",
  component: Chooser,
} satisfies Meta<typeof Chooser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
