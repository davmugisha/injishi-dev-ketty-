import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarFallback, AvatarImage } from "../src/components/avatar";
// A photograph `apps/web` already ships, read in place rather than copied
// (the same rule `main.ts` follows for the fonts).
import photo from "../../../apps/web/public/assets/akagera-np-01-480.webp";

/**
 * A person or a workspace, as a disc. `AvatarImage` renders only once its
 * picture has loaded; until then, and for good if it fails, `AvatarFallback`
 * stands in. So one `Avatar` covers the initials path and the broken-photo
 * path without a branch at the call site — the account menu relies on exactly
 * that.
 *
 * `size-10` and `rounded-full` by default; a caller resizes it with a `size-*`
 * class and paints the fallback with a role.
 */
const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initials on the default fallback ground. */
export const Initials: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>SU</AvatarFallback>
    </Avatar>
  ),
};

/**
 * The web account menu's trigger: a photo when the account has one, the
 * initials on `bg-primary` when it does not.
 */
export const AccountMenu: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <Avatar {...args} className="size-9">
        <AvatarImage src={photo} alt="" />
        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
          SU
        </AvatarFallback>
      </Avatar>
      <Avatar {...args} className="size-9">
        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
          SU
        </AvatarFallback>
      </Avatar>
    </div>
  ),
};

/**
 * A picture that never arrives. The image removes itself and the initials take
 * its place: no broken-image glyph, no empty disc.
 */
export const BrokenPhoto: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="/assets/does-not-exist.webp" alt="" />
      <AvatarFallback>YR</AvatarFallback>
    </Avatar>
  ),
};

/**
 * The operator app's workspace switcher marks, which hide themselves from a
 * screen reader because the name they abbreviate sits beside them. Painted
 * here with roles; the app paints each with its workspace's own swatch.
 */
export const WorkspaceMarks: Story = {
  render: (args) => (
    <ul className="flex flex-col gap-3">
      {[
        { mark: "AH", name: "Amahoro Hospitality Group", tone: "bg-primary text-primary-foreground" },
        { mark: "LK", name: "Lake Kivu Lodge (demo)", tone: "bg-success text-success-foreground" },
        { mark: "KR", name: "Kigali Residences (demo)", tone: "bg-warning text-warning-foreground" },
      ].map((row) => (
        <li key={row.mark} className="flex items-center gap-3 text-sm font-medium">
          <Avatar {...args} aria-hidden className="size-9 shrink-0">
            <AvatarFallback className={`text-xs font-bold ${row.tone}`}>{row.mark}</AvatarFallback>
          </Avatar>
          {row.name}
        </li>
      ))}
    </ul>
  ),
};

/** Sizes are classes, not a prop: the menu row's 28px, the trigger's 36px, the default 40px and a profile's 64px. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      {(["size-7", "size-9", "size-10", "size-16"] as const).map((size) => (
        <Avatar key={size} {...args} className={size}>
          <AvatarImage src={photo} alt="" />
          <AvatarFallback>SU</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
