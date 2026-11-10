"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

/**
 * Result pagination.
 *
 * The reference paginates its 203 listings into pages of 24 and centres the
 * control under the grid: a previous arrow, numbered pages with an ellipsis
 * standing in for the run it skipped, and a next arrow. Ours follows that
 * shape. The page lives in the URL as `?page=N` so a deep page is a link
 * someone can send, which is the behaviour the reference's own `?page=1`
 * implies.
 *
 * Squares, not pills: these are a numbered run where each item must read as
 * the same object as its neighbours, and the site's pill treatment is for
 * actions. The corner radius is the interior-chrome step, not the card step,
 * which is why every control here passes `shape="rounded"` rather than taking
 * the Button default.
 *
 * The current page is `primary` — the accent fill — not the old fixed navy.
 * "Which page am I on" is the one thing this control has to answer at a glance,
 * and the accent is the strongest thing the palette has to say it with.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("search");
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={t("searchResultPages")}
      data-pagination
      className="mb-20 mt-12 flex items-center justify-center gap-2"
    >
      <Arrow
        direction="previous"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      />

      {pageRange(page, pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden
            className="w-6 text-center text-sm text-page-fg-70"
          >
            …
          </span>
        ) : (
          <Button
            key={entry}
            variant={entry === page ? "primary" : "outline"}
            shape="rounded"
            aria-current={entry === page ? "page" : undefined}
            aria-label={t("page", { page: entry })}
            onClick={() => onPageChange(entry)}
            className={cn(
              "h-10 min-w-10 px-3 text-sm tabular-nums",
              entry === page ? undefined : "text-page-fg-70 hover:text-page-fg",
            )}
          >
            {entry}
          </Button>
        ),
      )}

      <Arrow
        direction="next"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}

function Arrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("search");
  return (
    <Button
      variant="outline"
      size="icon"
      shape="rounded"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "previous" ? t("previousPage") : t("nextPage")}
      className={cn(!disabled && "text-page-fg")}
    >
      {direction === "previous" ? (
        <ChevronLeft width={16} height={16} strokeWidth={1.6} aria-hidden />
      ) : (
        <ChevronRight width={16} height={16} strokeWidth={1.6} aria-hidden />
      )}
    </Button>
  );
}

/**
 * Which page numbers to show.
 *
 * First and last are always reachable, plus the current page and one either
 * side; anything skipped collapses to a single gap. Below eight pages the run
 * is short enough to show whole, which is where our catalogue sits today —
 * the collapsing exists so the control does not change shape once it grows.
 */
function pageRange(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) out.push("gap");
    out.push(value);
    previous = value;
  }
  return out;
}
