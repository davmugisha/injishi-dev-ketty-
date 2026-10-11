import type { Meta, StoryObj } from "@storybook/react-vite";
import { Segment } from "../src/components/segment";

/**
 * HeroUI Pro's Segment: a few mutually exclusive views in one pill, for
 * switching what a strip shows rather than going somewhere else.
 */
const meta = {
  title: "Pro/Segment",
  component: Segment,
} satisfies Meta;

// A compound component whose children ARE the story, so these stories take no
// args and say so (the Card story uses the same idiom).
export default meta;
type Story = StoryObj;

/** The period a revenue strip covers. */
export const Period: Story = {
  render: () => (
    <Segment aria-label="Period" defaultSelectedKey="today">
      <Segment.Item id="today">Today</Segment.Item>
      <Segment.Item id="week">This week</Segment.Item>
      <Segment.Item id="month">This month</Segment.Item>
    </Segment>
  ),
};

/** Grid or list, on the room board. */
export const BoardView: Story = {
  render: () => (
    <Segment aria-label="Room board view" defaultSelectedKey="grid">
      <Segment.Item id="grid">Grid</Segment.Item>
      <Segment.Item id="list">List</Segment.Item>
    </Segment>
  ),
};
