import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { DateRange } from "react-day-picker";
import { Calendar } from "../src/components/calendar";
import { CALENDAR } from "./copy";

/**
 * The check-in / check-out picker behind the booking widget's date popover,
 * on react-day-picker. Every class it draws with is the component's own; a
 * caller passes `mode`, `selected` and `onSelect` and nothing about looks.
 *
 * The stories pin the month and "today" (6 October 2026) so the grid in a
 * screenshot does not drift with the clock.
 */
const TODAY = new Date(2026, 9, 6);

const meta = {
  title: "Primitives/Calendar",
  component: Calendar,
  // The width of its months, as inside the booking widget's `w-auto` popover:
  // the month arrows are placed against that box.
  decorators: [(Story) => <div className="w-fit"><Story /></div>],
} satisfies Meta;

// `Calendar` takes react-day-picker's props, a union on `mode`, which
// Storybook's arg inference cannot type, so these stories take no args.
export default meta;
type Story = StoryObj;

/** One day. */
export const Single: Story = {
  render: function Render() {
    const [day, setDay] = useState<Date | undefined>(new Date(2026, 9, 14));
    return (
      <Calendar
        mode="single"
        defaultMonth={TODAY}
        today={TODAY}
        selected={day}
        onSelect={setDay}
      />
    );
  },
};

/**
 * A stay: the first and last nights carry half the band behind their circle,
 * so the range reads as one bar from check-in to check-out.
 */
export const Range: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(2026, 9, 14),
      to: new Date(2026, 9, 18),
    });
    return (
      <Calendar
        mode="range"
        defaultMonth={TODAY}
        today={TODAY}
        selected={range}
        onSelect={setRange}
      />
    );
  },
};

/**
 * The booking widget's shape on a desktop: two months side by side, the past
 * and the nights already sold refused, and no going back before this month.
 */
export const TwoMonthsWithUnavailable: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(2026, 9, 23),
      to: new Date(2026, 9, 26),
    });
    return (
      <Calendar
        mode="range"
        defaultMonth={TODAY}
        today={TODAY}
        numberOfMonths={2}
        startMonth={TODAY}
        selected={range}
        onSelect={setRange}
        disabled={[
          { before: TODAY },
          { from: new Date(2026, 9, 9), to: new Date(2026, 9, 11) },
          new Date(2026, 10, 2),
        ]}
      />
    );
  },
};

/**
 * Kinyarwanda month and day names from the mobile catalogue, through
 * react-day-picker's formatters. "Gashyantare" and "Ugushyingo" are the long
 * months; the caption must hold them between the two arrows.
 */
export const LongContent: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>({
      from: new Date(2026, 1, 9),
      to: new Date(2026, 1, 12),
    });
    return (
      <Calendar
        mode="range"
        defaultMonth={new Date(2026, 1, 1)}
        today={TODAY}
        numberOfMonths={2}
        selected={range}
        onSelect={setRange}
        formatters={{
          formatCaption: (month) => `${CALENDAR.months.rw[month.getMonth()]} ${month.getFullYear()}`,
          formatWeekdayName: (day) => CALENDAR.weekdays.rw[day.getDay()],
        }}
        labels={{
          labelPrevious: () => CALENDAR.prevMonth.rw,
          labelNext: () => CALENDAR.nextMonth.rw,
        }}
      />
    );
  },
};
