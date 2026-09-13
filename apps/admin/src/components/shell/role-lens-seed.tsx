"use client";

import { createContext, useContext } from "react";

import type { StaffRole } from "@injishi/contracts";

import { STAFF_ROLES } from "@/lib/nav";
import { useAdminUi } from "@/lib/store";

/**
 * Starts the staff-role lens on the roles the SERVER said this person holds.
 *
 * The lens stays a preview control. It is still NOT a route guard, and this
 * component does not make it one — it only starts on the truth. The identity is
 * `StaffAccess.permissions` from the server; the lens is a way of looking.
 *
 * THE ROLE ARRIVES IN THE SAME RENDER, through context, never in an effect.
 * This used to write the role into the store from a `useEffect`, over a store
 * default of `super_admin`. An effect only runs in the browser after hydration,
 * so the server rendered the sidebar with the default: the HTML sent to a
 * `trainer` carried "Super Admin" and a link to every section, and the first
 * paint showed them (found by the ADR-049 browser walk, 2026-09-13). Seeding the
 * global store during the server render is not the answer either: a Zustand
 * store is a module singleton on the server, shared by every request.
 *
 * So the store now holds only a CHOSEN preview (`null` until somebody picks one
 * in the lens dialog), and `useRoleLens` falls back to the server's role.
 */
const ServerRole = createContext<{ role: StaffRole; label: string } | null>(null);

export function RoleLensSeed({
  roles,
  children,
}: {
  roles: StaffRole[];
  children: React.ReactNode;
}) {
  // The first role the server listed. `roles` is an array because a staffer may
  // hold several; the lens shows one at a time and can be switched.
  const role = roles[0];
  // The wording comes from `STAFF_ROLES`, the same table the lens switcher
  // reads, so a seeded lens and a chosen one cannot be labelled differently.
  //
  // The label is the role and nothing else. The switcher appends "· 2FA on"
  // to its own labels; `StaffAccess` carries no second-factor fact about this
  // account, so a seeded label saying so would be the console asserting a
  // security property it never checked.
  const value = role
    ? { role, label: STAFF_ROLES.find((r) => r.key === role)?.label ?? role }
    : null;
  return <ServerRole.Provider value={value}>{children}</ServerRole.Provider>;
}

/** The lens in force: a preview somebody chose, else the role the server resolved. */
export function useRoleLens(): { role: StaffRole | null; label: string } {
  const server = useContext(ServerRole);
  const chosen = useAdminUi((s) => s.roleLens);
  const chosenLabel = useAdminUi((s) => s.roleLensLabel);
  if (chosen) return { role: chosen, label: chosenLabel ?? chosen };
  return { role: server?.role ?? null, label: server?.label ?? "" };
}
