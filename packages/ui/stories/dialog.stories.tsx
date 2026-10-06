import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../src/components/dialog";
import { ACCOUNT, fill } from "./copy";

/**
 * The modal, on Radix. It portals to `body`, dims the page with `bg-ink/60`,
 * traps focus, closes on Escape and on a press outside, and gives focus back to
 * its trigger. `max-w-narrow` by default; the close button is on unless
 * `showCloseButton={false}`.
 *
 * Inside a `NativeDialog`, or anywhere `showModal()` has made `body` inert, use
 * `NativeDialog` instead: a Radix dialog portalled to an inert `body` cannot be
 * pressed.
 *
 * Each story but `Closed` opens on load (`defaultOpen`), and on the docs page
 * each renders in its own frame so the open dialogs do not stack.
 */
const meta = {
  title: "Overlays/Dialog",
  component: Dialog,
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function SignOut({ lang }: { lang: "en" | "rw" }) {
  // A demo persona (`seed-demo.mjs`), never a real account.
  const name = "Solange Uwera";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{ACCOUNT.signOutTitle[lang]}</DialogTitle>
        <DialogDescription>{fill(ACCOUNT.signOutSubtitle[lang], { name })}</DialogDescription>
      </DialogHeader>
      <p className="mt-4 text-sm">{fill(ACCOUNT.signOutScope[lang], { count: 3 })}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {fill(ACCOUNT.signOutSwitchInstead[lang], { name: "Amahoro Hospitality Group" })}
      </p>
      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button variant="outline">{ACCOUNT.signOutCancel[lang]}</Button>
        </DialogClose>
        <Button variant="danger">{ACCOUNT.signOutConfirm[lang]}</Button>
      </DialogFooter>
    </>
  );
}

/** The resting state: only the trigger. Press it to open. */
export const Closed: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">{ACCOUNT.signOut.en}</Button>
      </DialogTrigger>
      <DialogContent>
        <SignOut lang="en" />
      </DialogContent>
    </Dialog>
  ),
};

/** The sign-out confirmation, open. */
export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent>
        <SignOut lang="en" />
      </DialogContent>
    </Dialog>
  ),
};

/**
 * No close button: the question has two answers and both are buttons, so a
 * third way out would only be a way to not answer. Escape still closes it.
 */
export const WithoutCloseButton: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancel INJ-4821?</DialogTitle>
          <DialogDescription>
            The guest&apos;s stay, 14–16 Oct, is cancelled for good. Because the property is
            cancelling, the guest is refunded in full, whatever the booking&apos;s cancellation
            policy says, and both of you are notified.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" size="sm" shape="rounded">Keep the booking</Button>
          </DialogClose>
          <Button variant="danger" size="sm" shape="rounded">Cancel the booking</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** Kinyarwanda: the longer sentences wrap inside `max-w-narrow`, and the footer stacks on a phone. */
export const LongContent: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogContent>
        <SignOut lang="rw" />
      </DialogContent>
    </Dialog>
  ),
};
