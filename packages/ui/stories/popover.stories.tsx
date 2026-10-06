import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "../src/components/button";
import { Calendar } from "../src/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/popover";
import { CALENDAR } from "./copy";

/**
 * A panel anchored to its trigger, on Radix: the booking widget's date picker
 * is the main caller. It portals to `body` (or into a `NativeDialog` when it is
 * inside one), sits 8px from its trigger, and closes on Escape and on a press
 * outside. `w-72` by default; a caller sizes it with a class.
 *
 * Each story but `Closed` opens on load (`defaultOpen`); on the docs page each
 * renders in its own frame.
 */
const meta = {
  title: "Overlays/Popover",
  component: Popover,
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  decorators: [(Story) => <div className="flex justify-center pt-4"><Story /></div>],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The resting state. Press the trigger to open. */
export const Closed: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Cancellation policy</Button>
      </PopoverTrigger>
      <PopoverContent className="text-sm">
        Free cancellation until 48 hours before check-in. After that, the first night is kept.
      </PopoverContent>
    </Popover>
  ),
};

/** A short explanation under its trigger. */
export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Cancellation policy</Button>
      </PopoverTrigger>
      <PopoverContent className="text-sm">
        Free cancellation until 48 hours before check-in. After that, the first night is kept.
      </PopoverContent>
    </Popover>
  ),
};

/** The booking widget's dates: a calendar in a popover sized to it. */
export const DatePicker: Story = {
  args: { defaultOpen: true },
  render: function Render(args) {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(2026, 9, 14),
      to: new Date(2026, 9, 16),
    });
    return (
      <Popover {...args}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <CalendarDays />
            {CALENDAR.checkIn.en} – {CALENDAR.checkOut.en}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={new Date(2026, 9, 1)}
            today={new Date(2026, 9, 6)}
            selected={range}
            onSelect={setRange}
          />
        </PopoverContent>
      </Popover>
    );
  },
};

/** Kinyarwanda in the trigger and the panel: the panel wraps at its own width. */
export const LongContent: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <CalendarDays />
          {CALENDAR.pickStart.rw}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-3 text-sm">
        <p>
          {CALENDAR.checkIn.rw} · {CALENDAR.checkOut.rw}
        </p>
        <Button variant="ghost" size="sm" className="self-start">
          {CALENDAR.clear.rw}
        </Button>
      </PopoverContent>
    </Popover>
  ),
};
