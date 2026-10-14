"use client";

import { screenByPath } from "@injishi/data";
import { DeviceFrame } from "@injishi/ui";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Tablet surfaces (POS 1194×834, kiosk 1024×768, kitchen display 1280×800): the artboard size
 * inside a device frame when the window is large enough, full-bleed otherwise.
 */
export function DeviceShell({ children }: { children: ReactNode }) {
  const screen = screenByPath(usePathname());
  const width = screen?.frame.width ?? 1194;
  const height = screen?.frame.height ?? 834;
  const [fullBleed, setFullBleed] = useState(false);
  useEffect(() => {
    const check = () => setFullBleed(window.innerWidth < width + 96 || window.innerHeight < height + 96);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [width, height]);
  return (
    <div data-fullbleed={fullBleed} className="contents">
      <FrameSwitch fullBleed={fullBleed} width={width} height={height} label={screen?.title}>
        {children}
      </FrameSwitch>
    </div>
  );
}

function FrameSwitch({
  fullBleed,
  width,
  height,
  label,
  children,
}: {
  fullBleed: boolean;
  width: number;
  height: number;
  label?: string;
  children: ReactNode;
}) {
  if (fullBleed) {
    return (
      <div
        role="region"
        data-device-frame="tablet"
        aria-label={label}
        className="flex h-dvh min-h-[600px] w-full flex-col overflow-hidden bg-background"
      >
        {children}
      </div>
    );
  }
  return (
    <DeviceFrame device="tablet" width={width} height={height} label={label}>
      {children}
    </DeviceFrame>
  );
}
