"use client";

/**
 * The chrome of a staff phone screen: its sheet, toasts, title, action bar and tiles. HR's and PMS's phone
 * screens both draw with it, and a product never imports another product (ADR-074), so it lives here rather
 * than in either. A subpath, `@injishi/ui/phone`, never the barrel: the sheet is HeroUI Pro's, and the
 * barrel stays free of Pro.
 */
import { Toast } from "@heroui/react";
import { Sheet } from "@heroui-pro/react";
import { type ComponentPropsWithRef, type ReactNode, useEffect, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { createPortal } from "react-dom";
import { PhoneBody, PhoneTop } from "./device.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Renders an ItemCard as a native button — the documented ItemCard "Pressable" pattern
 * (docs/heroui/item-card.md), used where the whole card is one tap target.
 */
export function renderAsButton(props: ComponentPropsWithRef<"button">) {
  return <button type="button" {...props} />; // heroui-ok: ItemCard pressable pattern
}

/** Renders a Card as a <section> landmark (the artifact's cards are sections with their own heading). */
export function renderSection(props: ComponentPropsWithRef<"section">) {
  return <section {...props} />;
}

/** Renders a Card as an <article> (one request, one note). */
export function renderArticle(props: ComponentPropsWithRef<"article">) {
  return <article {...props} />;
}

/**
 * The phone frame this view renders in, so overlays stay inside the device
 * (the artifact's scrim and bottom sheet cover the phone, not the browser window).
 */
function usePhoneOverlayHost() {
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
          data-staff-overlay-host=""
          className="pointer-events-none absolute inset-0 z-50 overflow-hidden [transform:translateZ(0)] [&>*]:pointer-events-auto"
        />,
        frame,
      )
    : null;
  return { anchor: <span ref={anchor} hidden />, portal, host };
}

/**
 * Bottom sheet of a phone screen (artifact: .ij-scrim--bottom + .ij-sheet-bottom), built on the Pro Sheet
 * and portalled into the phone frame.
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
  /** Optional icon tile above the heading (PIN sheet). */
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

/**
 * Toasts of a staff phone screen, inside the phone frame and above the tab bar. Every refusal the API sends
 * back (`reported()`) and every "not available yet" is a toast, so a screen that toasts must render this.
 */
export function PhoneToasts() {
  const { anchor, portal, host } = usePhoneOverlayHost();
  return (
    <>
      {anchor}
      {portal}
      <UNSAFE_PortalProvider getContainer={() => host}>
        <Toast.Provider placement="bottom" className="bottom-[96px] w-[calc(100%-32px)] min-w-0" />
      </UNSAFE_PortalProvider>
    </>
  );
}

/** Action bar pinned above the tab bar (artifact: the surface row with a top hairline). */
export function PhoneActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center gap-[10px] bg-surface px-[16px] py-[10px] shadow-[0_-1px_0_var(--separator)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Phone header title block (artifact: h1 17px + muted 12px line). */
export function PhoneTitle({ title, sub, className }: { title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-1 flex-col", className)}>
      <h1 className="text-[17px] leading-6 font-semibold">{title}</h1>
      {sub ? <span className="text-xs leading-4 text-muted">{sub}</span> : null}
    </div>
  );
}

const TILE: Record<"success" | "warning" | "danger" | "accent", string> = {
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
};

/** Rounded tone tile holding a large icon (artifact: 48×48 soft square on result cards). */
export function ToneTile({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TILE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-[48px] shrink-0 items-center justify-center rounded-[16px] [&>svg]:size-6",
        TILE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A phone screen for a person with nothing on it yet (no room today, nothing to inspect, no open order): the
 * screen says so plainly instead of answering 404 or borrowing a sample record.
 */
export function NothingYet({ title, sub, message }: { title: string; sub?: string; message: string }) {
  return (
    <>
      <PhoneTop>
        <PhoneTitle title={title} sub={sub} />
      </PhoneTop>
      <PhoneBody>
        <p role="status" className="rounded-[14px] bg-surface p-[16px] text-[14px] leading-5 text-muted">
          {message}
        </p>
      </PhoneBody>
    </>
  );
}
