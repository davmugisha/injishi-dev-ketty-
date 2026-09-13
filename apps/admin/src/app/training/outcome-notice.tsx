"use client";

import type { ToastTone } from "@injishi/ui";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";

/**
 * The last write's answer, kept on the screen that asked (ADR-049 Training).
 *
 * A TOAST IS NOT ENOUGH HERE, and the reason is the sentences these writes
 * carry. "3 draft sessions are now blocked from publishing" (retiring a venue)
 * and "That venue is retired. Pick one that is still in use." (a refusal) are
 * things a staffer acts on, and a toast that dismisses itself after a few
 * seconds takes the instruction away while they are still reading it. So each
 * Training form keeps its answer in place until the next write replaces it,
 * and still toasts for somebody looking elsewhere on the page.
 *
 * `role="alert"` for a refusal, `status` otherwise: a screen reader interrupts
 * for "nothing changed" and waits politely for "saved".
 *
 * The tone is carried by an ICON as well as its colour, so it survives a
 * colour-blind eye; the text stays the foreground colour on a neutral ground,
 * which is what keeps it inside `ground-foreground-agreement`.
 */
export interface Notice {
  message: string;
  tone: ToastTone;
}

export function OutcomeNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const refused = notice.tone === "danger" || notice.tone === "warning";
  const Icon =
    notice.tone === "success"
      ? CircleCheck
      : notice.tone === "danger"
        ? CircleX
        : notice.tone === "warning"
          ? TriangleAlert
          : Info;
  const iconTone =
    notice.tone === "success"
      ? "text-success"
      : notice.tone === "danger"
        ? "text-destructive"
        : notice.tone === "warning"
          ? "text-warning"
          : "text-muted-foreground";

  return (
    <div
      role={refused ? "alert" : "status"}
      data-outcome={notice.tone}
      className="animate-arrive mt-4 flex items-start gap-2 rounded-card border border-border bg-field p-4 text-sm"
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconTone}`} aria-hidden />
      <p className="max-w-read leading-6">{notice.message}</p>
    </div>
  );
}
