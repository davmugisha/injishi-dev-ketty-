"use client";

import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";

import type { StepId } from "./register-steps";
import { formatRwf } from "./wizard-ui";

/**
 * Step 4, Review (ADR-075 S6): Business, You and Documents once, each with an
 * Edit that lands on the step that asked it, and the fee. No agreement and no
 * signature: the agreement is the owner's first step after approval (O-10, A3),
 * so Review's primary is "Continue to pay".
 *
 * Every answer stays editable until the fee is paid; then the details lock and
 * unlock only through Send back (AC-12).
 */

export interface ReviewRow {
  title: string;
  value: string;
  /** The step that asked, or null when nothing can change it any more. */
  step: StepId | null;
}

export function StepReview({
  rows,
  locked,
  onEdit,
  kindPhrase,
  fee,
}: {
  rows: ReviewRow[];
  /** The fee is paid: no Edit. */
  locked: boolean;
  onEdit: (step: StepId) => void;
  /** The kind mid sentence, with its article: "a coffee shop" (`kindInSentence`). */
  kindPhrase: string;
  fee: number | null;
}) {
  const t = useTranslations("registerForms.review");
  return (
    <>
      <dl className="flex flex-col divide-y divide-border rounded-card bg-secondary">
        {rows.map((row) => (
          <div key={row.title} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <dt className="text-sm font-semibold">{row.title}</dt>
              <dd className="break-words text-sm text-muted-foreground">{row.value}</dd>
            </div>
            {row.step && !locked ? (
              <Button variant="ghost" size="sm" onClick={() => row.step && onEdit(row.step)}>
                {t("change")}<span className="sr-only"> {row.title}</span>
              </Button>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1 rounded-card bg-secondary px-4 py-4">
        <span className="text-sm text-muted-foreground">{t("feeFor", { kind: kindPhrase })}</span>
        <span className="text-2xl font-semibold tabular-nums">{fee === null ? t("notAvailable") : formatRwf(fee)}</span>
        <span className="text-xs text-muted-foreground">{t("chargedOnce")}</span>
      </div>
    </>
  );
}
