"use client";

import { Sheet } from "@heroui-pro/react";
import type { StockKey } from "@injishi/data/media";
import { stock } from "@injishi/data/media";
import { Photo } from "@injishi/ui";
import { type ComponentPropsWithRef, type ReactNode, useEffect, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { createPortal } from "react-dom";

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

/** A stock photo with an optional caption over its lower edge (artifact: .ij-photo with a caption). */
export function PhotoTile({
  image,
  caption,
  className,
  sizes = "390px",
  priority,
  children,
}: {
  image: StockKey;
  caption?: ReactNode;
  className?: string;
  sizes?: string;
  /** Above the fold on first paint (largest contentful paint). */
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <figure className={cx("relative m-0 overflow-hidden rounded-[18px] bg-surface-secondary", className)}>
      <Photo image={stock[image]} fill sizes={sizes} priority={priority} />
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-[10px] pt-[18px] pb-[8px] text-[12px] leading-4 font-medium text-white">
          {caption}
        </figcaption>
      ) : null}
      {children}
    </figure>
  );
}
