"use client";

import { create } from "zustand";
import { toastDwellMs, type Toast as UiToast, type ToastTone } from "@injishi/ui";
import { notBuilt } from "./not-built";
import type { DistrictKey, StaffRole } from "./types";

/* UI state only (architecture.md: Zustand for modals/active-scope state).
   Server data stays in the data layer; nothing here persists to the API. */

/* The shape `@injishi/ui`'s `Toaster` renders, so the list passes straight in.
   The id is a string there because the package does not know how an app mints
   them; a counter is fine here, spelled as a string. */
type Toast = UiToast;

interface AdminUiState {
  district: DistrictKey;
  /** A preview somebody CHOSE in the lens dialog; `null` follows the server's role (`useRoleLens`). */
  roleLens: StaffRole | null;
  roleLensLabel: string | null;
  viewAs: string | null;
  overrideOpen: boolean;
  roleLensOpen: boolean;
  toasts: Toast[];

  setDistrict: (district: DistrictKey) => void;
  setRoleLens: (role: StaffRole, label: string) => void;
  openRoleLens: () => void;
  closeRoleLens: () => void;
  openOverride: () => void;
  closeOverride: () => void;
  startViewAs: (name: string) => void;
  endViewAs: () => void;
  /** `tone` picks the icon and the dwell; the words must stand without it. */
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

let toastSeq = 0;

export const useAdminUi = create<AdminUiState>((set, get) => ({
  district: "all",
  // Never a role by default: a default rendered on the server gave a trainer the Super Admin sidebar.
  roleLens: null,
  roleLensLabel: null,
  viewAs: null,
  overrideOpen: false,
  roleLensOpen: false,
  toasts: [],

  setDistrict: (district) => set({ district }),
  setRoleLens: (roleLens, roleLensLabel) => set({ roleLens, roleLensLabel }),
  openRoleLens: () => set({ roleLensOpen: true }),
  closeRoleLens: () => set({ roleLensOpen: false }),
  openOverride: () => set({ overrideOpen: true }),
  closeOverride: () => set({ overrideOpen: false }),
  startViewAs: (name) => set({ viewAs: name }),
  endViewAs: () => set({ viewAs: null }),

  toast: (message, tone = "neutral") => {
    const id = String(++toastSeq);
    set({ toasts: [...get().toasts, { id, message, tone }] });
    // Timed to the words, not a constant. A fixed 2.6s took thirty-word
    // failure sentences off screen before anyone could read them.
    setTimeout(() => get().dismissToast(id), toastDwellMs(message, tone));
  },
  dismissToast: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/**
 * For an action whose screen or detail is not built yet: pressing it toasts
 * the action's contract instead. Use as `onClick={stubAction(contract)}`.
 *
 * It was the behaviour half of `StubButton`. ADR-040 moved the appearance half
 * onto the shared `Button` and deleted the component, so this is what is left.
 * It hands back a HANDLER rather than taking the click, because the contract
 * usually sits on one member of a union (`row.action.kind === "stub"`), and
 * TypeScript keeps that narrowing where the element renders but not inside an
 * inline `() => ...` written there.
 *
 * The SENTENCE comes from `notBuilt` in `lib/not-built.ts`, not from here. This
 * used to toast `<contract> — stub`, which told a staffer the button was a
 * placeholder but not that nothing had happened — and several of these sit
 * beside a dialog that has just collected a "note for the audit trail". There
 * is now one wording for "this does nothing yet", used both by this hook and by
 * the handlers that call `toast` directly, so the two cannot drift into a
 * weaker and a stronger version of the same admission.
 */
export function useStubAction(): (contract: string) => () => void {
  const toast = useAdminUi((s) => s.toast);
  return (contract) => () => toast(notBuilt(contract));
}
