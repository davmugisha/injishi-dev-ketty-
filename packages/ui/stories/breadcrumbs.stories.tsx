import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumbs } from "../src/components/breadcrumbs";
import { NAV } from "./copy";

/**
 * The trail above a record (ADR-044, D-e 4), in every app. Records only: a top
 * level screen and a lens tab do not get one, because the nav already says
 * where you are.
 *
 * A crumb with an `href` is a link (the caller passes `linkAs={Link}` in a
 * Next app); one without is a label, such as a section heading that opens
 * nothing. The last crumb is the current page whatever it was given.
 */
const meta = {
  title: "Primitives/Breadcrumbs",
  component: Breadcrumbs,
  args: {
    trail: [
      { label: "Home", href: "#home" },
      { label: "Guides", href: "#guides" },
      { label: "Getting around Kigali" },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The marketplace's guide page. */
export const Default: Story = {};

/**
 * The operator app's record: a section that is only a label, the leaf that
 * lists the records, and the record itself.
 */
export const OperatorRecord: Story = {
  args: {
    trail: [
      { label: "Front desk" },
      { label: NAV.reservations.en, href: "#reservations" },
      { label: "INJ-4821" },
    ],
  },
};

/** One crumb: the page alone, as on Support. */
export const Single: Story = {
  args: { trail: [{ label: "Support" }] },
};

/**
 * Kinyarwanda in a `max-w-tile` column with a long record name. The trail
 * wraps between crumbs; the current page truncates only inside its own crumb.
 */
export const LongContent: Story = {
  args: {
    trail: [
      { label: NAV.today.rw },
      { label: NAV.reservations.rw, href: "#reservations" },
      { label: "Lake Kivu Lodge (demo) · Deluxe lake-view room · INJ-4821" },
    ],
    className: "max-w-tile",
  },
};
