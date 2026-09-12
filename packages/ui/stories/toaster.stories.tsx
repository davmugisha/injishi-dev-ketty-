import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../src/components/button";
import { Toaster, toastDwellMs, type Toast } from "../src/components/toaster";

/**
 * The product's one toast. It couples to no store: the app owns the queue and
 * the timing, and passes a list (ADR-040 call 3).
 *
 * Three things worth looking at here rather than in a screen:
 *
 *  - **Tone is an icon, not just a colour.** `ui-rules.md` § Accessibility:
 *    never colour alone for meaning. Each tone has its own shape, and the words
 *    still carry the message with no icon at all.
 *  - **It arrives and it leaves.** 240ms in, 180ms out — shorter going, because
 *    by then the person has moved on.
 *  - **How long it stays follows the words.** `toastDwellMs` is reading time,
 *    not a constant: the console's failure sentences run past thirty words, and
 *    a fixed 2.6s timer took them away mid-sentence.
 *
 * The pill is a fixed ink ground in both themes, so switching the Storybook
 * theme should not change it — only the page behind it.
 */
const meta = {
  title: "Primitives/Toaster",
  component: Toaster,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE: Toast[] = [
  { id: "1", message: "Room 12 is ready for the next guest.", tone: "success" },
  {
    id: "2",
    message:
      "Couldn't confirm the suspension: the platform didn't answer. Don't assume it happened — reload to see where it stands.",
    tone: "warning",
  },
  { id: "3", message: "This account can't suspend a business, so nothing changed.", tone: "danger" },
  { id: "4", message: "Scoped to Gasabo.", tone: "neutral" },
];

/** All four tones at once, which is not a real screen but is the fastest read. */
export const Tones: Story = {
  args: { toasts: SAMPLE },
  decorators: [(Story) => <div className="min-h-96"><Story /></div>],
};

/**
 * One at a time, on its own timer, the way an app should drive it. Press a
 * button and watch it arrive, sit for as long as its words take to read, and
 * leave.
 */
export const Live: Story = {
  args: { toasts: [] },
  render: () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const raise = (message: string, tone: Toast["tone"]) => {
      const id = `${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        toastDwellMs(message, tone),
      );
    };

    return (
      <div className="min-h-96 p-inset">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => raise("Saved.", "success")}>Short success</Button>
          <Button
            variant="outline"
            onClick={() =>
              raise(
                "Ended 3 sessions. Each is refused from its next request, and your reason is on the audit trail.",
                "success",
              )
            }
          >
            Long success
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              raise(
                "Nothing was sent: a suspension needs a reason of 4 to 500 characters, written for the audit trail.",
                "danger",
              )
            }
          >
            Refusal
          </Button>
        </div>
        <Toaster toasts={toasts} />
      </div>
    );
  },
};

/** A long message at phone width: it wraps inside `max-w-form`, never truncates. */
export const LongContent: Story = {
  args: {
    toasts: [
      {
        id: "1",
        message:
          "The platform answered, but this console couldn't read the reply, so the suspension may well have gone through. Reload to check before trying again.",
        tone: "warning",
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="min-h-96 max-w-tile border border-border">
        <Story />
      </div>
    ),
  ],
};
