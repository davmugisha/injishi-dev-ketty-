"use client";

import { BOARDS, screenHref } from "@injishi/data";
import type { HrActions } from "@injishi/product-hr";
import { type HrLinks, HrProvider, type HrShell } from "@injishi/product-hr/web";
import type { ReactNode } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { signOut } from "@/lib/auth-actions";
import {
  decideCorrection,
  decideLeave,
  decideShiftSwap,
  publishRosterWeek,
  saveDeskEntry,
  setOffboardingStep,
  setRosterLent,
  setRosterShift,
} from "../people/actions";
import { askLeaveAction, cancelRequestAction } from "../staff/actions";

/*
 * What HR's views may not import, handed to them by the app (ADR-074 stage 3). The views live in
 * `@injishi/product-hr`, and a product never imports an app, so every route that draws one wraps it in
 * `HrMount`: the app's route for every screen (built from the screen registry, which keeps gating access until
 * stage 8), the server actions they send, and the topbar pill they draw into.
 */

const links: HrLinks = Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)]));

const actions: HrActions = {
  decideLeave,
  decideCorrection,
  saveDeskEntry,
  setOffboardingStep,
  setRosterShift,
  setRosterLent,
  publishRosterWeek,
  decideShiftSwap,
  askLeaveAction,
  cancelRequestAction,
  signOut,
};

const shell: HrShell = { TopbarStatus };

/** Mounts an HR view: wrap it in this on every route that draws one. */
export function HrMount({ children }: { children: ReactNode }) {
  return (
    <HrProvider links={links} actions={actions} shell={shell}>
      {children}
    </HrProvider>
  );
}
