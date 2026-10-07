import type { Meta, StoryObj } from "@storybook/react-vite";
import { BedDouble, CalendarCheck } from "lucide-react";
import { Button } from "../src/components/button";
import { EmptyState } from "../src/components/empty-state";

/**
 * HeroUI Pro's EmptyState: an icon, a title, one line on why, and the action
 * that fills the list. Every operator list that can be empty says so this way.
 */
const meta = {
  title: "Pro/EmptyState",
  component: EmptyState,
} satisfies Meta;

// A compound component whose children ARE the story, so these stories take no
// args and say so (the Card story uses the same idiom).
export default meta;
type Story = StoryObj;

/** Today with no arrivals: says what would be here, offers the walk in. */
export const NoArrivals: Story = {
  render: () => (
    <div className="max-w-form">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <CalendarCheck aria-hidden />
          </EmptyState.Media>
          <EmptyState.Title>No arrivals today</EmptyState.Title>
          <EmptyState.Description>Bookings that start today show here, ready to check in.</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button>New walk in</Button>
        </EmptyState.Content>
      </EmptyState>
    </div>
  ),
};

/** Setup not finished: the empty list points at the step that fills it. */
export const NoRooms: Story = {
  render: () => (
    <div className="max-w-form">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <BedDouble aria-hidden />
          </EmptyState.Media>
          <EmptyState.Title>No rooms yet</EmptyState.Title>
          <EmptyState.Description>Add your room types and rooms, and the room board fills in.</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button>Add rooms</Button>
        </EmptyState.Content>
      </EmptyState>
    </div>
  ),
};
