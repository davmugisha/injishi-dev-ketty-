import type { ReactNode } from "react";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { currentPersona } from "@/lib/session";

/** Phone surfaces (staff and guest apps) in a portrait 390×844 frame. */
export default async function PhoneLayout({ children }: { children: ReactNode }) {
  const persona = await currentPersona();
  return <PhoneShell persona={persona}>{children}</PhoneShell>;
}

export const dynamic = "force-dynamic";
