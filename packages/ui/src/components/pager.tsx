"use client";

import * as React from "react";
import { LIST_PAGE_SIZES, type ListPageSize } from "@injishi/contracts";
import { cn } from "@injishi/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface PagerProps {
  readonly page: number;
  readonly pageSize: ListPageSize;
  /** How many rows match the query, across every page. */
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: ListPageSize) => void;
  readonly className?: string;
}

/**
 * Page numbers, not cursors (058-list-framework, calls made while writing): a
 * business has hundreds of staff, so "26 to 50 of 132" and a jump to the last
 * page are worth more than a cursor's stability. Page sizes are the four the
 * list query accepts.
 */
function Pager({ page, pageSize, total, onPageChange, onPageSizeChange, className }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pages" className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <p className="text-muted-foreground tabular-nums" aria-live="polite">
        {total === 0 ? "No rows" : `${from} to ${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as ListPageSize)}>
            <SelectTrigger aria-label="Rows per page" className="h-9 w-20 px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
        </Button>
        <span className="tabular-nums text-muted-foreground">
          Page {Math.min(page, pages)} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon aria-hidden className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

export { Pager };
