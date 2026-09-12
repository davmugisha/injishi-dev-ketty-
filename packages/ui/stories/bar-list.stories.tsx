import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/components/badge";
import { BarList, type BarListRow } from "../src/components/bar-list";

/**
 * The one bar chart. A shared scale down every row, `chart-1` over a
 * `chart-track` of the same hue, and the value written at every bar, so the
 * list is its own table view. Sample figures only.
 */
const DISTRICTS: BarListRow[] = [
  { key: "gasabo", label: "Gasabo", value: 42, display: "42" },
  { key: "kicukiro", label: "Kicukiro", value: 27, display: "27" },
  { key: "nyarugenge", label: "Nyarugenge", value: 19, display: "19" },
  { key: "musanze", label: "Musanze", value: 6, display: "6" },
  { key: "rubavu", label: "Rubavu", value: 1, display: "1" },
  { key: "nyamasheke", label: "Nyamasheke", value: 0, display: "0" },
];

const meta = {
  title: "Charts/BarList",
  component: BarList,
  args: { rows: DISTRICTS, "aria-label": "Businesses per district", className: "max-w-read" },
} satisfies Meta<typeof BarList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ranked by value. Rubavu's one business is a 2px sliver, not nothing. */
export const Default: Story = {};

/**
 * A filter set four rows aside. Their bars go grey and keep their length;
 * their names and counts stay readable.
 */
export const Emphasis: Story = {
  args: {
    rows: DISTRICTS.map((row) => ({ ...row, muted: row.key !== "kicukiro" && row.key !== "gasabo" })),
  },
};

/** A trailing note per row: the month-on-month change, in words. */
export const WithDetail: Story = {
  args: {
    rows: DISTRICTS.slice(0, 4).map((row, i) => ({
      ...row,
      detail: (
        <Badge variant={i === 2 ? "danger" : "success"}>{i === 2 ? "down 3" : `up ${i + 1}`}</Badge>
      ),
    })),
  },
};

/** Nothing counted yet: every track is empty, and every count says 0. */
export const AllZero: Story = {
  args: { rows: DISTRICTS.map((row) => ({ ...row, value: 0, display: "0" })) },
};
