import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../src/components/input";
import { Label } from "../src/components/label";

/**
 * A field's label, on HeroUI. Inside a HeroUI field it wires itself through
 * React Aria context; beside a bare control, pass `htmlFor`.
 */
const meta = {
  title: "Primitives/Label",
  component: Label,
  args: { children: "Full name" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ForAField: Story = {
  render: (args) => (
    <div className="flex max-w-form flex-col gap-2">
      <Label {...args} htmlFor="story-name" />
      <Input id="story-name" placeholder="As it appears on your ID" />
    </div>
  ),
};
