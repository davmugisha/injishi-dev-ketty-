import * as React from "react";
import { cn } from "@injishi/utils";

/* The trail above a record: `Section / Leaf / Record` (ADR-044, D-e 4).
 *
 * ONE COMPONENT, EVERY APP. It shows on records only. A top level screen and a
 * lens tab do not get one, because the nav and the lens rail already say where
 * you are, and a trail that repeats them is noise.
 *
 * THE LINK IS THE CALLER'S. This package does not depend on `next`, and a plain
 * `<a>` in a Next app reloads the whole page, which is exactly what a workspace
 * switch was built to avoid (ADR-017). So a Next consumer passes `linkAs={Link}`
 * and gets client navigation; anything else gets an anchor.
 *
 * A crumb with no `href` is a label, not a page. A section heading ("Front
 * desk") is one: it groups leaves and opens nothing, so it must not look like a
 * link. The last crumb is always the page you are on, whatever it was given. */

export interface Crumb {
  label: string;
  href?: string;
}

type LinkLike = React.ElementType<{
  href: string;
  className?: string;
  children?: React.ReactNode;
}>;

function Breadcrumbs({
  trail,
  linkAs: LinkAs = "a",
  className,
}: {
  trail: readonly Crumb[];
  linkAs?: LinkLike;
  className?: string;
}) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" data-slot="breadcrumbs" className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-y-1 p-0 text-sm">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center">
              {last ? (
                <span
                  className="truncate font-semibold text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <LinkAs
                  href={crumb.href}
                  className={cn(
                    "text-muted-foreground underline-offset-4",
                    "hover:text-foreground hover:underline",
                  )}
                >
                  {crumb.label}
                </LinkAs>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
              {last ? null : (
                <span aria-hidden className="mx-2 text-muted-foreground">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
