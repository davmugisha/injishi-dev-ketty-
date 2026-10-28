import { Button, Spinner, Tooltip } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import NextLink from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconKey } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Buttons as the rest of apps/app uses them (owner, operations, stays, finance):
 *
 * - `secondary` (soft fill): the everyday button, header actions, Cancel. The default.
 * - `primary` (solid accent): the one main action of a page, a dialog or a panel (Save, Send, Approve).
 * - `ghost`: low emphasis, links to other screens, toolbars, icon-only row actions.
 * - `danger-soft`: Decline, Remove, Void beside other actions. `danger` (solid) only to confirm a
 *   destructive step in a dialog.
 *
 * Header actions carry an icon, as the feature screens do; dialog footers usually don't.
 */
export type ButtonIntent = "secondary" | "primary" | "ghost" | "danger-soft" | "danger";

type HeroButtonProps = ComponentProps<typeof Button>;

export interface ActionButtonProps
  extends Omit<HeroButtonProps, "variant" | "children" | "isIconOnly" | "className" | "size"> {
  /** A Gravity icon key (`icons` in icon.tsx), shown before the words. */
  icon?: IconKey;
  children: ReactNode;
  /** @default "secondary" */
  intent?: ButtonIntent;
  /** "sm" in cards, lists and toolbars; "md" in page headers and dialog footers. */
  size?: "sm" | "md";
  /** "end" for forward moves ("Next", "Continue"). @default "start" */
  iconPlacement?: "start" | "end";
  className?: string;
}

/**
 * A button with words and, usually, an icon. `isPending` swaps the icon for a spinner and blocks presses,
 * keeping the button's width.
 *
 * ```tsx
 * <ActionButton icon="ArrowDownToLine" onPress={exportCsv}>Export</ActionButton>
 * <ActionButton icon="Bell" intent="primary" onPress={remind}>Remind residents in arrears</ActionButton>
 * ```
 */
export function ActionButton({
  icon,
  children,
  intent = "secondary",
  size = "md",
  iconPlacement = "start",
  isPending,
  className,
  ...props
}: ActionButtonProps) {
  const mark = isPending ? (
    <Spinner size="sm" color="current" aria-hidden="true" className="size-4" />
  ) : icon ? (
    <Icon name={icon} />
  ) : null;
  return (
    <Button {...props} isPending={isPending} size={size} variant={intent} className={className}>
      {iconPlacement === "start" ? mark : null}
      {children}
      {iconPlacement === "end" ? mark : null}
    </Button>
  );
}

export interface ActionLinkProps extends Omit<ComponentProps<typeof NextLink>, "className" | "children"> {
  icon?: IconKey;
  children: ReactNode;
  /** @default "secondary" */
  intent?: ButtonIntent;
  size?: "sm" | "md";
  className?: string;
}

/** A link that looks like an `ActionButton` (it navigates instead of opening something). */
export function ActionLink({
  icon,
  children,
  intent = "secondary",
  size = "md",
  className,
  ...props
}: ActionLinkProps) {
  return (
    <NextLink {...props} className={buttonVariants({ variant: intent, size, className })}>
      {icon ? <Icon name={icon} /> : null}
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
  /** "danger" tints the icon (Delete, Remove). @default "default" */
  intent?: "default" | "danger";
  size?: "sm" | "md";
  className?: string;
}

/**
 * An icon-only ghost button, as the feature screens make them (`variant="ghost"`, `isIconOnly`), with a
 * tooltip: row actions (the "Actions" column: the next step first, then Open, Edit, Delete) and tight
 * toolbars.
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
        variant="ghost"
        aria-label={blocked ? `${label} (${disabledReason})` : label}
        aria-disabled={blocked || undefined}
        isPending={isPending}
        onPress={blocked ? undefined : onPress}
        className={cx(
          intent === "danger" && "text-danger",
          // The theme makes aria-disabled buttons ignore the pointer; keep hover so the reason shows.
          blocked && "pointer-events-auto cursor-not-allowed opacity-50",
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
