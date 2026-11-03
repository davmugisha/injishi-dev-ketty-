"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";
import type { BoardId } from "../model/shared.ts";

/**
 * What an app hands Pay's views before they render (ADR-074 stage 6): where each screen they link to
 * lives. A product never imports an app, so the app mounts `PayProvider`
 * around every Pay view, and the views read it through the hooks below. It is Outlets' mount (stage 5)
 * without the photographs or the shell: Pay's screens send no commands yet; they draw the rows the app hands them.
 */

/** The app's route for every screen a view may link to, by the registry's name for the screen. */
export type PayLinks = Readonly<Record<BoardId, string>>;

interface Mount {
  links: PayLinks;
}

const PayMount = createContext<Mount | null>(null);

/** Mounted by the app around a Pay view, with everything the view may not import. */
export function PayProvider({ links, children }: Mount & { children: ReactNode }) {
  return <PayMount value={{ links }}>{children}</PayMount>;
}

function useMount(): Mount {
  const mount = useContext(PayMount);
  if (!mount) throw new Error("A Pay view rendered outside PayProvider: the app must mount it around the view.");
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
