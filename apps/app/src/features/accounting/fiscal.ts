import type { FiscalQueueItem, FiscalStatus, LogEntry, Tone } from "@injishi/data/fixtures/accounting";

/** Chip label and tone for each fiscal document state (artifact: FiscalReceipts CH). */
export const FISCAL_STATUS: Record<FiscalStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  unknown: { label: "Unknown — checking with provider", tone: "default" },
  rejected: { label: "Rejected", tone: "danger" },
  issued: { label: "Issued", tone: "success" },
  draft: { label: "Draft — issues at folio close", tone: "default" },
  notFiscal: { label: "Not a fiscal document", tone: "default" },
  billing: { label: "Billing only", tone: "default" },
};

/** A queue document with what happened to it in this session (retries, status queries, resubmissions). */
export interface QueueRow extends FiscalQueueItem {
  current: FiscalQueueItem["status"];
  attemptsNow: number;
  request: string;
  history: LogEntry[];
}

export interface QueueActivity {
  retried: Record<string, boolean>;
  asked: Record<string, boolean>;
  resubmitted: Record<string, boolean>;
}

/**
 * Apply the session's actions to the queue, as the artifact does: every retry and status query
 * reuses the original request ID; a resubmission after a correction is a new request.
 */
export function buildQueueRows(items: FiscalQueueItem[], activity: QueueActivity): QueueRow[] {
  return items.map((r) => {
    let current = r.status;
    let attemptsNow = r.attempts;
    let request = r.requestId;
    const history: LogEntry[] = r.log.map((l) => ({ ...l }));
    const quiet = () => {
      for (const l of history) if (l.status === "current") l.status = "default";
    };
    if (activity.resubmitted[r.id]) {
      quiet();
      current = "pending";
      attemptsNow = 1;
      request = r.requestId.replace(/\d+$/, (d) => String(Number(d) + 29).padStart(d.length, "0"));
      history.push({
        status: "current",
        title: "10:14 · New request",
        detail: "Resubmitted after correction · waiting for the VSDC",
      });
    }
    if (activity.asked[r.id]) {
      quiet();
      history.push({
        status: "current",
        title: "10:11 · Status query 2",
        detail: `Asked the provider whether ${request} was signed`,
      });
    }
    if (activity.retried[r.id]) {
      quiet();
      attemptsNow += 1;
      history.push({
        status: "current",
        title: `10:12 · Attempt ${attemptsNow}`,
        detail: `Sent again with ${request} · waiting for the VSDC`,
      });
    }
    return { ...r, current, attemptsNow, request, history };
  });
}
