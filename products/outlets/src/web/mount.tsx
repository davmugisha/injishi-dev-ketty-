"use client";

import type { PhotoSource } from "@injishi/ui/photo";
import { type ComponentType, createContext, type ReactNode, useCallback, useContext } from "react";
import type { BoardId, IconName, StockKey, Tone } from "../model/shared.ts";

/**
 * What an app hands Outlets' views before they render (ADR-074 stage 5): where each screen they link to lives,
 * the pieces of its own shell they draw into, and the photographs they show. A product never imports an app,
 * so the app mounts `OutletsProvider` around every Outlets view, and the views read it through the hooks below.
 * It is PMS's mount (stage 4) without the commands: Outlets' screens send none yet; they draw the rows the app
 * hands them.
 */

/** The app's route for every screen a view may link to, by the registry's name for the screen. */
export type OutletsLinks = Readonly<Record<BoardId, string>>;

/** The status pill a view puts in the app's topbar. */
export interface TopbarStatusProps {
  /** Which of the screen's pills it replaces (default 0, the first). */
  slot?: number;
  kind: "gate" | "chip";
  label: string;
  icon?: IconName;
  dot?: Tone;
  tone?: Tone;
  /** The screen the pill links to, by the registry's name for it. */
  board?: BoardId | null;
}

/** The parts of the app's shell a view draws into: the topbar pill, and the brand mark a device screen shows. */
export interface OutletsShell {
  TopbarStatus: ComponentType<TopbarStatusProps>;
  BrandMark: ComponentType<{ size?: number; className?: string }>;
}

/** The app's photographs, by the key a row names. */
export interface OutletsMedia {
  /** The photograph for a key the app's library holds. Rows the app passes in name only such keys. */
  photo(key: StockKey): PhotoSource;
  /** Whether the library holds a photograph for this key, for a row whose field is free text. */
  hasPhoto(key: string): boolean;
}

interface Mount {
  links: OutletsLinks;
  shell: OutletsShell;
  media: OutletsMedia;
}

const OutletsMount = createContext<Mount | null>(null);

/** Mounted by the app around an Outlets view, with everything the view may not import. */
export function OutletsProvider({ links, shell, media, children }: Mount & { children: ReactNode }) {
  return <OutletsMount value={{ links, shell, media }}>{children}</OutletsMount>;
}

function useMount(): Mount {
  const mount = useContext(OutletsMount);
  if (!mount)
    throw new Error("An Outlets view rendered outside OutletsProvider: the app must mount it around the view.");
  return mount;
}

/** The link to a screen, by the registry's name for it. Stable while the app's links are, so a view may list it as a dependency. */
export function useBoardHref(): (board: BoardId) => string {
  const { links } = useMount();
  return useCallback(
    (board: BoardId) => {
      const href = links[board];
      if (href === undefined) throw new Error(`The app passed no link for the screen ${board}.`);
      return href;
    },
    [links],
  );
}

/** The pieces of the app's shell this view draws into. */
export function useOutletsShell(): OutletsShell {
  return useMount().shell;
}

/** The app's photographs. */
export function useOutletsMedia(): OutletsMedia {
  return useMount().media;
}
