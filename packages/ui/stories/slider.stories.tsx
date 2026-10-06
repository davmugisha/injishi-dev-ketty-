import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "../src/components/slider";
import { SEARCH } from "./copy";

/**
 * A value, or a range, along a track. The explore price filter is the caller:
 * two thumbs over `0` to the catalogue's ceiling, redrawn as they move
 * (`onValueChange`) and committed to the URL only when they are let go
 * (`onValueCommit`), so one drag is one history entry rather than sixty.
 *
 * One thumb per entry in `value` (or `defaultValue`). The values are always an
 * array, one thumb or two.
 */
const meta = {
  title: "Primitives/Slider",
  component: Slider,
  args: { min: 0, max: 100, step: 1, defaultValue: [40], "aria-label": "Volume" },
  decorators: [(Story) => <div className="max-w-form px-1"><Story /></div>],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Two thumbs: the price filter's range, in francs. */
export const Range: Story = {
  args: {
    min: 0,
    max: 500_000,
    step: 5_000,
    defaultValue: [100_000, 250_000],
    "aria-label": "Price range",
  },
};

/** Thumbs at both ends: "Any price", the filter's resting state. */
export const FullRange: Story = {
  args: {
    min: 0,
    max: 500_000,
    step: 5_000,
    defaultValue: [0, 500_000],
    "aria-label": "Price range",
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: [100_000, 250_000], min: 0, max: 500_000, step: 5_000 },
};

const rwf = (n: number) => `RWF ${n.toLocaleString("en-RW")}`;

/**
 * The live line follows the drag; the committed line moves only on release,
 * or on each key press. That gap is the whole reason `onValueCommit` exists.
 * The count is how many times the URL would have been written: once per
 * gesture that changed something, never for a press that moved nothing.
 */
export const LiveAndCommitted: Story = {
  render: function Render(args) {
    const [live, setLive] = useState<number[]>([100_000, 250_000]);
    const [committed, setCommitted] = useState<number[]>([100_000, 250_000]);
    const [writes, setWrites] = useState(0);
    return (
      <div className="flex flex-col gap-4">
        <Slider
          {...args}
          min={0}
          max={500_000}
          step={5_000}
          value={live}
          onValueChange={setLive}
          onValueCommit={(next) => {
            setCommitted(next);
            setWrites((n) => n + 1);
          }}
          aria-label="Price range"
        />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Showing</dt>
          <dd className="font-semibold">{live.map(rwf).join(" – ")}</dd>
          <dt className="text-muted-foreground">In the URL</dt>
          <dd className="font-semibold">{committed.map(rwf).join(" – ")}</dd>
          <dt className="text-muted-foreground">URL writes</dt>
          <dd className="font-semibold" data-testid="writes">{writes}</dd>
        </dl>
      </div>
    );
  },
};

/**
 * Its label sits outside it, as on the explore rail. The longer Kinyarwanda
 * label wraps above a track that keeps its full width.
 */
export const LongContent: Story = {
  render: (args) => (
    <div className="flex max-w-tile flex-col gap-6">
      {(["en", "rw"] as const).map((lang) => (
        <div key={lang} className="flex flex-col gap-3">
          <p id={`story-price-${lang}`} className="flex justify-between gap-3 text-sm">
            <span className="font-semibold">{SEARCH.priceBand[lang]}</span>
            <span className="text-muted-foreground">{SEARCH.bandAny[lang]}</span>
          </p>
          <Slider
            {...args}
            min={0}
            max={500_000}
            step={5_000}
            defaultValue={[0, 500_000]}
            aria-label={undefined}
            aria-labelledby={`story-price-${lang}`}
          />
        </div>
      ))}
    </div>
  ),
};
