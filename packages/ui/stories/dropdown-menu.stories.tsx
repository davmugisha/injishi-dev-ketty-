import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogOut, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "../src/components/avatar";
import { Button } from "../src/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu";
import { ACCOUNT, NAV } from "./copy";

/**
 * A list of actions anchored to a trigger, on Radix: the web account menu and
 * the operator app's workspace and property switchers. Arrow keys move through
 * it, typing jumps to a label, Escape closes it and returns focus. Like
 * `Popover`, it portals into a `NativeDialog` when it is opened inside one.
 *
 * Each story but `Closed` opens on load (`defaultOpen`); on the docs page each
 * renders in its own frame.
 */
const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenu,
  parameters: { docs: { story: { inline: false, iframeHeight: 480 } } },
  decorators: [(Story) => <div className="flex justify-end pr-24"><Story /></div>],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function AccountTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label="Account menu for Solange Uwera"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            SU
          </AvatarFallback>
        </Avatar>
      </button>
    </DropdownMenuTrigger>
  );
}

/** The resting state: the account avatar alone. */
export const Closed: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <AccountTrigger />
      <DropdownMenuContent align="end" className="w-60 border border-border">
        <DropdownMenuItem>{NAV.trips.en}</DropdownMenuItem>
        <DropdownMenuItem>{ACCOUNT.signOut.en}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/** The web account menu: who you are, where to go, and the way out. */
export const AccountMenu: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <DropdownMenu {...args}>
      <AccountTrigger />
      <DropdownMenuContent align="end" className="w-60 border border-border">
        <DropdownMenuLabel className="flex flex-col">
          <span>Solange Uwera</span>
          <span className="text-xs font-normal text-muted-foreground">solange@demo.injishi.com</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>{NAV.trips.en}</DropdownMenuItem>
          <DropdownMenuItem>{NAV.saved.en}</DropdownMenuItem>
          <DropdownMenuItem>{NAV.inbox.en}</DropdownMenuItem>
          <DropdownMenuItem disabled>{NAV.account.en}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="size-4" />
          {ACCOUNT.signOut.en}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * The workspace switcher: one choice among several (radio items, the chosen
 * one ticked), a submenu, and an action under a rule.
 */
export const Switcher: Story = {
  args: { defaultOpen: true },
  render: function Render(args) {
    const [workspace, setWorkspace] = useState("personal");
    return (
      <DropdownMenu {...args}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">{ACCOUNT.switchTitle.en}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 border border-border">
          <DropdownMenuLabel>{ACCOUNT.switchTitle.en}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={workspace} onValueChange={setWorkspace}>
            <DropdownMenuRadioItem value="personal">{ACCOUNT.personal.en}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="business">Amahoro Hospitality Group</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="broker">{ACCOUNT.broker.en}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Properties</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="border border-border">
              <DropdownMenuItem>Lake Kivu Lodge (demo)</DropdownMenuItem>
              <DropdownMenuItem>Amahoro Hotel (demo)</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Plus className="size-4" />
            {ACCOUNT.create.en}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

/** Toggles that keep the menu's place: checkbox items. */
export const Checkboxes: Story = {
  args: { defaultOpen: true },
  render: function Render(args) {
    const [shown, setShown] = useState({ arrivals: true, departures: true, inHouse: false });
    return (
      <DropdownMenu {...args}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Show</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border border-border">
          <DropdownMenuCheckboxItem
            checked={shown.arrivals}
            onCheckedChange={(arrivals) => setShown((s) => ({ ...s, arrivals }))}
          >
            Arrivals
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={shown.departures}
            onCheckedChange={(departures) => setShown((s) => ({ ...s, departures }))}
          >
            Departures
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={shown.inHouse}
            onCheckedChange={(inHouse) => setShown((s) => ({ ...s, inHouse }))}
          >
            In house
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

/** Kinyarwanda: the long create action wraps inside the menu's width rather than widening it. */
export const LongContent: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{ACCOUNT.switchTitle.rw}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border border-border">
        <DropdownMenuLabel>{ACCOUNT.switchTitle.rw}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value="personal">
          <DropdownMenuRadioItem value="personal">{ACCOUNT.personal.rw}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="business">{ACCOUNT.business.rw}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="broker">{ACCOUNT.broker.rw}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="size-4 shrink-0" />
          {ACCOUNT.create.rw}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LogOut className="size-4 shrink-0" />
          {ACCOUNT.signOut.rw}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
