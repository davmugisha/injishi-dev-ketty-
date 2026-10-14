import type { ReactNode } from "react";
import { DeviceShell } from "@/components/shell/DeviceShell";

/** Tablet surfaces: POS, kitchen display and the clock-in kiosk. */
export default function DeviceLayout({ children }: { children: ReactNode }) {
  return <DeviceShell>{children}</DeviceShell>;
}
