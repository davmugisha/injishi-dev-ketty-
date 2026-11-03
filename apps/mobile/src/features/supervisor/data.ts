// The supervisor app's reads and writes, on the mock/api seam (proto-ui, PLAN.md "Data seam"). No real
// call exists for these screens yet, so api mode answers "Not connected yet" until the API serves them.

import { useAction, useSource } from "@/data/source";
import {
  addFailPhoto,
  decide,
  emptyQueue,
  floorBoard,
  inspection,
  inspectionQueue,
  markCheck,
  release,
  returned,
  returnRoom,
  roomSheet,
  rush,
  team,
  undoReturn,
  waitingCount,
} from "./mock-data";
import type { CheckResult, FloorId, RushInput } from "./types";

/** Everything a supervisor write can change: the board, the queue, the sheets and the team all re-read. */
const ALL = [["supervisor"]] as const;

export function useFloorBoard(floor: FloorId) {
  return useSource(["supervisor", "floor", floor], { mock: () => floorBoard(floor) });
}

export function useRoomSheet(room: string) {
  return useSource(["supervisor", "room", room], { mock: () => roomSheet(room) });
}

/** Rush a room for its housekeeper, or hand it to someone with capacity; she gets a push. */
export function useRushRoom() {
  return useAction({ mock: (input: RushInput) => rush(input), invalidates: ALL });
}

export function useInspectionQueue() {
  return useSource(["supervisor", "queue"], { mock: () => inspectionQueue(), empty: () => emptyQueue() });
}

/** How many rooms wait for her inspection, for the Inspect tab's badge. */
export function useWaitingCount() {
  return useSource(["supervisor", "waiting"], { mock: () => waitingCount(), empty: () => 0 });
}

export function useInspection(room: string) {
  return useSource(["supervisor", "inspection", room], { mock: () => inspection(room) });
}

/** Pass or fail one check; the same answer again clears it. */
export function useMarkCheck() {
  return useAction({
    mock: (input: { room: string; id: string; result: CheckResult }) => markCheck(input),
    invalidates: ALL,
  });
}

/** The photo every failed check carries (the camera's stand-in in this build). */
export function useAddFailPhoto() {
  return useAction({ mock: (input: { room: string; id: string }) => addFailPhoto(input), invalidates: ALL });
}

export function useReleaseRoom() {
  return useAction({ mock: (room: string) => release(room), invalidates: ALL });
}

export function useReturnRoom() {
  return useAction({ mock: (room: string) => returnRoom(room), invalidates: ALL });
}

export function useUndoReturn() {
  return useAction({ mock: (room: string) => undoReturn(room), invalidates: ALL });
}

export function useReturnedRoom(room: string) {
  return useSource(["supervisor", "returned", room], { mock: () => returned(room) });
}

export function useTeamToday() {
  return useSource(["supervisor", "team"], { mock: () => team() });
}

/** Approve or decline a swap or a leave request; the person asking is told. */
export function useDecideRequest() {
  return useAction({
    mock: (input: { id: string; decision: "approved" | "declined" }) => decide(input),
    invalidates: ALL,
  });
}
