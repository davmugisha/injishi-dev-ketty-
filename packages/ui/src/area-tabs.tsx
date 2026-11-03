"use client";

import { Chip, Tabs } from "@heroui/react";
import { formatNumber } from "./format.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface AreaTab {
  id: string;
  label: string;
  href: string;
  /** A count beside the words, only when something waits there. */
  count?: number;
}

/**
 * The pages of one sidebar area as tabs, under the page title (Units, Leases, Faults, Move-outs). Each
 * tab is a link: the address names the page, so Back and a shared link work. The row scrolls sideways
 * on a phone rather than wrapping.
 */
export function AreaTabs({
  label,
  tabs,
  selectedId,
  className,
}: {
  /** What the tabs switch between, for screen readers ("Property"). */
  label: string;
  tabs: AreaTab[];
  selectedId: string | null;
  className?: string;
}) {
  return (
    <Tabs selectedKey={selectedId ?? undefined} variant="secondary" className={cx("min-w-0", className)}>
      <Tabs.ListContainer className="overflow-x-auto">
        <Tabs.List aria-label={label} className="justify-start">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} href={t.href} className="w-auto gap-2 px-3 whitespace-nowrap">
              {t.label}
              {t.count ? (
                <Chip size="sm" className="tabular">
                  {formatNumber(t.count)}
                </Chip>
              ) : null}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
