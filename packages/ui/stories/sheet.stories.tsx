import type { Meta, StoryObj } from "@storybook/react-vite";
import { Menu } from "lucide-react";
import { Button } from "../src/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../src/components/sheet";
import { ACCOUNT, NAV } from "./copy";

/**
 * A panel that slides in from an edge: the marketplace's phone navigation.
 * Built on the Radix dialog, so it traps focus, closes on Escape and on the
 * scrim, and hands focus back. It travels in over `travel` on the `settle`
 * curve and leaves faster, on `leave` (ADR-046). `left` by default.
 *
 * Each story but `Closed` opens on load; on the docs page each renders in its
 * own frame.
 */
const meta = {
  title: "Overlays/Sheet",
  component: Sheet,
  parameters: { docs: { story: { inline: false, iframeHeight: 560 } } },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const LINKS = [NAV.explore, NAV.saved, NAV.trips, NAV.inbox, NAV.account] as const;

function NavBody({ lang }: { lang: "en" | "rw" }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>Injishi</SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>
      </SheetHeader>
      <nav className="flex flex-col px-6">
        {LINKS.map((link) => (
          <SheetClose key={link.en} asChild>
            <a
              href={`#${link.en.toLowerCase()}`}
              className="border-b border-border py-3 text-lg font-semibold last:border-b-0"
            >
              {link[lang]}
            </a>
          </SheetClose>
        ))}
      </nav>
      <SheetFooter>
        <Button variant="outline" fullWidth>{ACCOUNT.signOut[lang]}</Button>
      </SheetFooter>
    </>
  );
}

/** The resting state: the menu button alone. */
export const Closed: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Open the menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <NavBody lang="en" />
      </SheetContent>
    </Sheet>
  ),
};

/** The phone navigation, from the left. */
export const Left: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Sheet {...args}>
      <SheetContent>
        <NavBody lang="en" />
      </SheetContent>
    </Sheet>
  ),
};

export const Right: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Sheet {...args}>
      <SheetContent side="right">
        <NavBody lang="en" />
      </SheetContent>
    </Sheet>
  ),
};

/** From the bottom, sized by its content. */
export const Bottom: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Sheet {...args}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{ACCOUNT.signOutTitle.en}</SheetTitle>
          <SheetDescription>{ACCOUNT.signOutHint.en}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="pt-0 sm:flex-row">
          <SheetClose asChild>
            <Button variant="outline">{ACCOUNT.signOutCancel.en}</Button>
          </SheetClose>
          <Button variant="danger">{ACCOUNT.signOutConfirm.en}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Kinyarwanda labels in the drawer: each link stays on one line at phone width. */
export const LongContent: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Sheet {...args}>
      <SheetContent>
        <NavBody lang="rw" />
      </SheetContent>
    </Sheet>
  ),
};
