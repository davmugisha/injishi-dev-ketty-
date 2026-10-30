"use client";

import { BOARDS, type BoardId, screenHref } from "@injishi/data";
import { stock } from "@injishi/data/media";
import {
  type OutletsLinks,
  type OutletsMedia,
  OutletsProvider,
  type OutletsShell,
  type TopbarStatusProps,
} from "@injishi/product-outlets/web";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { TopbarStatus } from "@/components/shell/TopbarStatus";

/*
 * What Outlets' views may not import, handed to them by the app (ADR-074 stage 5). The views live in
 * `@injishi/product-outlets`, and a product never imports an app, so every route that draws one wraps it in
 * `OutletsMount`: the app's route for every screen (built from the screen registry, which keeps gating access
 * until the app takes access from the server), the topbar pill and the brand mark they draw into, and the demo
 * photo library their rows name. PMS's mount (`../pms/pms-mount.tsx`) is the same with commands added.
 */

const links: OutletsLinks = Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)]));

const isBoard = (board: string): board is BoardId => (BOARDS as readonly string[]).includes(board);

/** The shell's pill, for a view that names its screen by string: a name the registry does not know links nowhere. */
function OutletsTopbarStatus({ board, ...status }: TopbarStatusProps) {
  return <TopbarStatus {...status} board={board == null ? board : isBoard(board) ? board : null} />;
}

const shell: OutletsShell = { TopbarStatus: OutletsTopbarStatus, BrandMark };

const isStockKey = (key: string): key is keyof typeof stock => key in stock;

const media: OutletsMedia = {
  photo(key) {
    if (isStockKey(key)) return stock[key];
    throw new Error(`The photo library has no photograph ${key}.`);
  },
  hasPhoto: isStockKey,
};

/** Mounts an Outlets view: wrap it in this on every route that draws one. */
export function OutletsMount({ children }: { children: ReactNode }) {
  return (
    <OutletsProvider links={links} shell={shell} media={media}>
      {children}
    </OutletsProvider>
  );
}
