import type { ReactNode } from "react";

import { Button } from "@injishi/web-ui";
import { Icon } from "./icon";

/**
 * A screen that exists and has nothing in it yet.
 *
 * IT ALWAYS SAYS WHAT WOULD FILL IT. An empty state that reads as an error sends
 * a tenant with no bookings looking for the bug, and a bare zero tells nobody
 * anything. Move 4 rebuilt six screens whose data lives behind endpoints that
 * are not written yet, and the honest thing is to say which, on the screen,
 * rather than ship something that looks live.
 */
export function EmptyPanel({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      {action ? (
        <Button asChild variant="primary" className="mt-2">
          <a href={action.href}>{action.label}</a>
        </Button>
      ) : null}
    </div>
  );
}
