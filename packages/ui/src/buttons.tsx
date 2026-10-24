import { Button, Spinner, Tooltip } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import NextLink from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconKey } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The house rule for buttons: every button is OUTLINED (HeroUI v3 `variant="outline"`: transparent with a
 * 1px border) and carries an icon. The one page-level primary action may be solid (`intent="primary"`,
 * HeroUI `variant="primary"`); nothing else is.
 *
 * - `default`: outlined, the everyday button.
 * - `accent`: outlined in the accent colour, the main action inside a dialog, side panel or card (Save).
 * - `primary`: solid accent, at most once per page (the page's main action).
 * - `danger`: outlined with danger text, for Delete, Cancel lease, Void.
 */
export type ButtonIntent = "default" | "accent" | "primary" | "danger";

function variantFor(intent: ButtonIntent) {
  return intent === "primary" ? ("primary" as const) : ("outline" as const);
}

const INTENT_CLASS: Record<ButtonIntent, string | undefined> = {
  default: undefined,
  accent: "border-accent/50 text-accent",
  primary: undefined,
  danger: "border-danger/40 text-danger",
};

type HeroButtonProps = ComponentProps<typeof Button>;

export interface ActionButtonProps
  extends Omit<HeroButtonProps, "variant" | "children" | "isIconOnly" | "className" | "size"> {
  /** A Gravity icon key (`icons` in icon.tsx). Required: buttons always carry an icon. */
  icon: IconKey;
  children: ReactNode;
  intent?: ButtonIntent;
  /** "sm" in cards, toolbars and dialogs' secondary rows; "md" in page headers and dialog footers. */
  size?: "sm" | "md";
  /** "end" for forward moves ("Next", "Continue"). @default "start" */
  iconPlacement?: "start" | "end";
  className?: string;
}

/**
 * An outlined button with an icon and a label. `isPending` swaps the icon for a spinner and blocks
 * presses, keeping the button's width.
 *
 * ```tsx
 * <ActionButton icon="Plus" onPress={openAdd}>Add unit</ActionButton>
 * <ActionButton icon="FileText" intent="primary" onPress={openNew}>New lease</ActionButton>
 * ```
 */
export function ActionButton({
  icon,
  children,
  intent = "default",
  size = "md",
  iconPlacement = "start",
  isPending,
  className,
  ...props
}: ActionButtonProps) {
  const mark = isPending ? (
    <Spinner size="sm" color="current" aria-hidden="true" className="size-4" />
  ) : (
    <Icon name={icon} />
  );
  return (
    <Button
      {...props}
      isPending={isPending}
      size={size}
      variant={variantFor(intent)}
      className={cx(INTENT_CLASS[intent], className)}
    >
      {iconPlacement === "start" ? mark : null}
      {children}
      {iconPlacement === "end" ? mark : null}
    </Button>
  );
}

export interface ActionLinkProps extends Omit<ComponentProps<typeof NextLink>, "className" | "children"> {
  icon: IconKey;
  children: ReactNode;
  intent?: ButtonIntent;
  size?: "sm" | "md";
  className?: string;
}

/** A link that looks like an `ActionButton` (it navigates instead of opening something). */
export function ActionLink({ icon, children, intent = "default", size = "md", className, ...props }: ActionLinkProps) {
  return (
    <NextLink
      {...props}
      className={buttonVariants({ variant: variantFor(intent), size, className: cx(INTENT_CLASS[intent], className) })}
    >
      <Icon name={icon} />
      {children}
    </NextLink>
  );
}

export interface IconActionProps
  extends Omit<HeroButtonProps, "variant" | "children" | "isIconOnly" | "className" | "aria-label" | "size"> {
  icon: IconKey;
  /** What the button does, in a few words ("Send a reminder"). Its accessible name and its tooltip. */
  label: string;
  /**
   * Why it can't be used right now ("Already reminded today"). Disables the button but keeps it
   * focusable and hoverable, so the reason can be read: it shows in the tooltip and the accessible name.
   */
  disabledReason?: string | null;
  intent?: Exclude<ButtonIntent, "primary">;
  size?: "sm" | "md";
  className?: string;
}

/**
 * An icon-only outlined button with a tooltip, for row actions (the "Actions" column: the next step
 * first, then Open, Edit, Delete) and tight toolbars.
 */
export function IconAction({
  icon,
  label,
  disabledReason,
  intent = "default",
  size = "sm",
  isPending,
  onPress,
  className,
  ...props
}: IconActionProps) {
  const blocked = Boolean(disabledReason);
  return (
    <Tooltip delay={400} closeDelay={0}>
      <Button
        {...props}
        isIconOnly
        size={size}
        variant="outline"
        aria-label={blocked ? `${label} (${disabledReason})` : label}
        aria-disabled={blocked || undefined}
        isPending={isPending}
        onPress={blocked ? undefined : onPress}
        className={cx(
          INTENT_CLASS[intent],
          // The theme makes aria-disabled buttons ignore the pointer; keep hover so the reason shows.
          blocked && "pointer-events-auto cursor-not-allowed",
          className,
        )}
      >
        {isPending ? <Spinner size="sm" color="current" aria-hidden="true" className="size-4" /> : <Icon name={icon} />}
      </Button>
      <Tooltip.Content showArrow placement="top">
        {blocked ? (
          <span className="flex flex-col">
            <span className="font-medium">{label}</span>
            <span className="text-muted">{disabledReason}</span>
          </span>
        ) : (
          label
        )}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** A row of `IconAction`s in a table cell or list row, next step first. */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex items-center justify-end gap-1.5", className)}>{children}</div>;
}
