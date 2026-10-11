import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/components/button";
import { Label } from "../src/components/label";
import { NativeDialog } from "../src/components/native-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select";
import { Textarea } from "../src/components/textarea";

/**
 * A modal on the platform's own `<dialog>` and `showModal()` (ADR-040 call 3):
 * the top layer, the browser's focus trap and Escape, and `::backdrop` for the
 * scrim. The admin console's confirmations use it.
 *
 * It is controlled, always: `open` in, `onClose` out. `dismissible={false}`
 * while its work is in flight refuses Escape and a press on the backdrop, so a
 * write cannot be dismissed half way.
 *
 * It is also the portal container for `Select`, `Popover` and `DropdownMenu`
 * opened inside it; see `WithSelect`.
 *
 * The admin console is English only, so these stories are too.
 */
const meta = {
  title: "Overlays/NativeDialog",
  component: NativeDialog,
  args: { open: true, ariaLabel: "Retire this venue", onClose: () => {}, children: null },
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof NativeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The training console's "Retire this venue", open on load. Close it and the button brings it back. */
export const Open: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>Retire a venue</Button>
        <NativeDialog {...args} open={open} onClose={() => setOpen(false)}>
          <div className="p-7">
            <h2 className="text-2xl font-bold">Retire Kigali Convention Centre?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Retiring is one way. It leaves the session form&apos;s venue list at once, and any
              draft session there can no longer be published until it is moved. Sessions already
              published there still run, and certificates that name it keep its name.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="danger" className="grow">Retire the venue</Button>
              <Button variant="outline" className="grow" onClick={() => setOpen(false)}>
                Keep it
              </Button>
            </div>
          </div>
        </NativeDialog>
      </>
    );
  },
};

/**
 * Working: the write has been sent. Escape and the backdrop are refused until
 * it answers, and the buttons say so.
 */
export const Pending: Story = {
  render: (args) => (
    <NativeDialog {...args} dismissible={false}>
      <div className="p-7">
        <h2 className="text-2xl font-bold">Retire Kigali Convention Centre?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Retiring is one way. Sessions already published there still run.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="danger" className="grow" pending>Waiting for the platform…</Button>
          <Button variant="outline" className="grow" disabled>Keep it</Button>
        </div>
      </div>
    </NativeDialog>
  ),
};

/**
 * A wider panel (`max-w-narrow`) with a form, and a refusal under the field.
 * The `Select` inside opens INTO the dialog rather than behind its scrim.
 */
export const WithSelect: Story = {
  args: { ariaLabel: "Suspend this business", className: "max-w-narrow" },
  render: (args) => (
    <NativeDialog {...args}>
      <form className="flex flex-col gap-4 p-7" onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-2xl font-bold">Suspend Lake Kivu Lodge (demo)?</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="story-ground">Ground</Label>
          <Select defaultValue="documents">
            <SelectTrigger id="story-ground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="documents">Documents expired</SelectItem>
              <SelectItem value="complaints">Repeated guest complaints</SelectItem>
              <SelectItem value="tax">RRA filing overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="story-reason">Reason, for the audit trail</Label>
          <Textarea id="story-reason" aria-invalid aria-describedby="story-reason-error" />
          <p id="story-reason-error" className="text-sm text-danger">
            Nothing was sent: a suspension needs a reason of 4 to 500 characters, written for the
            audit trail.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="danger" className="grow">Suspend the business</Button>
          <Button type="button" variant="outline" className="grow">Keep it open</Button>
        </div>
      </form>
    </NativeDialog>
  ),
};
