import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ListPageSize } from "@injishi/contracts";

import { Pager } from "../src/components/pager";

/** Page numbers with a total, and the four page sizes the list query accepts. */
function Pages({ total = 132, start = 1 }: { total?: number; start?: number }) {
  const [page, setPage] = React.useState(start);
  const [pageSize, setPageSize] = React.useState<ListPageSize>(25);
  return (
    <Pager
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );
}

const meta = {
  title: "Lists/Pager",
  component: Pages,
} satisfies Meta<typeof Pages>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The middle of a long list. */
export const Middle: Story = { args: { start: 3 } };

/** Everything fits on one page: both arrows are off. */
export const OnePage: Story = { args: { total: 8 } };
