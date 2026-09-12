import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/tabs";

/**
 * The section switcher, in both of its looks. Wave 2 by the plan, landed out
 * of order on 2026-09-12 with the `underline` variant: a second look nobody
 * can see beside the first is a second look nobody reviews.
 *
 * `pill` is a segmented control and reads as a set of choices. `underline`
 * sits above content it must not compete with — the marketplace's trip-style
 * band and the explore result list are the two callers — and says only "you
 * are here". The labels are those two callers' own.
 */
const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
  args: { defaultValue: "lakeside" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const TRIPS = [
  { id: "lakeside", label: "Lakeside" },
  { id: "gorilla", label: "Gorilla trekking" },
  { id: "city", label: "City break" },
  { id: "safari", label: "Safari" },
  { id: "business", label: "Business" },
];

function Panels() {
  return (
    <>
      {TRIPS.map((trip) => (
        <TabsContent
          key={trip.id}
          value={trip.id}
          className="pt-block text-sm text-muted-foreground"
        >
          Districts for a {trip.label.toLowerCase()} trip.
        </TabsContent>
      ))}
    </>
  );
}

/** The default: one filled ink pill beside outlined ones. */
export const Pill: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        {TRIPS.map((trip) => (
          <TabsTrigger key={trip.id} value={trip.id}>
            {trip.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <Panels />
    </Tabs>
  ),
};

/** Plain labels over a hairline; the selected one carries a 2px accent rule. */
export const Underline: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList variant="underline">
        {TRIPS.map((trip) => (
          <TabsTrigger key={trip.id} value={trip.id}>
            {trip.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <Panels />
    </Tabs>
  ),
};

/**
 * The phone case. A row wider than its container scrolls sideways, and the
 * hairline has to hold under every tab at every scroll position without the
 * row growing a vertical scrollbar — which is why the list draws it as an
 * inset shadow rather than a border.
 */
export const UnderlineScrolling: Story = {
  render: (args) => (
    <div className="max-w-tile">
      <Tabs {...args}>
        <TabsList variant="underline" className="-mx-1 scrollbar overflow-x-auto px-1">
          {TRIPS.map((trip) => (
            <TabsTrigger key={trip.id} value={trip.id} className="text-base">
              {trip.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Panels />
      </Tabs>
    </div>
  ),
};
