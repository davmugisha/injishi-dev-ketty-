import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "../src/components/button";
import { COPY } from "./copy";

/**
 * The one button (ADR-036 call 1). Variant and size names come from
 * `@injishi/ui-contract`, so these stories list the contract's names and
 * nothing else: the deprecated aliases (`solid`, `accent`, `default`, `xs`,
 * `tab`, `icon-xs`, `icon-lg`) are left out on purpose, because a story is an
 * endorsement.
 *
 * `Pending` is the newest of them. The API normalisation list the 2026-09-11
 * audit opened had "Button exposes no pending state" on it; it does now, and
 * the story is where you check that a working button still reads as a button.
 */
const meta = {
  title: "Primitives/Button",
  component: Button,
  args: { children: COPY.continue.en },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger", "outline-light", "inverse", "link"],
    },
    size: { control: "select", options: ["sm", "md", "lg", "icon", "icon-sm"] },
    shape: { control: "inline-radio", options: ["pill", "rounded", "square"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The five core variants every platform implements. */
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary">Primary</Button>
      <Button {...args} variant="secondary">Secondary</Button>
      <Button {...args} variant="outline">Outline</Button>
      <Button {...args} variant="ghost">Ghost</Button>
      <Button {...args} variant="danger">Danger</Button>
      <Button {...args} variant="link">Link</Button>
    </div>
  ),
};

/**
 * The two web extensions that sit on photography or a dark band. Both are
 * FIXED white and never follow the theme, so they are shown on `bg-ink`.
 */
export const OnDarkGround: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-ink p-inset">
      <Button {...args} variant="inverse">Inverse</Button>
      <Button {...args} variant="outline-light">Outline light</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">Small</Button>
      <Button {...args} size="md">Medium</Button>
      <Button {...args} size="lg">Large</Button>
      <Button {...args} size="icon" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon-sm" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
};

/** Pill is the default (ADR-036 call 5). */
export const Shapes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} shape="pill">Pill</Button>
      <Button {...args} shape="rounded">Rounded</Button>
      <Button {...args} shape="square">Square</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>
        {COPY.continueToPay.en}
        <ArrowRight />
      </Button>
      <Button {...args} variant="danger">
        <Trash2 />
        Delete
      </Button>
    </div>
  ),
};

/**
 * Working, not disabled. The shimmer is the same "this is arriving" the
 * `Skeleton` uses; the label stays readable and is worded for the wait, which
 * is the caller's job. Compare with `Disabled` below: that one is a refusal,
 * this one is a promise. Turn on reduced motion in the toolbar and the sweep
 * gives way to a dim and a progress cursor — the state stays visible.
 */
export const Pending: Story = {
  args: { pending: true },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary">Sending your code…</Button>
      <Button {...args} variant="secondary">Confirming your booking…</Button>
      <Button {...args} variant="outline">Checking…</Button>
      <Button {...args} variant="danger">Suspending…</Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary">Primary</Button>
      <Button {...args} variant="outline">Outline</Button>
      <Button {...args} variant="danger">Danger</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  args: { fullWidth: true, children: COPY.confirmAndPay.en },
  decorators: [(Story) => <div className="max-w-form"><Story /></div>],
};

/** A link wearing the button: keeps middle-click, the context menu and the href preview. */
export const AsChild: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#as-child">{COPY.continue.en}</a>
    </Button>
  ),
};

/**
 * Kinyarwanda beside English, in a `max-w-tile` column. The label must stay
 * whole: ui-rules.md forbids truncating to fit.
 */
export const LongContent: Story = {
  render: (args) => (
    <div className="flex max-w-tile flex-col items-start gap-3">
      <Button {...args}>{COPY.activate.en}</Button>
      <Button {...args}>{COPY.activate.rw}</Button>
      <Button {...args} variant="secondary">{COPY.google.rw}</Button>
    </div>
  ),
};
