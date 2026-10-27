import { Alert, Skeleton } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import type { ReactNode } from "react";
import { ActionButton } from "./buttons.tsx";
import { Icon, type IconKey } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Nothing to show yet: an icon, one short line, and the next step as an action. Never a blank area.
 *
 * ```tsx
 * <EmptyBlock icon="FileText" title="No leases yet" action={<ActionButton icon="Plus" onPress={add}>New lease</ActionButton>} />
 * ```
 */
export function EmptyBlock({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: {
  icon: IconKey;
  /** One short line: what is missing ("No leases yet", "No faults reported"). */
  title: ReactNode;
  /** At most one helper line, only when it adds something (why, or what happens next). */
  description?: ReactNode;
  /** The next step, usually an `ActionButton` that opens a dialog or side panel. */
  action?: ReactNode;
  /** "sm" inside a card or a table, "md" for a page section. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <EmptyState size={size} className={cx("w-full", className)}>
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Icon name={icon} />
        </EmptyState.Media>
        <EmptyState.Title className="text-balance">{title}</EmptyState.Title>
        {description ? (
          <EmptyState.Description className="max-w-sm text-pretty">{description}</EmptyState.Description>
        ) : null}
      </EmptyState.Header>
      {action ? <EmptyState.Content>{action}</EmptyState.Content> : null}
    </EmptyState>
  );
}

export type LoadingShape = "table" | "cards" | "kpi" | "chart" | "list";

/**
 * A skeleton in the shape of what is loading, so the page does not jump when it arrives. Announced once
 * to screen readers as "Loading <label>". The shimmer stops for people who ask for reduced motion.
 */
export function LoadingBlock({
  shape,
  label,
  rows = 5,
  count = 4,
  className,
}: {
  shape: LoadingShape;
  /** What is loading, for screen readers ("leases", "rent this month"). */
  label: string;
  /** Rows for "table" and "list". */
  rows?: number;
  /** Tiles for "kpi" and "cards". */
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cx("w-full", className)}>
      <span className="sr-only">Loading {label}</span>
      <div aria-hidden="true">{SHAPES[shape]({ rows, count })}</div>
    </div>
  );
}

const line = (w: string, h = "h-3") => <Skeleton className={cx("rounded-full", h, w)} />;
const indexes = (n: number) => Array.from({ length: Math.max(1, n) }, (_, i) => i);

const SHAPES: Record<LoadingShape, (o: { rows: number; count: number }) => ReactNode> = {
  table: ({ rows }) => (
    <div className="flex flex-col overflow-hidden rounded-xl border border-separator">
      <div className="hidden items-center gap-6 bg-surface-secondary px-4 py-3 md:flex">
        {line("w-1/5")}
        {line("w-1/6")}
        {line("w-1/12")}
        {line("ml-auto w-1/12")}
      </div>
      {indexes(rows).map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-t border-separator px-4 py-3 first:border-t-0 md:first:border-t"
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {line(i % 2 ? "w-2/5" : "w-1/3")}
            {line("w-1/4", "h-2.5")}
          </div>
          <div className="hidden w-1/6 md:block">{line("w-full")}</div>
          {line("w-16", "h-5")}
        </div>
      ))}
    </div>
  ),
  list: ({ rows }) => (
    <div className="flex flex-col gap-2">
      {indexes(rows).map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-separator p-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {line(i % 2 ? "w-1/2" : "w-2/5")}
            {line("w-1/3", "h-2.5")}
          </div>
          {line("w-14", "h-5")}
        </div>
      ))}
    </div>
  ),
  cards: ({ count }) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {indexes(count).map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-surface">
          <Skeleton className="aspect-video w-full rounded-xl" />
          {line("w-2/3", "h-3.5")}
          {line("w-1/2")}
          <div className="flex gap-2 pt-1">
            {line("w-16", "h-5")}
            {line("w-12", "h-5")}
          </div>
        </div>
      ))}
    </div>
  ),
  kpi: ({ count }) => (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-separator shadow-surface lg:grid-flow-col lg:grid-cols-none">
      {indexes(count).map((i) => (
        <div key={i} className="flex flex-col gap-3 bg-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-lg" />
            {line("w-1/2")}
          </div>
          {line("w-3/4", "h-6")}
          {line("w-1/3", "h-2.5")}
        </div>
      ))}
    </div>
  ),
  chart: () => (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-4">
      <div className="flex items-center justify-between">
        {line("w-1/3", "h-3.5")}
        {line("w-20")}
      </div>
      <div className="flex h-48 items-end gap-3 rounded-xl bg-surface px-4 pt-6 pb-4">
        {[45, 70, 55, 85, 60, 95, 75, 50].map((h, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative silhouette
            key={i}
            className={cx("flex-1 rounded-t-md rounded-b-none", i > 5 && "hidden sm:block")}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  ),
};

/**
 * Something failed to load: what failed, what to do, and a Retry. An API outage is never a sign-out
 * and never a blank page. In a route's `error.tsx`, pass `onRetry={reset}`.
 */
export function ErrorBlock({
  title,
  description = "Check your connection, then try again.",
  onRetry,
  isRetrying,
  className,
}: {
  /** What failed, in words: "Couldn't load your leases". */
  title: ReactNode;
  /** What to do about it. */
  description?: ReactNode;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  return (
    <Alert status="danger" className={cx("items-start", className)}>
      <Alert.Indicator>
        <Icon name="CircleExclamation" />
      </Alert.Indicator>
      <Alert.Content className="min-w-0 flex-1">
        <Alert.Title>{title}</Alert.Title>
        {description ? <Alert.Description>{description}</Alert.Description> : null}
      </Alert.Content>
      {onRetry ? (
        <ActionButton icon="ArrowsRotateRight" size="sm" onPress={onRetry} isPending={isRetrying} className="shrink-0">
          Retry
        </ActionButton>
      ) : null}
    </Alert>
  );
}
