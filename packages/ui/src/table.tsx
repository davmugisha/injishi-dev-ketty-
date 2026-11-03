"use client";

import { Chip, ListBox, SearchField, Select, Tabs } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { ReactNode } from "react";
import { formatNumber } from "./format.tsx";
import { Icon, type IconKey } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface FilterTab {
  id: string;
  label: string;
  /** The number of records under the tab; omit while unknown. */
  count?: number;
}

/**
 * The status filter of a list page, each choice with its count. Keeping the choice in the URL is the page's
 * job (`?tab=`). "menu" (the default) is a filter: one dropdown that names what it filters and what is
 * chosen ("Stage: Active 12"), so it sits in one row with the search and reads as a filter, not a page.
 * "tabs" is for real sections of one record; "segment" for a compact switch of two to four views.
 */
export function FilterTabs({
  label,
  tabs,
  selectedKey,
  onSelectionChange,
  variant = "menu",
  name,
  icon,
  className,
}: {
  /** What the tabs filter, for screen readers ("Lease status"). */
  label: string;
  tabs: FilterTab[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  variant?: "menu" | "tabs" | "segment";
  /** The menu's visible name ("Stage"); @default "Show" */
  name?: string;
  icon?: IconKey;
  className?: string;
}) {
  if (variant === "menu") {
    return (
      <FilterMenu
        label={label}
        name={name ?? "Show"}
        icon={icon}
        options={tabs}
        value={selectedKey}
        onChange={onSelectionChange}
        className={className}
      />
    );
  }
  if (variant === "segment") {
    // As the feature screens write it: the count after the words ("Money 3").
    return (
      <Segment
        aria-label={label}
        selectedKey={selectedKey}
        onSelectionChange={(k) => onSelectionChange(String(k))}
        className={cx("w-fit max-w-full self-start", className)}
      >
        {tabs.map((t) => (
          <Segment.Item key={t.id} id={t.id}>
            {t.label}
            {t.count == null ? null : <span className="tabular"> {formatNumber(t.count)}</span>}
          </Segment.Item>
        ))}
      </Segment>
    );
  }

  // The tabs of the feature screens: secondary Tabs sized to their words, a Chip with the count, the
  // indicator under the selected one. The row scrolls sideways on a phone rather than wrapping.
  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(k) => onSelectionChange(String(k))}
      variant="secondary"
      className={cx("min-w-0", className)}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label={label} className="justify-start">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} className="w-auto gap-2 px-3 whitespace-nowrap">
              {t.label}
              {t.count == null ? null : (
                <Chip size="sm" className="tabular">
                  {formatNumber(t.count)}
                  <span className="sr-only"> {t.count === 1 ? "item" : "items"}</span>
                </Chip>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

/**
 * A filter of a list: a field-like button that says what it filters and what is chosen ("Stage  Active"),
 * opening a list of the choices with their counts and a tick on the chosen one. Set (anything but the
 * first choice) it takes the accent tint, so a filtered list is plain to see.
 */
export function FilterMenu({
  label,
  name,
  icon = "Funnel",
  options,
  value,
  onChange,
  compact = false,
  className,
}: {
  /** What it filters, for screen readers ("Lease stage"). */
  label: string;
  /** The visible name before the choice ("Stage"). */
  name: string;
  icon?: IconKey;
  options: readonly { id: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  /** Icon and choice only, the name for screen readers: for a crowded row. */
  compact?: boolean;
  className?: string;
}) {
  const isSet = options.length > 0 && value !== options[0]?.id;
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(k) => (k != null ? onChange(String(k)) : undefined)}
      className={cx("w-auto min-w-0 shrink-0", className)}
    >
      <Select.Trigger
        className={cx(
          "h-9 gap-2 rounded-lg border pr-9 pl-3 shadow-none",
          isSet ? "border-accent/50 bg-accent-soft text-accent-soft-foreground" : "border-separator bg-surface",
        )}
      >
        <Icon name={icon} className={cx("size-4 shrink-0", isSet ? "text-accent" : "text-muted")} />
        <span className={cx("shrink-0 text-sm", isSet ? "text-accent" : "text-muted", compact && "sr-only")}>
          {name}
        </span>
        {/* Only the words: the count is for the list. */}
        <Select.Value className="truncate text-sm font-medium">{({ selectedText }) => selectedText}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-56">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label} className="gap-3">
              <span className="flex-1 truncate">{o.label}</span>
              {o.count == null ? null : <span className="text-xs text-muted tabular">{formatNumber(o.count)}</span>}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** The search box of a list page. Keeping the query in the URL is the page's job. */
export function SearchBar({
  label,
  value,
  defaultValue,
  onChange,
  onSubmit,
  placeholder,
  className,
}: {
  /** What it searches, for screen readers ("Search leases"). */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** A hint of what can be found ("Tenant, unit or reference"). */
  placeholder?: string;
  className?: string;
}) {
  return (
    <SearchField
      aria-label={label}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onSubmit={onSubmit}
      className={cx("w-full min-w-0 md:w-64", className)}
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} />
        <SearchField.ClearButton aria-label="Clear search" />
      </SearchField.Group>
    </SearchField>
  );
}

/**
 * The one row above a list: the filters on the left (the status menu first, then any other filter), the
 * search at the end. It wraps on a narrow screen, the search taking the full width on a phone.
 */
export function ListToolbar({
  tabs,
  children,
  className,
}: {
  /** The status filter: a `FilterTabs` (its "menu" variant). */
  tabs?: ReactNode;
  /** `SearchBar`, `FilterSelect`s, a view switch: in reading order. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "ij-toolbar flex min-w-0 flex-wrap items-center gap-2 [&>.search-field]:w-full sm:[&>.search-field]:ml-auto sm:[&>.search-field]:w-64",
        className,
      )}
    >
      {tabs}
      {children}
    </div>
  );
}

/** A compact filter for a toolbar: the chosen option is the label ("All units"); the name is for screen readers. */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** What it filters, for screen readers ("Unit"). */
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(k) => (k != null ? onChange(String(k)) : undefined)}
      className={cx("w-auto min-w-0 shrink-0", className)}
    >
      <Select.Trigger className="h-9 gap-2 rounded-lg border border-separator bg-surface pr-9 pl-3 shadow-none">
        <Select.Value className="truncate text-sm font-medium" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-48">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
