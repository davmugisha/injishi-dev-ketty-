import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../src/components/input";
import { Label } from "../src/components/label";

/**
 * The one text field (ADR-036 call 1). Its boundary is `border-input`, the 3:1
 * field outline, not the 1.24:1 decorative hairline (ADR-025).
 */
const meta = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "you@example.rw" },
  argTypes: {
    shape: { control: "inline-radio", options: ["field", "pill"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [(Story) => <div className="max-w-form"><Story /></div>],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-email">Email</Label>
      <Input {...args} id="story-email" type="email" />
    </div>
  ),
};

/** `field` is a row in a form; `pill` is the marketplace search and filter box. */
export const Shapes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Input {...args} shape="field" placeholder="Field" />
      <Input {...args} shape="pill" placeholder="Search Kigali, Musanze, Rubavu" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Input {...args} size="sm" placeholder="Small" />
      <Input {...args} size="md" placeholder="Medium" />
      <Input {...args} size="lg" placeholder="Large" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "host@injishi.rw" },
};

/** The error pairs `aria-invalid` with a described message; colour alone is never the signal. */
export const Invalid: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-tin">TIN</Label>
      <Input
        {...args}
        id="story-tin"
        defaultValue="12345"
        aria-invalid
        aria-describedby="story-tin-error"
        placeholder=""
      />
      <p id="story-tin-error" className="text-sm text-danger">
        A TIN has nine digits. This one has five.
      </p>
    </div>
  ),
};
