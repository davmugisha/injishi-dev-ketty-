"use client";

import type { PhotoSource } from "@injishi/ui/photo";
import { type ComponentType, createContext, type ReactNode, useCallback, useContext } from "react";
import type { PmsActions } from "../model/commands.ts";
import type { BoardId, IconName, StockKey, Tone } from "../model/shared.ts";

/**
 * What an app hands PMS's views before they render (ADR-074 stage 4): where each screen they link to lives,
 * the commands they may send, the pieces of its own shell they draw into, and the photographs they show. A
 * product never imports an app, so the app mounts `PmsProvider` around every PMS view, and the views read it
 * through the hooks below. It is HR's mount (stage 3) with a fourth part, because PMS's views draw the app's
 * photo library and HR's do not.
 */

/** The app's route for every screen a view may link to, by the registry's name for the screen. */
export type PmsLinks = Readonly<Record<BoardId, string>>;

/** The status pill a view puts in the app's topbar (a board's live state: business date, offline, sync). */
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

/** The parts of the app's shell a view draws into. */
export interface PmsShell {
  TopbarStatus: ComponentType<TopbarStatusProps>;
}

/** The app's photographs, by the key a row names. */
export interface PmsMedia {
  /** The photograph for a key the app's library holds. Rows the app passes in name only such keys. */
  photo(key: StockKey): PhotoSource;
  /** Whether the library holds a photograph for this key, for a row whose field is free text. */
  hasPhoto(key: string): boolean;
}

interface Mount {
  links: PmsLinks;
  actions: PmsActions;
  shell: PmsShell;
  media: PmsMedia;
}

const PmsMount = createContext<Mount | null>(null);

/** Mounted by the app around a PMS view, with everything the view may not import. */
export function PmsProvider({ links, actions, shell, media, children }: Mount & { children: ReactNode }) {
  return <PmsMount value={{ links, actions, shell, media }}>{children}</PmsMount>;
}

function useMount(): Mount {
  const mount = useContext(PmsMount);
  if (!mount) throw new Error("A PMS view rendered outside PmsProvider: the app must mount it around the view.");
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

/** The commands this view may send. */
export function usePmsActions(): PmsActions {
  return useMount().actions;
}

/** The pieces of the app's shell this view draws into. */
export function usePmsShell(): PmsShell {
  return useMount().shell;
}

/** The app's photographs. */
export function usePmsMedia(): PmsMedia {
  return useMount().media;
}
