import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrendChip } from "../src/components/trend-chip";

/**
 * HeroUI Pro's TrendChip: which way a figure moved. The arrow and the sign
 * say it as well as the colour, so it reads without colour too.
 */
const meta = {
  title: "Pro/TrendChip",
  component: TrendChip,
  args: { trend: "up", children: "+12%" },
} satisfies Meta<typeof TrendChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {};
export const Down: Story = { args: { trend: "down", children: "-4%" } };
export const Flat: Story = { args: { trend: "neutral", children: "0%" } };

/** All three side by side, as they sit beside a strip of figures. */
export const Together: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TrendChip trend="up">+12%</TrendChip>
      <TrendChip trend="down">-4%</TrendChip>
      <TrendChip trend="neutral">0%</TrendChip>
    </div>
  ),
};
