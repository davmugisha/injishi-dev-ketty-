import Link from "next/link";
import { Fragment } from "react";

/** The trail above every inner page's title. */
export function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="pt-6">
      <ol className="m-0 flex list-none items-center p-0 text-sm">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={crumb.label}>
              <li>
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="text-page-fg hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-page-fg-70" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
              {last ? null : (
                <li aria-hidden className="mx-2 text-page-fg-70">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
