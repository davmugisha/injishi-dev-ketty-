"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Client UI state that survives navigation: the branch chosen per persona, accepted invitations. */
interface WorkspaceState {
  branchByPersona: Record<string, string>;
  acceptedInvites: Record<string, boolean>;
  setBranch: (personaId: string, branchId: string) => void;
  acceptInvite: (personaId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      branchByPersona: {},
      acceptedInvites: {},
      setBranch: (personaId, branchId) =>
        set((s) => ({ branchByPersona: { ...s.branchByPersona, [personaId]: branchId } })),
      acceptInvite: (personaId) => set((s) => ({ acceptedInvites: { ...s.acceptedInvites, [personaId]: true } })),
    }),
    { name: "injishi-workspace", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
