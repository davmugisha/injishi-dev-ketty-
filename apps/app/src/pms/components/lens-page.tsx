"use client";

/**
 * The shell every MERGED screen renders through (ADR-018, move 5).
 *
 * Four money leaves became one Finance with four lenses; three calendar screens
 * became one Calendar with three views; Orders and Menu became Services;
 * Rooms and rates and What you offer became Inventory. All four merges want the
 * same thing on screen: a rail of ways to look at one subject.
 *
 * IT IS NOT `ObjectPage`, and the difference is real. An object page names a
 * RECORD — this guest, this lease — and its rail addresses facets of that one
 * row. This names a SUBJECT the workspace has one of, so there is no record
 * header and no back link to a list. Sharing one component would have meant a
 * record header that is empty half the time.
 *
 * A LENS IS A ROUTE SEGMENT (D-c). Calendar is the exception and takes `?view=`
 * instead, because a view is a display mode of one dataset rather than a facet
 * of a record: nobody sends "the availability view" as a thing, they send a date
 * range. If that distinction ever feels strained, the tiebreak is D-c.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export interface LensLink {
  key: string;
  label: string;
  href: string;
  /** Count pill — omitted when zero so a quiet rail stays quiet. */
  count?: number | null;
}

export function LensPage({
  lenses,
  active,
  children,
}: {
  lenses: LensLink[];
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="pms-enter">
      {/* Not "Sections": the sidebar's navigation already has that name, and two
          landmarks with one name cannot be told apart by a screen reader. */}
      <nav
        aria-label="Page sections"
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {lenses.map((lens) => {
          const on = lens.key === active;
          return (
            <Link
              key={lens.key}
              href={lens.href}
              aria-current={on ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 12px 9px",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                color: on ? "var(--foreground)" : "var(--muted)",
                borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {lens.label}
              {lens.count ? (
                <span
                  className="pms-num"
                  style={{
                    minWidth: 18,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {lens.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}
