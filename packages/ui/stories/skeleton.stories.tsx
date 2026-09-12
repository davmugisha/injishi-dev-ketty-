import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "../src/components/skeleton";

/**
 * The loading placeholder, and the only loading vocabulary the product has:
 * there is no spinner anywhere in the three web apps, by design. Shimmer by
 * default; `pulse` or `none` where a screen wants the quieter one.
 */
const meta = {
  title: "Primitives/Skeleton",
  component: Skeleton,
  args: { className: "h-4 w-48" },
  argTypes: {
    animationType: { control: "inline-radio", options: ["shimmer", "pulse", "none"] },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AnimationTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-48" animationType="shimmer" />
      <Skeleton className="h-4 w-48" animationType="pulse" />
      <Skeleton className="h-4 w-48" animationType="none" />
    </div>
  ),
};

/** A listing card while its data arrives: photo, title, two facts, a price. */
export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex max-w-tile flex-col gap-3">
      <Skeleton className="aspect-[4/3] w-full rounded-card" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  ),
};
