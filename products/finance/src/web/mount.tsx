"use client";

import { type ComponentType, createContext, type ReactNode, useCallback, useContext } from "react";
import type { BoardId, IconName, Tone } from "../model/shared.ts";

/**
 * What an app hands Finance's views before they render (ADR-074 stage 6): where each screen they link to
 * lives, and the piece of its own shell they draw into. A product never imports an app, so the app mounts `FinanceProvider`
 * around every Finance view, and the views read it through the hooks below. It is Outlets' mount (stage 5)
 * without the photographs: Finance's screens send no commands yet; they draw the rows the app hands them.
 */

/** The app's route for every screen a view may link to, by the registry's name for the screen. */
export type FinanceLinks = Readonly<Record<BoardId, string>>;

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

/** The part of the app's shell a view draws into: the topbar pill. */
export interface FinanceShell {
  TopbarStatus: ComponentType<TopbarStatusProps>;
}

interface Mount {
  links: FinanceLinks;
  shell: FinanceShell;
}

const FinanceMount = createContext<Mount | null>(null);

/** Mounted by the app around a Finance view, with everything the view may not import. */
export function FinanceProvider({ links, shell, children }: Mount & { children: ReactNode }) {
  return <FinanceMount value={{ links, shell }}>{children}</FinanceMount>;
}

function useMount(): Mount {
  const mount = useContext(FinanceMount);
  if (!mount)
    throw new Error("A Finance view rendered outside FinanceProvider: the app must mount it around the view.");
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

/** The piece of the app's shell this view draws into. */
export function useFinanceShell(): FinanceShell {
  return useMount().shell;
}
