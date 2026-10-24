"use client";

import { ComboBox, Input, Label, ListBox, Spinner } from "@heroui/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ActionButton } from "./buttons.tsx";
import {
  choosePlace,
  deepestPlace,
  isLevelOpen,
  isPlaceComplete,
  levelsTo,
  matchesPlace,
  PLACE_LEVEL_LABEL,
  type PlaceChain,
  type PlaceLevel,
  type PlaceOption,
  parentIdFor,
} from "./place.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Lists one level's places under the place chosen above it (null for provinces). Map each level to the
 * API's geography endpoint with `geographyRequest(level, parentId)` (see `place.ts` for the table) and
 * resolve with the rows as they come (`{ id, name, ... }`). Throw to show "Try again".
 */
export type PlaceLoader = (level: PlaceLevel, parentId: number | string | null) => Promise<readonly PlaceOption[]>;

type ListState = { status: "loading" } | { status: "ready"; options: readonly PlaceOption[] } | { status: "failed" };

const PLURAL: Record<PlaceLevel, string> = {
  province: "provinces",
  district: "districts",
  sector: "sectors",
  cell: "cells",
  village: "villages",
};

export interface PlacePickerProps {
  /** The places chosen so far, province first. */
  value: PlaceChain;
  /** The whole chain after any change (levels below a changed one are cleared). */
  onChange: (chain: PlaceChain) => void;
  loadPlaces: PlaceLoader;
  /** The last level asked for. @default "village" */
  depth?: PlaceLevel;
  /** A heading for the group ("Where the home is"). */
  label?: ReactNode;
  /** The form field name: the deepest place's id is posted under it once every level is chosen. */
  name?: string;
  /**
   * Keep the room for every level from the start (from sm up), so nothing below moves as the boxes
   * appear. On a phone the levels stack and each takes room as it opens. @default true
   */
  reserveSpace?: boolean;
  /** An error about the place as a whole ("Choose the village."), shown under the boxes. */
  errorMessage?: string | null;
  isDisabled?: boolean;
  className?: string;
}

/**
 * A place in Rwanda, picked Province, District, Sector, Cell, Village. Each box is searchable and
 * appears once the level above is chosen; changing a level clears every level below it. The space for
 * every level is kept from the start (`reserveSpace`, from sm up), so nothing below the picker moves as boxes appear. Lists are
 * loaded through `loadPlaces` (the caller reads the API's geography endpoints) and kept for the page.
 */
