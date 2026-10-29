"use client";

/**
 * The PSF Membership console (ADR-056). A static segment, so Next matches it
 * before `[console]`, and a boundary of its own: it admits the holder of a
 * `psf_membership_officer` posting and no one else.
 */
import type { ReactNode } from "react";

import { OfficerBoundary } from "@/pms/oversight/components/officer-boundary";

export default function MembershipLayout({ children }: { children: ReactNode }) {
  return <OfficerBoundary requires="membership">{children}</OfficerBoundary>;
}
