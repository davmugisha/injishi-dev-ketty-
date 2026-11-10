"use client";

import { type ComponentType, createContext, type ReactNode, useContext } from "react";
import type { HrActions } from "../model/commands.ts";
import type { BoardId, HrFeatureId, Tone } from "../model/shared.ts";

/**
 * What an app hands HR's views before they render (ADR-074 stage 3): where each screen they link to lives,
 * the commands they may send, and the pieces of its own shell they draw into. A product never imports an
 * app, so the app mounts `HrProvider` around every HR view, and the views read it through the hooks below.
 */

/** The app's route for every screen a view may link to, by the registry's name for the screen. */
export type HrLinks = Readonly<Record<BoardId, string>>;

/** The status pill a view puts in the app's topbar (the roster's published state). */
export interface TopbarStatusProps {
  kind: "gate" | "chip";
  label: string;
  dot?: Tone;
  tone?: Tone;
}

/** The parts of the app's shell a view draws into. */
export interface HrShell {
  TopbarStatus: ComponentType<TopbarStatusProps>;
}

interface Mount {
  links: HrLinks;
  actions: HrActions;
  shell: HrShell;
  /** The optional features switched off for the business; absent means all on. */
  off?: readonly HrFeatureId[];
}

const HrMount = createContext<Mount | null>(null);

/** Mounted by the app around an HR view, with everything the view may not import. */
export function HrProvider({ links, actions, shell, off, children }: Mount & { children: ReactNode }) {
  return <HrMount value={{ links, actions, shell, off }}>{children}</HrMount>;
}

function useMount(): Mount {
  const mount = useContext(HrMount);
  if (!mount) throw new Error("An HR view rendered outside HrProvider: the app must mount it around the view.");
  return mount;
}

/** The link to a screen, by the registry's name for it. */
export function useBoardHref(): (board: BoardId) => string {
  const { links } = useMount();
  return (board) => {
    const href = links[board];
    if (href === undefined) throw new Error(`The app passed no link for the screen ${board}.`);
    return href;
  };
}

/** The commands this view may send. */
export function useHrActions(): HrActions {
  return useMount().actions;
}

/** Whether an optional feature is on for the business (Injishi staff switch them). */
export function useHrFeature(feature: HrFeatureId): boolean {
  return !(useMount().off ?? []).includes(feature);
}

/** The pieces of the app's shell this view draws into. */
export function useHrShell(): HrShell {
  return useMount().shell;
}
