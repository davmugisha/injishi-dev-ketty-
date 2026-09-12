import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../src/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../src/components/select";
import { STATUS } from "./copy";

/**
 * Single choice, on Radix. It has no `size` or `shape` prop yet: the trigger is
 * fixed at `h-11 rounded-full`, which is Input's `lg` pill. Matching Input's
 * props is in the audit's API normalisation list; these stories show it as it
 * is.
 */
const meta = {
  title: "Primitives/Select",
  component: Select,
  decorators: [(Story) => <div className="max-w-form"><Story /></div>],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const DISTRICTS = ["Gasabo", "Kicukiro", "Nyarugenge", "Musanze", "Rubavu", "Huye"];

export const Default: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-district">District</Label>
      <Select {...args}>
        <SelectTrigger id="story-district">
          <SelectValue placeholder="Choose a district" />
        </SelectTrigger>
        <SelectContent>
          {DISTRICTS.map((d) => (
            <SelectItem key={d} value={d.toLowerCase()}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Grouped: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="District">
        <SelectValue placeholder="Choose a district" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Kigali City</SelectLabel>
          <SelectItem value="gasabo">Gasabo</SelectItem>
          <SelectItem value="kicukiro">Kicukiro</SelectItem>
          <SelectItem value="nyarugenge">Nyarugenge</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Northern Province</SelectLabel>
          <SelectItem value="musanze">Musanze</SelectItem>
          <SelectItem value="burera" disabled>
            Burera
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Select {...args} disabled defaultValue="gasabo">
      <SelectTrigger aria-label="District">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gasabo">Gasabo</SelectItem>
      </SelectContent>
    </Select>
  ),
};

/** The longest labels the product prints, in Kinyarwanda. The trigger clamps to one line. */
export const LongContent: Story = {
  render: (args) => (
    <Select {...args} defaultValue="rent.due">
      <SelectTrigger aria-label="Rent status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["rent.paid", "rent.due", "rent.overdue", "lease.pending_signature"] as const).map((k) => (
          <SelectItem key={k} value={k}>
            {STATUS[k].rw}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
