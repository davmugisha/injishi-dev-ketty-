"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The docID as an object the business keeps: a card in the page's own
 * surfaces, the key printed large and, under a dashed rule, what it opens.
 *
 * The public PSF path (2026-10-19) gives a business nothing else to hold on to:
 * no account, no workspace. So the one thing it must keep is shown the way a
 * receipt shows a reference, big enough to read out over the phone, with the
 * business code beside it once the fee has paid for one.
 */
export function DocIdTicket({
  docId,
  businessCode,
  businessName,
  size = "lg",
}: {
  docId: string;
  businessCode?: string | null;
  businessName?: string;
  size?: "lg" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(docId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  const big = size === "lg";
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card text-page-fg">
      <div className={big ? "p-6 sm:p-8" : "p-5"}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">Your docID</p>
          <p className="text-xs font-medium uppercase tracking-widest text-accent-text">Private Sector Federation</p>
        </div>
        <p
          className={[
            "mt-3 font-mono font-semibold tracking-[0.12em] tabular-nums",
            big ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl",
          ].join(" ")}
          aria-label={`docID ${docId.split("").join(" ")}`}
        >
          {docId}
        </p>
        {businessName ? <p className="mt-2 text-sm text-page-fg-70">{businessName}</p> : null}
        <button
          type="button"
          onClick={copy}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy the docID"}
        </button>
      </div>
      {businessCode !== undefined ? (
        <>
          <div aria-hidden className="border-t border-dashed border-border" />
          <div className={big ? "flex items-center justify-between gap-4 bg-secondary px-6 py-5 sm:px-8" : "flex items-center justify-between gap-4 bg-secondary px-5 py-4"}>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-page-fg-70">Business code</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-widest">
                {businessCode ?? <span className="text-page-fg-70">Given when the fee is paid</span>}
              </p>
            </div>
            <p className="max-w-[22ch] text-right text-xs text-page-fg-70">
              Keep the docID private. Anyone who has it can see where your application stands.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
