"use client";

import { useEffect } from "react";

import type { StaffRole } from "@injishi/contracts";

import { STAFF_ROLES } from "@/lib/nav";
import { useAdminUi } from "@/lib/store";

/**
 * Starts the staff-role lens on the roles the SERVER said this person holds.
 *
 * `roleLens` defaults to `super_admin` in the store. That was harmless while it
 * was only a sidebar filter and is not harmless now that a real person is
 * behind it: an `ops` staffer must not open the console wearing the highest
 * role in the system, even as a preview.
 *
 * The lens stays a preview control. It is still NOT a route guard, and this
 * component does not make it one — it only starts on the truth. The identity is
 * `StaffAccess.permissions` from the server; the lens is a way of looking.
 *
 * It renders nothing. It exists because `StaffBoundary` is a server component
 * and the store is a browser-only Zustand store, so the roles have to cross
 * that line as props and be applied by something on the other side. Writing
 * store state during a render would be a render side effect, which is why this
 * is an effect and not a call in the body.
 */
export function RoleLensSeed({ roles }: { roles: StaffRole[] }) {
  const setRoleLens = useAdminUi((s) => s.setRoleLens);

  // The first role the server listed. `roles` is an array because a staffer may
  // hold several; the lens shows one at a time and can be switched.
  const role = roles[0];

  useEffect(() => {
    if (!role) return;
    // The wording comes from `STAFF_ROLES`, the same table the lens switcher
    // reads, so a seeded lens and a chosen one cannot be labelled differently.
    //
    // The label is the role and nothing else. The switcher appends "· 2FA on"
    // to its own labels; `StaffAccess` carries no second-factor fact about this
    // account, so a seeded label saying so would be the console asserting a
    // security property it never checked.
    const label = STAFF_ROLES.find((r) => r.key === role)?.label ?? role;
    setRoleLens(role, label);
  }, [role, setRoleLens]);

  return null;
}
