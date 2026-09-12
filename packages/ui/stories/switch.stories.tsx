import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../src/components/label";
import { Switch } from "../src/components/switch";

/**
 * On HeroUI (React Aria), but it still takes Radix-style props: `checked` /
 * `onCheckedChange` and `size="default"`, where Checkbox takes `isSelected` /
 * `onChange` and every other component says `md`. Normalising it is in the
 * audit's API list; these stories document the API as it ships today.
 */
const meta = {
  title: "Primitives/Switch",
  component: Switch,
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "default"] },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch {...args} id="story-instant" aria-label="Instant booking" />
      <Label htmlFor="story-instant">Instant booking</Label>
    </div>
  ),
};

export const On: Story = {
  args: { defaultChecked: true, "aria-label": "Instant booking" },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <Switch {...args} size="sm" aria-label="Small" defaultChecked />
      <Switch {...args} size="default" aria-label="Default" defaultChecked />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <Switch {...args} disabled aria-label="Off, disabled" />
      <Switch {...args} disabled defaultChecked aria-label="On, disabled" />
    </div>
  ),
};

export const Controlled: Story = {
  render: function Render(args) {
    const [on, setOn] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <Switch {...args} checked={on} onCheckedChange={setOn} aria-label="Non-refundable rate" />
        <span className="text-sm">{on ? "Non-refundable, 10% off" : "Flexible cancellation"}</span>
      </div>
    );
  },
};
