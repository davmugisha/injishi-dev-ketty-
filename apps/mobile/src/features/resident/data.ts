// The resident app's reads and writes, on the mock/api seam (`@/data/source`). Mock mode answers from
// `mock-data.ts`; no resident screen has a real call yet, so none has an `api` implementation and api
// mode shows "Not connected yet". Every write invalidates the whole `resident` tree: the screens are
// small, and a paid rent or a sent repair shows on Home, Pay, Requests and the tab bar at once.

import { useAction, useSource } from "@/data/source";
import {
  acceptDeductions,
  addHouseholdMember,
  answerDeduction,
  cancelVisitorCode,
  changeVisitWindow,
  confirmPayment,
  logEmergencyCall,
  markCodeSent,
  markNoticeRead,
  markRepairRead,
  mockBuilding,
  mockBuildingEmpty,
  mockConfirm,
  mockEmergency,
  mockHome,
  mockHousehold,
  mockLease,
  mockMe,
  mockMoveIn,
  mockMoveOut,
  mockPay,
  mockPayments,
  mockPaymentsEmpty,
  mockPending,
  mockReceipt,
  mockRenewal,
  mockRepairForm,
  mockRepairThread,
  mockRequests,
  mockRequestsEmpty,
  mockTabCounts,
  mockVisitorCode,
  photographRoom,
  requestStamp,
  resendPrompt,
  sendPaymentRequest,
  sendRepair,
  sendRepairMessage,
  setStandingPass,
  signRenewal,
  startPayment,
  takeRepairPhoto,
} from "./mock-data";
import type { DeductionStatus, NewMember, PayDraft, RepairInput, RepairPhoto } from "./types";

/** Every write changes what several screens show, so each one refreshes the whole app. */
const ALL = [["resident"]] as const;

// ── Reads ───────────────────────────────────────────────────────────────────

export function useResidentHome() {
  return useSource(["resident", "home"], { mock: mockHome });
}

export function useRentPayment() {
  return useSource(["resident", "pay"], { mock: mockPay });
}

export function usePaymentConfirm() {
  return useSource(["resident", "pay", "confirm"], { mock: mockConfirm });
}

export function usePendingPayment() {
  return useSource(["resident", "pay", "pending"], { mock: mockPending });
}

/** A receipt by payment id; without one, the newest payment's. */
export function useReceipt(id: string | undefined) {
  return useSource(["resident", "receipt", id ?? "latest"], { mock: () => mockReceipt(id) });
}

export function usePayments() {
  return useSource(["resident", "payments"], { mock: mockPayments, empty: mockPaymentsEmpty });
}

export function useRequests() {
  return useSource(["resident", "requests"], { mock: mockRequests, empty: mockRequestsEmpty });
}

export function useRepairForm() {
  return useSource(["resident", "repair-form"], { mock: mockRepairForm });
}

/** A repair's thread by id; without one, the open kitchen sink repair (the prototype's). */
export function useRepairThread(id: string | undefined) {
  return useSource(["resident", "repair", id ?? "WO-345"], { mock: () => mockRepairThread(id) });
}

export function useEmergency() {
  return useSource(["resident", "emergency"], { mock: mockEmergency });
}

export function useBuilding() {
  return useSource(["resident", "building"], { mock: mockBuilding, empty: mockBuildingEmpty });
}

/** A visitor code by id; without one, the code being made for Grace (the prototype's). */
export function useVisitorCode(id: string | undefined) {
  return useSource(["resident", "visitor", id ?? "new"], { mock: () => mockVisitorCode(id) });
}

export function useHousehold() {
  return useSource(["resident", "household"], { mock: mockHousehold });
}

export function useResidentMe() {
  return useSource(["resident", "me"], { mock: mockMe });
}

export function useLease() {
  return useSource(["resident", "lease"], { mock: mockLease });
}

export function useRenewal() {
  return useSource(["resident", "renewal"], { mock: mockRenewal });
}

export function useMoveIn() {
  return useSource(["resident", "move-in"], { mock: mockMoveIn });
}

export function useMoveOut() {
  return useSource(["resident", "move-out"], { mock: mockMoveOut });
}

/** The tab bar's counts: unread repair messages and new notices. */
export function useTabCounts() {
  return useSource(["resident", "tabs"], { mock: mockTabCounts });
}

// ── Writes: rent ────────────────────────────────────────────────────────────

/** Keeps what was chosen on Pay rent for Confirm payment. */
export function useStartPayment() {
  return useAction<PayDraft>({ mock: startPayment, invalidates: ALL });
}

/** Asks MTN (or Airtel) to prompt the phone. Returns the payment id. */
export function useSendPaymentRequest() {
  return useAction<void, string>({ mock: sendPaymentRequest, invalidates: ALL });
}

export function useResendPrompt() {
  return useAction<void, { number: string; expiresAt: string }>({ mock: resendPrompt, invalidates: ALL });
}

/** "I've approved, check now": the provider confirms. Returns the receipt's payment id. */
export function useConfirmPayment() {
  return useAction<void, string>({ mock: confirmPayment, invalidates: ALL });
}

export function useRequestStamp() {
  return useAction({ mock: requestStamp, invalidates: ALL });
}

// ── Writes: repairs ─────────────────────────────────────────────────────────

/** The camera, in mock mode: hands back the next sample photo. Nothing else changes. */
export function useTakeRepairPhoto() {
  return useAction<void, RepairPhoto>({ mock: takeRepairPhoto });
}

/** Sends a repair request. Returns its id, to open its thread. */
export function useSendRepair() {
  return useAction<RepairInput, string>({ mock: sendRepair, invalidates: ALL });
}

export function useSendRepairMessage() {
  return useAction<{ id: string; text?: string; photo?: boolean }>({ mock: sendRepairMessage, invalidates: ALL });
}

export function useMarkRepairRead() {
  return useAction<string>({ mock: markRepairRead, invalidates: ALL });
}

/** Notes a call made from the emergency screen, so management sees it. Returns the line to show. */
export function useLogEmergencyCall() {
  return useAction<string, string>({ mock: logEmergencyCall, invalidates: ALL });
}

// ── Writes: building and household ──────────────────────────────────────────

export function useMarkNoticeRead() {
  return useAction<string>({ mock: markNoticeRead, invalidates: ALL });
}

export function useChangeVisitWindow() {
  return useAction<{ id: string; window: string }>({ mock: changeVisitWindow, invalidates: ALL });
}

export function useCancelVisitorCode() {
  return useAction<string>({ mock: cancelVisitorCode, invalidates: ALL });
}

export function useMarkCodeSent() {
  return useAction<string>({ mock: markCodeSent, invalidates: ALL });
}

export function useSetStandingPass() {
  return useAction<boolean>({ mock: setStandingPass, invalidates: ALL });
}

export function useAddHouseholdMember() {
  return useAction<NewMember>({ mock: addHouseholdMember, invalidates: ALL });
}

// ── Writes: lease and moving ────────────────────────────────────────────────

/** Signs the renewal with the texted code. Fails when the code is not 6 digits. */
export function useSignRenewal() {
  return useAction<string>({ mock: signRenewal, invalidates: ALL });
}

export function usePhotographRoom() {
  return useAction<string>({ mock: photographRoom, invalidates: ALL });
}

export function useAnswerDeduction() {
  return useAction<{ id: string; status: DeductionStatus }>({ mock: answerDeduction, invalidates: ALL });
}

export function useAcceptDeductions() {
  return useAction({ mock: acceptDeductions, invalidates: ALL });
}
