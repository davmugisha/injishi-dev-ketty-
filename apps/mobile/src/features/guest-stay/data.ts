// The guest stay screens' reads and writes, on the mock/api seam (proto-ui, PLAN.md "Data seam"). No real
// call exists for any of them yet, so api mode answers "Not connected yet" (`NotWiredError`) and each
// write fails the same way; mock mode plays the prototype's stay from `mock-data.ts`.

import { useAction, useSource } from "@/data/source";
import {
  addExperience,
  cancelBooking,
  claimStay,
  createRequest,
  markThreadRead,
  markUpdatesSeen,
  mockBill,
  mockBillPayment,
  mockBooking,
  mockChat,
  mockClaimedStay,
  mockClaimScan,
  mockEmptyBill,
  mockEmptyChat,
  mockEmptyInbox,
  mockEmptyMenu,
  mockEmptyRequests,
  mockExtras,
  mockInbox,
  mockKey,
  mockMenu,
  mockOrder,
  mockPrearrival,
  mockRequests,
  mockReview,
  payBill,
  placeOrder,
  redeemOffer,
  requestLateCheckout,
  saveInvoice,
  sendMessage,
  submitPrearrival,
  submitReview,
  unlockDoor,
} from "./mock-data";
import type { IdDocument, PayMethodId, QuickRequestId } from "./types";

const ROOT = "guest-stay";

// ---------- Inbox and chat

export function useInbox() {
  return useSource([ROOT, "inbox"], { mock: mockInbox, empty: mockEmptyInbox });
}

export function useMarkThreadRead() {
  return useAction({ mock: (thread: string) => markThreadRead(thread), invalidates: [[ROOT, "inbox"]] });
}

export function useMarkUpdatesSeen() {
  return useAction({ mock: () => markUpdatesSeen(), invalidates: [[ROOT, "inbox"]] });
}

export function useChatThread(thread: string) {
  return useSource([ROOT, "chat", thread], { mock: () => mockChat(thread), empty: () => mockEmptyChat(thread) });
}

export function useSendMessage() {
  return useAction({
    mock: (input: { thread: string; text: string }) => sendMessage(input),
    invalidates: [
      [ROOT, "chat"],
      [ROOT, "inbox"],
    ],
  });
}

// ---------- Requests

export function useRequests() {
  return useSource([ROOT, "requests"], { mock: mockRequests, empty: mockEmptyRequests });
}

export function useCreateRequest() {
  return useAction({
    mock: (kind: Exclude<QuickRequestId, "food">) => createRequest(kind),
    invalidates: [
      [ROOT, "requests"],
      [ROOT, "chat"],
    ],
  });
}

// ---------- Pre-arrival check-in

export function usePrearrival() {
  return useSource([ROOT, "prearrival"], { mock: mockPrearrival });
}

export function useSubmitPrearrival() {
  return useAction({
    mock: (input: { document: IdDocument; arrival: string; idAtDesk: boolean }) => submitPrearrival(input),
    invalidates: [[ROOT, "prearrival"]],
  });
}

// ---------- Digital key

export function useDigitalKey() {
  return useSource([ROOT, "key"], { mock: mockKey });
}

export function useUnlockDoor() {
  return useAction({ mock: () => unlockDoor(), invalidates: [[ROOT, "key"]] });
}

// ---------- Room service

export function useMenu() {
  return useSource([ROOT, "menu"], { mock: mockMenu, empty: mockEmptyMenu });
}

export function usePlaceOrder() {
  return useAction({
    mock: (cart: Record<string, number>) => placeOrder(cart),
    invalidates: [
      [ROOT, "order"],
      [ROOT, "menu"],
      [ROOT, "bill"],
    ],
  });
}

export function useRoomOrder() {
  return useSource([ROOT, "order"], { mock: mockOrder });
}

// ---------- Bill

export function useBill() {
  return useSource([ROOT, "bill"], { mock: mockBill, empty: mockEmptyBill });
}

export function useSaveInvoice() {
  return useAction({
    mock: (input: { company: string; tin: string }) => saveInvoice(input),
    invalidates: [[ROOT, "bill"]],
  });
}

export function useBillPayment() {
  return useSource([ROOT, "bill-pay"], { mock: mockBillPayment });
}

export function usePayBill() {
  return useAction({
    mock: (input: { amount: number; method: PayMethodId }) => payBill(input),
    invalidates: [
      [ROOT, "bill"],
      [ROOT, "bill-pay"],
    ],
  });
}

// ---------- Review

export function useReview() {
  return useSource([ROOT, "review"], { mock: mockReview });
}

export function useSubmitReview() {
  return useAction({
    mock: (input: { overall: number; categories: Record<string, number>; text: string }) => submitReview(input),
    invalidates: [[ROOT, "review"]],
  });
}

// ---------- Walk-in stay (G4)

export function useClaimScan() {
  return useSource([ROOT, "claim"], { mock: mockClaimScan });
}

export function useClaimStay() {
  return useAction({ mock: (code: string) => claimStay(code), invalidates: [[ROOT, "inbox"]] });
}

export function useClaimedStay() {
  return useSource([ROOT, "claimed"], { mock: mockClaimedStay });
}

// ---------- Extras (G5)

export function useExtras() {
  return useSource([ROOT, "extras"], { mock: mockExtras });
}

export function useRedeemOffer() {
  return useAction({ mock: () => redeemOffer(), invalidates: [[ROOT, "extras"]] });
}

export function useAddExperience() {
  return useAction({ mock: (id: string) => addExperience(id), invalidates: [[ROOT, "extras"]] });
}

export function useRequestLateCheckout() {
  return useAction({ mock: (time: string) => requestLateCheckout(time), invalidates: [[ROOT, "extras"]] });
}

// ---------- Change or cancel (G6)

export function useBooking() {
  return useSource([ROOT, "booking"], { mock: mockBooking });
}

export function useCancelBooking() {
  return useAction({ mock: () => cancelBooking(), invalidates: [[ROOT, "booking"]] });
}
