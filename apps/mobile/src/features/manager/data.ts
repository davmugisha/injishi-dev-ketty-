// The manager app's reads and writes, on the mock/api seam (PLAN.md, "Data seam"). No real manager
// call exists on the phone yet, so api mode shows "Not connected yet"; sample data mode answers from
// `mock-data.ts`, and deciding, reading and settings change it so every tab follows.

import { useAction, useSource } from "@/data/source";
import { kigaliTime } from "@/lib/kigali";
import {
  decide,
  emptyApprovals,
  emptyInbox,
  markRead,
  mockApproval,
  mockApprovals,
  mockFlash,
  mockInbox,
  mockMe,
  mockToday,
  resolve,
  setAlerts,
  setConfirmWith,
} from "./mock-data";
import type { ApprovalDetail, ConfirmWith, ManagerMe } from "./types";

/** Everything a decision or an inbox action changes: Today, the lists, the badges. */
const ALL: readonly (readonly unknown[])[] = [["manager"]];

function now(): string {
  return kigaliTime(Date.now());
}

export function useManagerToday() {
  return useSource(["manager", "today"], { mock: () => mockToday() });
}

export function useApprovals(opts?: { enabled?: boolean }) {
  return useSource(["manager", "approvals"], { mock: () => mockApprovals(), empty: () => emptyApprovals() }, opts);
}

/** One request with its evidence; without an id, the prototype's refund. */
export function useApproval(id: string | undefined) {
  return useSource(["manager", "approval", id ?? "default"], { mock: () => mockApproval(id) });
}

/** Approve or decline a waiting request (the decline carries its reason). */
export function useDecide() {
  return useAction<{ id: string; approve: boolean; reason?: string }, ApprovalDetail | null>({
    mock: (input) => decide({ ...input, at: now() }),
    invalidates: ALL,
  });
}

export function useManagerInbox(opts?: { enabled?: boolean }) {
  return useSource(["manager", "inbox"], { mock: () => mockInbox(), empty: () => emptyInbox() }, opts);
}

/** Opened (an id), or the double tick: everything read. */
export function useMarkInboxRead() {
  return useAction<string | undefined>({ mock: (id) => markRead(id), invalidates: ALL });
}

/** The one thing an alert asks for, done from the inbox. */
export function useResolveInboxItem() {
  return useAction<string>({ mock: (id) => resolve({ id, at: now() }), invalidates: ALL });
}

export function useFlash() {
  return useSource(["manager", "flash"], { mock: () => mockFlash() });
}

export function useManagerMe() {
  return useSource(["manager", "me"], { mock: () => mockMe() });
}

export function useSetConfirmWith() {
  return useAction<ConfirmWith>({ mock: (value) => setConfirmWith(value), invalidates: [["manager", "me"]] });
}

export function useSetAlerts() {
  return useAction<Partial<ManagerMe["alerts"]>>({
    mock: (input) => setAlerts(input),
    invalidates: [["manager", "me"]],
  });
}
