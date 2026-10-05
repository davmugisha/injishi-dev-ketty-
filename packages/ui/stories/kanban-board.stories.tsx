import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { KanbanBoard } from "../src/components/kanban-board";
import { SAMPLE_FIELDS, SAMPLE_ROWS, type SampleStaff } from "./list-sample";

/**
 * The board: drag a card by its grip, or focus the grip and use Space and the
 * arrow keys, or use its Move to menu. A refused move puts the card back with
 * the server's words above the board. Sample people only.
 */
const STAGES = (SAMPLE_FIELDS.find((f) => f.key === "stage")?.enumValues ?? []).map((key) => ({
  key,
  label: SAMPLE_FIELDS.find((f) => f.key === "stage")?.enumLabels?.[key] ?? key,
}));

function Board({ refuse = false, total }: { refuse?: boolean; total?: number }) {
  const [rows, setRows] = React.useState<readonly SampleStaff[]>(SAMPLE_ROWS);
  return (
    <KanbanBoard
      stages={STAGES}
      rows={rows}
      getRowId={(r) => r.id}
      stageOf={(r) => r.stage}
      labelOf={(r) => r.name}
      renderCard={(r) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.position}</span>
        </div>
      )}
      onMove={async (row, stage) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (refuse) throw new Error("Schedule an interview before making an offer.");
        setRows((all) => all.map((r) => (r.id === row.id ? { ...r, stage: stage as SampleStaff["stage"] } : r)));
      }}
      canMove={(r) => r.stage !== "hired"}
      total={total}
    />
  );
}

const meta = {
  title: "Lists/KanbanBoard",
  component: Board,
} satisfies Meta<typeof Board>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hired cards cannot move; the rest can. */
export const Default: Story = {};

/** Every move refused: the card returns and the reason shows. */
export const Refusing: Story = { args: { refuse: true } };

/** More cards match than the board loads: it says so and points at the list view. */
export const OverTheCap: Story = { args: { total: 240 } };
