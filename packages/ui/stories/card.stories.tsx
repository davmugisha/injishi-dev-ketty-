import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/components/badge";
import { Button } from "../src/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/card";

/**
 * The surface container. `rounded-card`, no padding of its own: the caller
 * sets the inset (`p-inset`), which is what the rhythm token is for.
 */
const meta = {
  title: "Primitives/Card",
  component: Card,
  decorators: [(Story) => <div className="max-w-narrow"><Story /></div>],
} satisfies Meta;

// `Card`'s props are a union on `as` ("div" | "dl"), which Storybook's arg
// inference cannot type, so these stories take no args and say so.
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Card className="gap-4 border border-border p-inset">
      <CardHeader>
        <CardTitle>Lake Kivu Lodge (demo)</CardTitle>
        <CardDescription>Rubavu · 12 rooms · Instant booking</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        Check-in from 14:00. Airport transfer on request.
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View stay</Button>
        <Button size="sm" variant="ghost">Save</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * `as="dl"` (ADR-040 call 3): the title becomes the term and the description
 * its value, which is how a screen reader announces a statistic. This is the
 * shape the admin and operator apps' local `StatCard`s were reaching for.
 */
export const Statistic: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      <Card as="dl" className="gap-2 border border-border p-inset">
        <CardHeader>
          <CardTitle className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            Occupancy
          </CardTitle>
          <CardDescription className="text-3xl font-semibold text-foreground">78%</CardDescription>
        </CardHeader>
      </Card>
      <Card as="dl" className="gap-2 border border-border p-inset">
        <CardHeader>
          <CardTitle className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            Revenue today
          </CardTitle>
          <CardDescription className="text-3xl font-semibold text-foreground">RWF 1,240,000</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
};

export const WithStatus: Story = {
  render: () => (
    <Card className="gap-3 border border-border p-inset">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Booking INJ-4821</CardTitle>
        <Badge variant="success" size="sm">Confirmed</Badge>
      </CardHeader>
      <CardDescription>2 nights · 14–16 Oct · 2 adults</CardDescription>
    </Card>
  ),
};
