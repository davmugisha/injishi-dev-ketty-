import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "../src/components/progress";

/**
 * A meter on HeroUI's `ProgressBar` (React Aria), drawn with our own track and
 * fill. It needs a name: the type refuses a call with neither `aria-label` nor
 * `aria-labelledby`, because a progress bar with no name is announced as a
 * percentage of nothing.
 *
 * The fill is separate from the track (`indicatorClassName`), so a meter can
 * wear the chart roles or a status role.
 */
const meta = {
  title: "Primitives/Progress",
  component: Progress,
  decorators: [(Story) => <div className="max-w-form"><Story /></div>],
} satisfies Meta;

// `Progress` takes its name as a union (`aria-label` OR `aria-labelledby`, never
// neither), which Storybook's arg inference cannot type, so these stories take
// no args.
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <Progress value={64} aria-label="Profile complete" />,
};

/** The oversight district overview's occupancy column, on the chart roles. */
export const Occupancy: Story = {
  render: () => (
    <ul className="flex flex-col gap-3 text-sm">
      {[
        { biz: "Lake Kivu Lodge (demo)", occ: 78 },
        { biz: "Amahoro Hotel (demo)", occ: 57 },
        { biz: "Nyungwe Forest Camp (demo)", occ: 31 },
        { biz: "Kigali Heights Suites (demo)", occ: 4 },
      ].map((row) => (
        <li key={row.biz} className="grid grid-cols-[1fr_minmax(0,10rem)_2.5rem] items-center gap-3">
          <span className="truncate">{row.biz}</span>
          <Progress
            value={row.occ}
            aria-label={`${row.biz} occupancy`}
            className="h-1.5 bg-chart-track"
            indicatorClassName="bg-chart-1"
          />
          <span className="text-right text-xs tabular-nums text-muted-foreground">{row.occ}%</span>
        </li>
      ))}
    </ul>
  ),
};

/** Where the fill IS a verdict, it takes a status role, and the words still say it. */
export const Status: Story = {
  render: () => (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <span id="story-docs" className="flex justify-between">
          <span>Documents verified</span>
          <span className="text-muted-foreground">5 of 5</span>
        </span>
        <Progress value={100} aria-labelledby="story-docs" indicatorClassName="bg-success" />
      </div>
      <div className="flex flex-col gap-2">
        <span id="story-rent" className="flex justify-between">
          <span>Rent collected this month</span>
          <span className="text-muted-foreground">2 of 9 units, 7 overdue</span>
        </span>
        <Progress value={22} aria-labelledby="story-rent" indicatorClassName="bg-danger" />
      </div>
    </div>
  ),
};

/** The ends, and past them: 120 fills the track and stops; -10 and no value are empty. */
export const Bounds: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Progress value={0} aria-label="Nothing yet" />
      <Progress value={100} aria-label="Complete" />
      <Progress value={120} aria-label="Over, clamped to full" />
      <Progress value={-10} aria-label="Under, clamped to empty" />
      <Progress value={null} aria-label="No value" />
    </div>
  ),
};
