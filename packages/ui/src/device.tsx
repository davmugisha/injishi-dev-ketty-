import type { CSSProperties, ReactNode } from "react";

/**
 * Wraps a non-desktop surface in a device frame.
 * - phone: portrait 390×844 frame on larger screens, full-bleed on phones (≤520px wide).
 * - tablet: the artboard size (e.g. POS 1194×834), full-bleed when the window is not much larger.
 */
export function DeviceFrame({
  device,
  width,
  height,
  children,
  label,
}: {
  device: "phone" | "tablet";
  width: number;
  height: number;
  children: ReactNode;
  label?: string;
}) {
  const style = { "--device-w": `${width}px`, "--device-h": `${height}px` } as CSSProperties;
  return (
    <div className="device-stage" data-device-stage={device}>
      <div
        role="region"
        className="device-frame"
        data-device={device}
        data-device-frame={device}
        style={style}
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

/** Phone app header row (artifact: .ij-phone-top). */
export function PhoneTop({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={`flex shrink-0 items-center gap-2 px-4 pt-5 pb-2 ${className ?? ""}`}>{children}</header>;
}

/** Scrolling phone body (artifact: .ij-phone-body). */
export function PhoneBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}
