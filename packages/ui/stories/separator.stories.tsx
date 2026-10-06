import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../src/components/separator";

/**
 * A rule between sections, on HeroUI (React Aria). It takes no colour: the
 * hairline is the `separator` role in both themes. React Aria decides its ARIA
 * role from `orientation`.
 */
const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The booking summary's rule between the stay and the price. */
export const Horizontal: Story = {
  render: (args) => (
    <div className="flex max-w-form flex-col gap-4 rounded-card border border-border p-inset text-sm">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Lake Kivu Lodge (demo)</p>
        <p className="text-muted-foreground">2 nights · 14–16 Oct · 2 adults</p>
      </div>
      <Separator {...args} />
      <dl className="grid grid-cols-[1fr_auto] gap-y-2">
        <dt className="text-muted-foreground">RWF 120,000 × 2 nights</dt>
        <dd className="text-right">RWF 240,000</dd>
        <dt className="text-muted-foreground">VAT (18%)</dt>
        <dd className="text-right">RWF 43,200</dd>
      </dl>
      <Separator {...args} />
      <p className="flex justify-between font-semibold">
        <span>Total</span>
        <span>RWF 283,200</span>
      </p>
    </div>
  ),
};

/** Between inline facts. A vertical rule needs a height from its row. */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Rubavu</span>
      <Separator {...args} />
      <span>12 rooms</span>
      <Separator {...args} />
      <span>Instant booking</span>
    </div>
  ),
};

/**
 * On the fixed grounds. On `canvas` the hairline reads. On `ink` in the light
 * theme it all but disappears: the `separator` role follows the theme, and the
 * pin that re-themes a fixed ground ships only in `injishi-tokens.css`, which
 * no app loads (`.storybook/preview.tsx` says why). This story is where that
 * fix gets reviewed, not a pass.
 */
export const OnFixedGrounds: Story = {
  render: (args) => (
    <div className="grid max-w-wide gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-card bg-canvas p-inset text-sm text-ink">
        <span>Check-in from 14:00</span>
        <Separator {...args} />
        <span>Check-out by 11:00</span>
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-ink p-inset text-sm text-white">
        <span>Check-in from 14:00</span>
        <Separator {...args} />
        <span>Check-out by 11:00</span>
      </div>
    </div>
  ),
};
