"use client";

import { Card } from "@heroui/react";
import { type ReactNode, useId } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * A titled card for one part of a page: a short title, at most one helper line, the section's own
 * actions on the right, and an optional footer (a total, a "View all" link). The card is a region named
 * by its title, so screen readers can jump between a page's sections.
 */
export function SectionCard({
  title,
  description,
  actions,
  footer,
  children,
  headingLevel = 2,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** The title's level in the page outline. @default 2 */
  headingLevel?: 2 | 3;
  className?: string;
  contentClassName?: string;
}) {
  const titleId = useId();
  const hasHeader = Boolean(title || actions);
  return (
    <Card
      className={cx("h-full min-w-0 gap-4", className)}
      render={(props) => <section {...props} aria-labelledby={title ? titleId : undefined} />}
    >
      {hasHeader ? (
        <Card.Header className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {title ? (
              <Card.Title
                id={titleId}
                className="text-base font-semibold text-pretty"
                render={(props) => (headingLevel === 2 ? <h2 {...props} /> : <h3 {...props} />)}
              >
                {title}
              </Card.Title>
            ) : null}
            {description ? <Card.Description className="text-sm text-pretty">{description}</Card.Description> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </Card.Header>
      ) : null}
      <Card.Content className={cx("min-w-0 gap-3", contentClassName)}>{children}</Card.Content>
      {footer ? (
        <Card.Footer className="-mx-4 -mb-4 flex-wrap items-center justify-between gap-2 border-t border-separator px-4 py-3 text-sm">
          {footer}
        </Card.Footer>
      ) : null}
    </Card>
  );
}