export function PlacePicker({
  value,
  onChange,
  loadPlaces,
  depth = "village",
  label,
  name,
  reserveSpace = true,
  errorMessage,
  isDisabled,
  className,
}: PlacePickerProps) {
  const id = useId();
  const levels = levelsTo(depth);
  const [lists, setLists] = useState<Record<string, ListState>>({});
  const loader = useRef(loadPlaces);
  loader.current = loadPlaces;
  const started = useRef(new Set<string>());

  const keyFor = (level: PlaceLevel) => `${level}:${parentIdFor(value, level) ?? ""}`;

  // Load each open level's list once per parent, kept for going back and forth. Runs after every render:
  // `started` makes it a no-op unless a level just opened or a failed list was retried.
  useEffect(() => {
    for (const level of levels) {
      if (!isLevelOpen(value, level)) continue;
      const key = keyFor(level);
      if (started.current.has(key)) continue;
      started.current.add(key);
      setLists((all) => ({ ...all, [key]: { status: "loading" } }));
      loader.current(level, parentIdFor(value, level)).then(
        (options) => setLists((all) => ({ ...all, [key]: { status: "ready", options } })),
        () => setLists((all) => ({ ...all, [key]: { status: "failed" } })),
      );
    }
  });

  const retry = (level: PlaceLevel) => {
    const key = keyFor(level);
    started.current.delete(key);
    setLists((all) => ({ ...all, [key]: { status: "loading" } }));
  };

  const complete = isPlaceComplete(value, depth);
  const deepest = deepestPlace(value);

  return (
    <fieldset
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-label={label ? undefined : "Place"}
      className={cx("flex min-w-0 flex-col gap-2", className)}
    >
      {label ? (
        <Label id={`${id}-label`} elementType="span" isInvalid={Boolean(errorMessage)}>
          {label}
        </Label>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {levels.map((level) => {
          const open = isLevelOpen(value, level);
          const list = lists[keyFor(level)];
          return (
            <PlaceLevelBox
              key={level}
              level={level}
              open={open}
              list={open ? list : undefined}
              selected={value[level] ?? null}
              isDisabled={isDisabled}
              wide={level === depth && levels.length % 2 === 1}
              reserve={reserveSpace}
              onChoose={(option) => onChange(choosePlace(value, level, option))}
              onRetry={() => retry(level)}
            />
          );
        })}
      </div>
      {errorMessage ? (
        <p role="alert" className="px-1 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={complete && deepest ? String(deepest.place.id) : ""} /> : null}
    </fieldset>
  );
}

function PlaceLevelBox({
  level,
  open,
  list,
  selected,
  isDisabled,
  wide,
  reserve,
  onChoose,
  onRetry,
}: {
  level: PlaceLevel;
  open: boolean;
  list: ListState | undefined;
  selected: PlaceOption | null;
  isDisabled?: boolean;
  wide: boolean;
  reserve: boolean;
  onChoose: (option: PlaceOption | null) => void;
  onRetry: () => void;
}) {
  const options = list?.status === "ready" ? list.options : selected ? [selected] : [];
  const loading = open && (!list || list.status === "loading");
  const failed = list?.status === "failed";
  const byId = new Map(options.map((o) => [String(o.id), o]));
  const plural = PLACE_LEVEL_LABEL[level].toLowerCase();
  return (
    <div
      // A level not open yet keeps its place, unseen (hidden from screen readers too) and out of reach, so
      // nothing moves when it appears. Without `reserve`, it takes no room until it opens.
      inert={open ? undefined : true}
      className={cx(
        "flex min-w-0 flex-col gap-1",
        // On a phone a level takes room only once it opens (a stack of empty rows would read as broken);
        // from sm up, where the levels sit in pairs, the room is kept.
        !open && (reserve ? "max-sm:hidden sm:invisible" : "hidden"),
        wide && "sm:col-span-2",
      )}
    >
      <ComboBox
        fullWidth
        aria-label={open ? undefined : PLACE_LEVEL_LABEL[level]}
        selectedKey={selected ? String(selected.id) : null}
        onSelectionChange={(key) => {
          const option = key == null ? null : (byId.get(String(key)) ?? null);
          if (String(option?.id ?? "") !== String(selected?.id ?? "")) onChoose(option);
        }}
        defaultFilter={(text, input) => matchesPlace({ id: 0, name: text }, input)}
        allowsEmptyCollection
        isDisabled={isDisabled || !open || loading || failed}
        isInvalid={failed || undefined}
        className="gap-1"
      >
        <Label>{PLACE_LEVEL_LABEL[level]}</Label>
        <ComboBox.InputGroup>
          <Input placeholder={loading ? `Loading ${PLURAL[level]}` : `Search ${PLURAL[level]}`} />
          <ComboBox.Trigger>
            {loading ? <Spinner size="sm" color="current" aria-hidden="true" /> : undefined}
          </ComboBox.Trigger>
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox renderEmptyState={() => <p className="px-3 py-2 text-sm text-muted">No {plural} by that name.</p>}>
            {options.map((o) => (
              <ListBox.Item key={String(o.id)} id={String(o.id)} textValue={o.name}>
                {o.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      {failed ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span role="alert" className="text-xs text-danger">
            We couldn't load the {PLURAL[level]}.
          </span>
          <ActionButton icon="ArrowRotateRight" size="sm" onPress={onRetry}>
            Try again
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
