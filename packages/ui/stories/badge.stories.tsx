import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/components/badge";
import { STATUS, type StatusKey } from "./copy";

/**
 * The standalone pill, on HeroUI's `Chip` (not HeroUI's `Badge`, which is the
 * count dot pinned to an avatar).
 */
const meta = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Verified" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "subtle", "outline", "ghost", "accent", "success", "warning", "danger", "light", "glass"],
    },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The variants that follow the theme. */
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} variant="default">Default</Badge>
      <Badge {...args} variant="subtle">Subtle</Badge>
      <Badge {...args} variant="outline">Outline</Badge>
      <Badge {...args} variant="accent">Accent</Badge>
      <Badge {...args} variant="success">Success</Badge>
      <Badge {...args} variant="warning">Warning</Badge>
      <Badge {...args} variant="danger">Danger</Badge>
    </div>
  ),
};

/**
 * `light` and `glass` sit on photography, so they are FIXED and never follow
 * the theme. Shown on `bg-ink`, the nearest thing to a photograph a story has.
 */
export const OnPhotography: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2 rounded-card bg-ink p-inset">
      <Badge {...args} variant="light">Superhost</Badge>
      <Badge {...args} variant="glass">Superhost</Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} size="sm">Small</Badge>
      <Badge {...args} size="md">Medium</Badge>
      <Badge {...args} size="lg">Large</Badge>
    </div>
  ),
};

/**
 * The status table ui-tokens.md owns (§ Status semantics), rendered with the
 * variants that exist today. Every badge carries its text; colour never
 * carries meaning alone.
 *
 * Two gaps show here on purpose. `confirmed` and `held` want a "primary"
 * intent, rendered as `accent`; and there is no `info` variant at all. Both
 * are change 5 in the audit, which moves this table into one shared map that
 * web and mobile read.
 */
const STATUS_VARIANT: Record<StatusKey, "default" | "accent" | "success" | "warning" | "danger"> = {
  "booking.pending_approval": "warning",
  "booking.confirmed": "accent",
  "booking.declined": "danger",
  "booking.cancelled": "danger",
  "booking.no_show": "warning",
  "lease.draft": "default",
  "lease.pending_signature": "warning",
  "lease.active": "success",
  "lease.ending": "warning",
  "lease.ended": "default",
  "rent.paid": "success",
  "rent.due": "default",
  "rent.overdue": "danger",
  "identity.verified": "success",
  "identity.unverified": "default",
};

export const Status: Story = {
  render: (args) => (
    <table className="text-sm">
      <thead>
        <tr className="text-left text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-6">State</th>
          <th className="py-2 pr-6">English</th>
          <th className="py-2">Kinyarwanda</th>
        </tr>
      </thead>
      <tbody>
        {(Object.keys(STATUS) as StatusKey[]).map((key) => (
          <tr key={key} className="border-t border-border">
            <td className="py-2 pr-6 text-muted-foreground">{key}</td>
            <td className="py-2 pr-6">
              <Badge {...args} variant={STATUS_VARIANT[key]}>{STATUS[key].en}</Badge>
            </td>
            <td className="py-2">
              <Badge {...args} variant={STATUS_VARIANT[key]}>{STATUS[key].rw}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
