"use client";

import { Chip, Toast } from "@heroui/react";
import type { ResidentTone } from "@injishi/data/fixtures/resident";
import { toneColor } from "@injishi/ui";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { usePhoneOverlayHost } from "@/components/phone/PhoneSheet";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Renders a Card or ItemCard as a native button: the documented ItemCard "Pressable" pattern
 * (docs/heroui/item-card.md), used where the whole card is one tap target.
 */
export function renderButton(props: ComponentPropsWithRef<"button">) {
  return <button type="button" {...props} />; // heroui-ok: ItemCard pressable pattern
}

/** Renders a Card as a <section> landmark (the artifact's cards are sections with their own heading). */
export function renderSection(props: ComponentPropsWithRef<"section">) {
  return <section {...props} />;
}

/** Focus ring and reset for cards rendered as links or buttons. */
export const pressableCard =
  "cursor-pointer text-inherit no-underline outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus";

/** Phone header title block (artifact: 17px title over a muted 12px line; a span, not a heading). */
export function ResidentTitle({ title, sub, className }: { title: ReactNode; sub: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-1 flex-col", className)}>
      <span className="text-[17px] leading-[22px] font-semibold">{title}</span>
      <span className="text-[12px] leading-[16px] text-muted">{sub}</span>
    </div>
  );
}

/** Section heading of a phone screen (artifact: h2 15px/22px semibold). */
export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-[15px] leading-[22px] font-semibold">
      {children}
    </h2>
  );
}

const CIRCLE = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
} as const;

/** Soft status chip. `info` renders as accent, matching the design system. */
export function ToneChip({ tone, size, children }: { tone: ResidentTone; size?: "sm"; children: ReactNode }) {
  return (
    <Chip color={toneColor(tone)} variant="soft" size={size}>
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/** 56px round tone tile holding a 28px icon (artifact: the payment status circle). */
export function IconCircle({ tone, children }: { tone: keyof typeof CIRCLE; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-[56px] shrink-0 items-center justify-center rounded-full [&>svg]:size-[28px]",
        CIRCLE[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * Toasts of a phone screen, inside the phone frame and above the tab bar (artifact: .ij-toast at bottom 96px).
 * Show one with `toast()` from @heroui/react.
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

/** Saves a plain-text document (a payment receipt) to the device. */
export function downloadText(filename: string, lines: string[]) {
  const url = URL.createObjectURL(new Blob([`${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "078• ••• 412": the first three and last three digits of a phone number, as on the confirm sheet. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 7 ? phone : `${digits.slice(0, 3)}• ••• ${digits.slice(-3)}`;
}
