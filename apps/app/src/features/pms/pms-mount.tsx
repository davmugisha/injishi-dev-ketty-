"use client";

import { BOARDS, type BoardId, screenHref } from "@injishi/data";
import { stock } from "@injishi/data/media";
import type { PmsActions } from "@injishi/product-pms";
import {
  type PmsLinks,
  type PmsMedia,
  PmsProvider,
  type PmsShell,
  type TopbarStatusProps,
} from "@injishi/product-pms/web";
import type { ReactNode } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { createPackagesDraft, discardPackagesDraft } from "../commercial/PackagesActions";
import { discardRatesInventoryChange, scheduleRatesInventoryChange } from "../commercial/RatesInventoryActions";
import { sendRevenueChanges } from "../commercial/RevenueActions";
import {
  approveBookingRequest,
  assignArrivalRoom,
  cancelBooking,
  checkInGuest,
  checkInWalkIn,
  declineBookingRequest,
  recordNoShow,
} from "../frontdesk/actions";
import {
  actOnSignalAction,
  addCleaningTaskAction,
  addWorkOrderNoteAction,
  approveFoundItemDisposalAction,
  assignCleaningTaskAction,
  assignWorkOrderAction,
  createWorkOrderAction,
  decideRoomBlockAction,
  dismissSignalAction,
  inspectCleaningTaskAction,
  keepFoundItemAction,
  logFoundItemAction,
  openFoundItemClaimAction,
  releaseFoundItemAction,
  releaseRoomAction,
  remindEscalationAction,
} from "../operations/actions";
import { setHousekeepingTaskStatus } from "../platform/actions";
import {
  inspectRoomAction,
  logRoomFoundItemAction,
  moveRoomTaskAction,
  noteWorkOrderAction,
  reportProblemAction,
  resolveWorkOrderAction,
  sendMinibarCountAction,
  setRoomCheckAction,
  setWorkOrderTimerAction,
  startWorkOrderAction,
  uploadInspectionPhotoAction,
} from "../staff/actions";
import { checkOutGuest, postCharge, recordCash, replyToGuest, resendClaimCode, voidCharge } from "../stays/actions";

/*
 * What PMS's views may not import, handed to them by the app (ADR-074 stage 4). The views live in
 * `@injishi/product-pms`, and a product never imports an app, so every route that draws one wraps it in
 * `PmsMount`: the app's route for every screen (built from the screen registry, which keeps gating access until
 * the app takes access from the server), the server actions they send, the topbar pill they draw into, and the
 * demo photo library their rows name.
 */

const links: PmsLinks = Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)]));

const actions: PmsActions = {
  checkInWalkIn,
  assignArrivalRoom,
  checkInGuest,
  approveBookingRequest,
  declineBookingRequest,
  cancelBooking,
  recordNoShow,
  replyToGuest,
  postCharge,
  voidCharge,
  recordCash,
  resendClaimCode,
  checkOutGuest,
  addCleaningTaskAction,
  assignCleaningTaskAction,
  inspectCleaningTaskAction,
  remindEscalationAction,
  createWorkOrderAction,
  assignWorkOrderAction,
  addWorkOrderNoteAction,
  decideRoomBlockAction,
  releaseRoomAction,
  actOnSignalAction,
  dismissSignalAction,
  logFoundItemAction,
  openFoundItemClaimAction,
  releaseFoundItemAction,
  approveFoundItemDisposalAction,
  keepFoundItemAction,
  moveRoomTaskAction,
  setRoomCheckAction,
  sendMinibarCountAction,
  logRoomFoundItemAction,
  reportProblemAction,
  uploadInspectionPhotoAction,
  inspectRoomAction,
  startWorkOrderAction,
  setWorkOrderTimerAction,
  noteWorkOrderAction,
  resolveWorkOrderAction,
  setHousekeepingTaskStatus,
  createPackagesDraft,
  discardPackagesDraft,
  scheduleRatesInventoryChange,
  discardRatesInventoryChange,
  sendRevenueChanges,
};

const isBoard = (board: string): board is BoardId => (BOARDS as readonly string[]).includes(board);

/** The shell's pill, for a view that names its screen by string: a name the registry does not know links nowhere. */
function PmsTopbarStatus({ board, ...status }: TopbarStatusProps) {
  return <TopbarStatus {...status} board={board == null ? board : isBoard(board) ? board : null} />;
}

const shell: PmsShell = { TopbarStatus: PmsTopbarStatus };

const isStockKey = (key: string): key is keyof typeof stock => key in stock;

const media: PmsMedia = {
  photo(key) {
    if (isStockKey(key)) return stock[key];
    throw new Error(`The photo library has no photograph ${key}.`);
  },
  hasPhoto: isStockKey,
};

/** Mounts a PMS view: wrap it in this on every route that draws one. */
export function PmsMount({ children }: { children: ReactNode }) {
  return (
    <PmsProvider links={links} actions={actions} shell={shell} media={media}>
      {children}
    </PmsProvider>
  );
}
