"use client";

import * as React from "react";
import type { SavedView } from "@injishi/contracts";
import { BookmarkIcon, CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface NewSavedView {
  readonly name: string;
  readonly shared: boolean;
  readonly isDefault: boolean;
}

export interface SavedViewsMenuProps {
  /** The caller's own views and the shared ones; undefined while they load. */
  readonly views: readonly SavedView[] | undefined;
  /** The view last opened, while the screen still shows it unchanged. */
  readonly activeId: string | null;
  readonly onOpen: (view: SavedView) => void;
  /** Save what the screen shows now as a new view. Rejects with the reason to show (a name taken). */
  readonly onSave: (view: NewSavedView) => Promise<void>;
  /** Save what the screen shows now into one of the caller's own views. */
  readonly onOverwrite: (view: SavedView) => Promise<void>;
  readonly onSetDefault: (view: SavedView, isDefault: boolean) => Promise<void>;
  readonly onDelete: (view: SavedView) => Promise<void>;
}

function SaveViewForm({ onSave, onDone }: { onSave: SavedViewsMenuProps["onSave"]; onDone: () => void }) {
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [isDefault, setIsDefault] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), shared, isDefault });
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't save this view.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <label htmlFor={id} className="text-sm font-semibold">
        Name this view
      </label>
      <Input
        id={id}
        size="sm"
        value={name}
        maxLength={60}
        placeholder="Kitchen, this week"
        onChange={(event) => setName(event.target.value)}
        aria-invalid={error !== null}
        autoFocus
      />
      <Checkbox isSelected={shared} onChange={setShared} className="items-start">
        <span className="text-sm">
          Share with everyone at the business
          <span className="block text-xs text-muted-foreground">
            They see the same filters and columns, and only the rows they may already read.
          </span>
        </span>
      </Checkbox>
      <Checkbox isSelected={isDefault} onChange={setIsDefault}>
        <span className="text-sm">Open this view when I arrive</span>
      </Checkbox>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" pending={pending} disabled={name.trim() === ""}>
        Save view
      </Button>
    </form>
  );
}

/**
 * Saved views (058-list-framework AC-LF5): a person names what the screen shows
 * (filters, sort, grouping, columns, view), may share it with everyone at the
 * business, and may open one by default.
 *
 * A shared view carries configuration only. Anyone who opens it reads rows
 * through their own permissions and branch limits, and a part they cannot use
 * is dropped with a notice on the screen (AC-LF16). Only its author changes or
 * deletes a view, so the menu offers those actions on the caller's own views.
 */
function SavedViewsMenu({
  views,
  activeId,
  onOpen,
  onSave,
  onOverwrite,
  onSetDefault,
  onDelete,
}: SavedViewsMenuProps) {
  const [saving, setSaving] = React.useState(false);
  const mine = (views ?? []).filter((v) => v.mine);
  const shared = (views ?? []).filter((v) => !v.mine);
  const active = (views ?? []).find((v) => v.id === activeId) ?? null;

  const item = (view: SavedView) => (
    <DropdownMenuItem key={view.id} onSelect={() => onOpen(view)}>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {view.id === activeId ? <CheckIcon aria-hidden className="size-4" /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{view.name}</span>
        {!view.mine && view.authorName ? (
          <span className="truncate text-xs text-muted-foreground">by {view.authorName}</span>
        ) : null}
      </span>
      {view.isDefault && view.mine ? <span className="ml-auto text-xs text-muted-foreground">Opens first</span> : null}
    </DropdownMenuItem>
  );

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkIcon aria-hidden className="size-4" />
            {active ? active.name : "Views"}
            <ChevronDownIcon aria-hidden className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-tile">
          {views === undefined ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">Loading views</DropdownMenuLabel>
          ) : null}
          {views !== undefined && views.length === 0 ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">No saved views yet</DropdownMenuLabel>
          ) : null}
          {mine.length > 0 ? <DropdownMenuLabel>My views</DropdownMenuLabel> : null}
          {mine.map(item)}
          {shared.length > 0 ? <DropdownMenuLabel>Shared with everyone</DropdownMenuLabel> : null}
          {shared.map(item)}
          {active?.mine ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void onOverwrite(active)}>
                Save the current screen into &ldquo;{active.name}&rdquo;
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onSetDefault(active, !active.isDefault)}>
                {active.isDefault ? "Stop opening this view first" : "Open this view when I arrive"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => void onDelete(active)}
              >
                Delete &ldquo;{active.name}&rdquo;
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open={saving} onOpenChange={setSaving}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            Save view
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          {saving ? <SaveViewForm onSave={onSave} onDone={() => setSaving(false)} /> : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { SavedViewsMenu };
