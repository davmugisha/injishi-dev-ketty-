import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea, ScrollBar } from "../src/components/scroll-area";
import { Separator } from "../src/components/separator";

/**
 * A box that scrolls with a thin scrollbar of its own instead of the
 * platform's, which keeps a long list inside a fixed panel from widening it.
 * The vertical bar is always there; a horizontal one is added as a child.
 *
 * Nothing in the three web apps uses it yet. The stories are the review of it
 * before something does.
 */
const meta = {
  title: "Primitives/ScrollArea",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rwanda's thirty districts, the longest list the product filters by. */
const DISTRICTS = [
  "Bugesera", "Burera", "Gakenke", "Gasabo", "Gatsibo", "Gicumbi", "Gisagara", "Huye",
  "Kamonyi", "Karongi", "Kayonza", "Kicukiro", "Kirehe", "Muhanga", "Musanze", "Ngoma",
  "Ngororero", "Nyabihu", "Nyagatare", "Nyamagabe", "Nyamasheke", "Nyanza", "Nyarugenge",
  "Nyaruguru", "Rubavu", "Ruhango", "Rulindo", "Rusizi", "Rutsiro", "Rwamagana",
];

/** A fixed-height list: the bar sits inside the border, over nothing. */
export const Vertical: Story = {
  render: (args) => (
    <ScrollArea {...args} className="h-72 max-w-tile rounded-card border border-border">
      <div className="p-4">
        <h4 className="mb-3 text-sm font-semibold">Districts</h4>
        {DISTRICTS.map((district, index) => (
          <div key={district}>
            {index > 0 ? <Separator className="my-2" /> : null}
            <p className="text-sm">{district}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

/** A row wider than its box, with the horizontal bar added as a child. */
export const Horizontal: Story = {
  render: (args) => (
    <ScrollArea {...args} className="max-w-form whitespace-nowrap rounded-card border border-border">
      <div className="flex w-max gap-3 p-4">
        {DISTRICTS.slice(0, 12).map((district) => (
          <span
            key={district}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium"
          >
            {district}
          </span>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};

/** Content that fits: no bar is drawn at all. */
export const NothingToScroll: Story = {
  render: (args) => (
    <ScrollArea {...args} className="h-72 max-w-tile rounded-card border border-border">
      <ul className="flex flex-col gap-2 p-4 text-sm">
        {DISTRICTS.slice(0, 4).map((district) => (
          <li key={district}>{district}</li>
        ))}
      </ul>
    </ScrollArea>
  ),
};
