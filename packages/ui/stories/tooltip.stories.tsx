import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heart, LogOut } from "lucide-react";
import { Badge } from "../src/components/badge";
import { Button } from "../src/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../src/components/tooltip";
import { A11Y, ACCOUNT } from "./copy";

/**
 * The hover and focus hint, on HeroUI (React Aria). It opens on keyboard focus
 * as well as on hover, so its trigger must be focusable: a `Button` as the
 * first child, or `TooltipTrigger`, which makes any content a focusable
 * target. A tooltip names or explains; it never carries the only copy of
 * something a person needs, because a touch screen never hovers.
 *
 * `TooltipProvider` is still exported and renders nothing of its own: React
 * Aria's warm-up timer is global.
 *
 * Each story opens its tooltip on load (`defaultOpen`) so it can be reviewed
 * without a pointer; in a screen it waits for hover or focus.
 */
const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  // `children` is required by the type and supplied by every render below.
  args: { delay: 0, defaultOpen: true, children: null },
  decorators: [
    (Story) => (
      <div className="flex min-h-48 items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An icon-only button: the tooltip says what the heart does. */
export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="outline" size="icon" aria-label={A11Y.save.en}>
        <Heart />
      </Button>
      <TooltipContent>{A11Y.save.en}</TooltipContent>
    </Tooltip>
  ),
};

/** Placed below its trigger. The content flips if there is no room. */
export const Bottom: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="outline" size="icon" aria-label={A11Y.save.en}>
        <Heart />
      </Button>
      <TooltipContent placement="bottom">{A11Y.save.en}</TooltipContent>
    </Tooltip>
  ),
};

/**
 * `TooltipTrigger` around something that is not a control, here a status
 * badge, so a keyboard can reach the explanation too.
 */
export const OnNonControl: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger className="rounded-full">
        <Badge variant="success">Verified</Badge>
      </TooltipTrigger>
      <TooltipContent>RRA registration and identity checked on 12 Sep.</TooltipContent>
    </Tooltip>
  ),
};

/** Kinyarwanda, a full sentence: the content wraps rather than running off the page. */
export const LongContent: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" aria-label={ACCOUNT.signOut.rw}>
        <LogOut />
        {ACCOUNT.signOut.rw}
      </Button>
      <TooltipContent className="max-w-tile">{ACCOUNT.signOutHint.rw}</TooltipContent>
    </Tooltip>
  ),
};

/** `isDisabled`: the trigger still works, the hint never opens. */
export const Disabled: Story = {
  args: { isDisabled: true },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="outline" size="icon" aria-label={A11Y.save.en}>
        <Heart />
      </Button>
      <TooltipContent>{A11Y.save.en}</TooltipContent>
    </Tooltip>
  ),
};
