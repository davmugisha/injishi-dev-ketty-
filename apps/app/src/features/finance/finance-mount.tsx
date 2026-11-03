"use client";

import { BOARDS, type BoardId, screenHref } from "@injishi/data";
import {
  type FinanceLinks,
  FinanceProvider,
  type FinanceShell,
  type TopbarStatusProps,
} from "@injishi/product-finance/web";
import type { ReactNode } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";

/*
 * What Finance's views may not import, handed to them by the app (ADR-074 stage 6). The views live in
 * `@injishi/product-finance`, and a product never imports an app, so every route that draws one wraps it in
 * `FinanceMount`: the app's route for every screen (built from the screen registry, which keeps gating access
 * until the app takes access from the server) and the topbar pill they draw into. Outlets' mount
 * (`../outlets/outlets-mount.tsx`) is the same with photographs added.
 */

const links: FinanceLinks = Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)]));

const isBoard = (board: string): board is BoardId => (BOARDS as readonly string[]).includes(board);

/** The shell's pill, for a view that names its screen by string: a name the registry does not know links nowhere. */
function FinanceTopbarStatus({ board, ...status }: TopbarStatusProps) {
  return <TopbarStatus {...status} board={board == null ? board : isBoard(board) ? board : null} />;
}

const shell: FinanceShell = { TopbarStatus: FinanceTopbarStatus };

/** Mounts a Finance view: wrap it in this on every route that draws one. */
export function FinanceMount({ children }: { children: ReactNode }) {
  return (
    <FinanceProvider links={links} shell={shell}>
      {children}
    </FinanceProvider>
  );
}
