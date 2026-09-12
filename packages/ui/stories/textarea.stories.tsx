import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../src/components/label";
import { Textarea } from "../src/components/textarea";

/** Grows with its content (`field-sizing-content`) from a 64px floor. */
const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: { placeholder: "Anything the front desk should know before you arrive" },
  decorators: [(Story) => <div className="max-w-form"><Story /></div>],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-note">Note to the host</Label>
      <Textarea {...args} id="story-note" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Late check-in, around 22:00." },
};

export const Invalid: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-reason">Reason for refusal</Label>
      <Textarea {...args} id="story-reason" aria-invalid aria-describedby="story-reason-error" placeholder="" />
      <p id="story-reason-error" className="text-sm text-danger">
        Give a reason. The applicant sees it.
      </p>
    </div>
  ),
};

/** The field grows rather than scrolling a few lines of a long message. */
export const LongContent: Story = {
  args: {
    defaultValue:
      "We arrive on the evening bus from Huye, probably after 21:00. Two adults and a child of six. " +
      "Could the room have a cot, and is there somewhere to leave luggage on the last morning? " +
      "We would also like to book the airport transfer for the Sunday.",
  },
};
