"use client";

import { createContext, useContext } from "react";

import { NO_STAFF_ACCESS, type StaffAccess } from "@injishi/contracts";

/**
 * The staff access the SERVER resolved, carried to the client chrome (ADR-053,
 * AC-A3).
 *
 * `StaffBoundary` reads `GET /api/v1/me/staff` on the server and renders this
 * with the answer, so the sidebar paints its first frame already filtered on the
 * real `permissions[]`. A store seeded by an effect would paint an empty or a
 * default nav first and correct it a frame later, and a sidebar that flashes a
 * Finance row it then withdraws has already disclosed it.
 *
 * It holds the server's answer and never a role turned into powers. Outside a
 * provider it reads as no access, so a component mounted somewhere unexpected
 * offers nothing rather than everything.
 */
const StaffAccessContext = createContext<StaffAccess>(NO_STAFF_ACCESS);

export function StaffAccessProvider({
  access,
  children,
}: {
  access: StaffAccess;
  children: React.ReactNode;
}) {
  return (
    <StaffAccessContext.Provider value={access}>{children}</StaffAccessContext.Provider>
  );
}

/** The permissions the server resolved for this staffer. */
export function useStaffPermissions(): StaffAccess["permissions"] {
  return useContext(StaffAccessContext).permissions;
}
