import type { Meta, StoryObj } from "@storybook/react-vite";
import { NumberValue, RwfAmount } from "../src/components/number-value";

/**
 * HeroUI Pro's NumberValue, and RwfAmount: every franc figure in Rwandan
 * francs, en-RW, no decimals, in tabular figures so a column lines up.
 */
const meta = {
  title: "Pro/NumberValue",
  component: NumberValue,
  args: { value: 1059060 },
} satisfies Meta<typeof NumberValue>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A bill total. */
export const Rwf: Story = { render: (args) => <RwfAmount value={args.value} /> };

/** A big figure in a KPI, shortened. */
export const Compact: Story = { render: () => <RwfAmount notation="compact" value={14820000} /> };

/** Money down a column: the digits line up. */
export const Column: Story = {
  render: () => (
    <div className="flex max-w-narrow flex-col items-end gap-1">
      {[343010, 407200, 308850, 1059060].map((v) => (
        <RwfAmount key={v} value={v} />
      ))}
    </div>
  ),
};

/** A plain count with a suffix. */
export const WithSuffix: Story = {
  render: () => (
    <NumberValue value={16}>
      <NumberValue.Suffix> of 25 rooms</NumberValue.Suffix>
    </NumberValue>
  ),
};
