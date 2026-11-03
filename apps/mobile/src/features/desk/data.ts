// The front desk's reads and writes, on the mock/api seam (proto-ui, PLAN.md "Data seam"). The desk
// has no real API call yet, so every hook omits `api`: in api mode the screens say "Not connected
// yet". Every write changes the sample day in `mock-data.ts` and reads the desk again.

import { useAction, useSource } from "@/data/source";
import {
  addSecondId,
  arrivalView,
  checkoutView,
  closeShift,
  confirmId,
  confirmPayment,
  emptyMoneyView,
  emptyTodayView,
  finishCheckIn,
  idCheckView,
  meView,
  moneyView,
  paymentWaitView,
  rackView,
  receiptView,
  requestBalance,
  requestCheckout,
  requestWalkIn,
  resendPrompt,
  saveSettings,
  sendReceipt,
  tentStepView,
  todayView,
  walkInFormView,
} from "./mock-data";
import type { CheckoutRequest, DeskSettings, PayMethod, RackNight, ShiftClose, WalkInRequest } from "./types";

/** Every desk write reads the whole desk again: a check-in moves Today, the rack and the money. */
const DESK = [["desk"]] as const;

// ------------------------------------------------------------------ reads

export function useDeskToday() {
  return useSource(["desk", "today"], { mock: todayView, empty: emptyTodayView });
}

/** `stayId` absent: the guest arriving now. */
export function useArrival(stayId: string | undefined) {
  return useSource(["desk", "arrival", stayId ?? ""], { mock: () => arrivalView(stayId) });
}

export function useIdCheck(stayId: string | undefined) {
  return useSource(["desk", "id-check", stayId ?? ""], { mock: () => idCheckView(stayId) });
}

export function useTentStep(stayId: string | undefined) {
  return useSource(["desk", "tent-step", stayId ?? ""], { mock: () => tentStepView(stayId) });
}

export function useWalkInForm() {
  return useSource(["desk", "walk-in"], { mock: walkInFormView });
}

/** `payId` absent: the walk-in prompt the prototype shows. */
export function usePaymentWait(payId: string | undefined) {
  return useSource(["desk", "payment", payId ?? ""], { mock: () => paymentWaitView(payId) });
}

export function useReceipt(payId: string | undefined) {
  return useSource(["desk", "receipt", payId ?? ""], { mock: () => receiptView(payId) });
}

export function useRack(night: RackNight) {
  return useSource(["desk", "rack", night], { mock: () => rackView(night) });
}

/** `stayId` absent: the guest leaving with a bill. */
export function useCheckout(stayId: string | undefined) {
  return useSource(["desk", "check-out", stayId ?? ""], { mock: () => checkoutView(stayId) });
}

export function useMoney() {
  return useSource(["desk", "money"], { mock: moneyView, empty: emptyMoneyView });
}

export function useDeskMe() {
  return useSource(["desk", "me"], { mock: meView });
}

// ------------------------------------------------------------------ writes

/** Check-in step 1: the ID matches the booking. */
export function useConfirmId() {
  return useAction({ mock: (stayId: string) => confirmId(stayId), invalidates: DESK });
}

/** The second adult's ID, photographed too. */
export function useAddSecondId() {
  return useAction({ mock: (stayId: string) => addSecondId(stayId), invalidates: DESK });
}

/** Check-in step 2: the guest is in the tent. */
export function useFinishCheckIn() {
  return useAction({
    mock: (input: { stayId: string; tent: string }) => finishCheckIn(input),
    invalidates: DESK,
  });
}

/** A MoMo prompt for a stay's balance; answers the payment's id. */
export function useRequestBalance() {
  return useAction({ mock: (stayId: string) => requestBalance(stayId), invalidates: DESK });
}

/** A walk-in booking and its prompt; answers the payment's id. */
export function useRequestWalkIn() {
  return useAction({ mock: (input: WalkInRequest) => requestWalkIn(input), invalidates: DESK });
}

/** Check-out: out now, paid in cash, or a prompt to wait for. */
export function useRequestCheckout() {
  return useAction({ mock: (input: CheckoutRequest) => requestCheckout(input), invalidates: DESK });
}

/** The guest approved and the provider confirmed (in the sample, a press), or cash instead. */
export function useConfirmPayment() {
  return useAction({
    mock: (input: { payId: string; method?: PayMethod }) => confirmPayment(input),
    invalidates: DESK,
  });
}

export function useResendPrompt() {
  return useAction({ mock: (payId: string) => resendPrompt(payId), invalidates: DESK });
}

export function useSendReceipt() {
  return useAction({ mock: (payId: string) => sendReceipt(payId), invalidates: DESK });
}

export function useCloseShift() {
  return useAction({ mock: (input: ShiftClose) => closeShift(input), invalidates: DESK });
}

export function useSaveDeskSettings() {
  return useAction({ mock: (next: Partial<DeskSettings>) => saveSettings(next), invalidates: DESK });
}
