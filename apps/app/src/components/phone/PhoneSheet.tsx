"use client";

import { Sheet } from "@heroui-pro/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { createPortal } from "react-dom";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Overlay host inside the device frame the calling screen renders in, so overlays cover the phone, not the browser
 * window (the artifact's scrim and bottom sheet sit inside the phone). Falls back to the document on a real phone,
 * where the frame is full-bleed.
 */
export function usePhoneOverlayHost() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setFrame(anchor.current?.closest<HTMLElement>("[data-device-frame]") ?? null);
  }, []);
  const portal = frame
    ? createPortal(
        <div
          ref={setHost}
          data-phone-overlay-host=""
          className="pointer-events-none absolute inset-0 z-50 overflow-hidden [transform:translateZ(0)] [&>*]:pointer-events-auto"
        />,
        frame,
      )
    : null;
  return { anchor: <span ref={anchor} hidden />, portal, host };
}

/**
 * Bottom sheet of a phone screen (artifact: .ij-scrim--bottom + .ij-sheet-bottom), built on the Pro Sheet and
 * portalled into the phone frame. Controlled: pass `isOpen` and `onOpenChange`.
 */
export function PhoneSheet({
  isOpen,
  onOpenChange,
  heading,
  description,
  media,
  centered = false,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: ReactNode;
  description?: ReactNode;
  /** Optional icon tile or photo above the heading. */
  media?: ReactNode;
  centered?: boolean;
  children: ReactNode;
}) {
  const { anchor, portal, host } = usePhoneOverlayHost();
  return (
    <>
      {anchor}
      {portal}
      <UNSAFE_PortalProvider getContainer={() => host}>
        <Sheet isOpen={isOpen} onOpenChange={onOpenChange} noBodyStyles>
          <Sheet.Backdrop>
            <Sheet.Content className="max-h-[calc(100%-24px)]">
              <Sheet.Dialog className="max-h-full">
                <Sheet.Handle />
                <Sheet.Header className={cx("gap-1 px-[20px] pt-[4px]", centered && "items-center text-center")}>
                  {media}
                  <Sheet.Heading className="text-[18px] leading-6 font-semibold">{heading}</Sheet.Heading>
                  {description ? <p className="text-[13px] leading-[18px] text-muted">{description}</p> : null}
                </Sheet.Header>
                <Sheet.Body
                  className={cx("flex flex-col gap-[14px] px-[20px] pt-[10px] pb-[22px]", centered && "items-center")}
                >
                  {children}
                </Sheet.Body>
              </Sheet.Dialog>
            </Sheet.Content>
          </Sheet.Backdrop>
        </Sheet>
      </UNSAFE_PortalProvider>
    </>
  );
}
