import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../src/components/checkbox";

/**
 * A whole field, control plus label, on HeroUI (React Aria). Pass the label as
 * children; a separate `<Label htmlFor>` beside it leaves everything but the
 * box inert. State props are React Aria's: `isSelected` / `onChange`.
 */
const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  args: { children: "I’m travelling with pets" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: { defaultSelected: true },
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Checkbox {...args} isDisabled>
        Unavailable option
      </Checkbox>
      <Checkbox {...args} isDisabled defaultSelected>
        Locked at booking
      </Checkbox>
    </div>
  ),
};

/** The shape every call site uses: controlled, with the value lifted into state. */
export const Controlled: Story = {
  render: function Render(args) {
    const [attested, setAttested] = useState(false);
    return (
      <div className="flex flex-col gap-3">
        <Checkbox {...args} isSelected={attested} onChange={setAttested}>
          I confirm I am authorised to act for this business
        </Checkbox>
        <p className="text-sm text-muted-foreground">{attested ? "Attested" : "Not attested"}</p>
      </div>
    );
  },
};

/** A two-line label: the whole row toggles, not just the 20px box. */
export const WithDescription: Story = {
  render: (args) => (
    <Checkbox {...args} className="flex items-start gap-3">
      <span className="block">
        <span className="block text-base leading-tight">I’m travelling with pets</span>
        <span className="block text-sm leading-tight text-muted-foreground">
          Shows only stays that allow them
        </span>
      </span>
    </Checkbox>
  ),
};
