"use client";

/**
 * Local copy of the pre-merge shared Toaster, so the restored PSF console can
 * keep its toast contract without depending on the retired `@injishi/ui` shadcn
 * surface. Portals to `document.body` (no NativeDialog stacking).
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@injishi/utils";

type ToastTone = "neutral" | "success" | "warning" | "danger";

type Toast = { id: string; message: string; tone?: ToastTone };

function toastDwellMs(message: string, tone: ToastTone = "neutral"): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  const reading = 1500 + words * 250;
  const weight = tone === "danger" || tone === "warning" ? 1500 : 0;
  return Math.min(10_000, Math.max(3_000, reading + weight));
}

const TONE_ICON: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  neutral: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const TONE_CLASS: Record<ToastTone, string> = {
  neutral: "border-line bg-card text-foreground",
  success: "border-ok/30 bg-ok-bg text-ok",
  warning: "border-warn/30 bg-warn-bg text-warn",
  danger: "border-bad/30 bg-bad-bg text-bad",
};

function usePresence(toasts: readonly Toast[]) {
  const [items, setItems] = React.useState<readonly Toast[]>(toasts);
  React.useEffect(() => {
    setItems(toasts);
  }, [toasts]);
  return items;
}

function Toaster({ toasts, className }: { toasts: readonly Toast[]; className?: string }) {
  const items = usePresence(toasts);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const region = (
    <div
      data-slot="toaster"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-[1000002] flex flex-col items-center gap-2 px-4",
        className,
      )}
    >
      {items.map((t) => {
        const tone = t.tone ?? "neutral";
        const Icon = TONE_ICON[tone];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex max-w-md items-start gap-2.5 rounded border px-3.5 py-2.5 text-sm shadow-panel",
              TONE_CLASS[tone],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
          </div>
        );
      })}
    </div>
  );

  return createPortal(region, document.body);
}

export { Toaster, toastDwellMs, type Toast, type ToastTone };
