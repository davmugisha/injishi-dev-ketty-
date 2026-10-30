// The send loop (mobile spec 0003, the outbox child). Each lane sends its oldest unsent row, one at a
// time, under the row's own account, workspace, branch and key, with this attempt's reported time. A
// second call while it runs joins it. A row waiting to retry stops its lane until it is due (D-ag); a
// signed out session or the step up stops every lane until the session resumes them.

import { api } from "@/lib/api";
import { learnServerDate, serverNow } from "@/lib/clock";
import { kigaliDate } from "@/lib/kigali";
import { queryClient } from "@/lib/query-client";
import { sessionEvents } from "@/lib/session-events";
import { newId } from "./ids";
import { kinds, LOCATION_FIELDS } from "./kinds";
import { notifyOutbox } from "./notify";
import { backoffMs, earliestDue, nextStep, outcomeOf, reportedTimeFor } from "./rules";
import { clearBackoffs, rowsOf, updateRow } from "./store";
import type { OutboxLane, OutboxRow } from "./types";

/** A random id for this app start: a row tapped in this process can be rebased on the monotonic timer. */
export const PROCESS_ID = newId();

export type SendTrigger = "start" | "online" | "active" | "try_now" | "enqueue" | "timer";

const LANES: readonly OutboxLane[] = ["main", "files"];

/** The account whose rows may be sent; null when nobody is signed in. Rows are sent only under it. */
let account: string | null = null;
/** Stopped by a 401 or the step up, until the session resumes the outbox. */
let halted = false;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The session says whose rows these are; null stops sending. */
export function setOutboxAccount(userId: string | null): void {
  account = userId;
  if (!userId) clearTimer();
}

/** The session is good again (signed in, or stepped up): send what waited. */
export function resumeOutbox(): void {
  halted = false;
  void sendOutbox("start");
}

/** Run the loop now. Signal coming back and "Try sending now" make every waiting row due at once (D-j). */
export function sendOutbox(trigger: SendTrigger): Promise<void> {
  if ((trigger === "online" || trigger === "try_now") && account) clearBackoffs(account);
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && !halted);
  })().finally(() => {
    running = null;
    scheduleRetry();
  });
  return running;
}

async function runOnce(): Promise<void> {
  for (const lane of LANES) {
    if (!account || halted) return;
    await drainLane(account, lane);
  }
}

async function drainLane(userId: string, lane: OutboxLane): Promise<void> {
  for (;;) {
    if (halted || account !== userId) return;
    const rows = rowsOf(userId);
    const step = nextStep(
      rows.filter((row) => row.lane === lane),
      (id) => rows.find((row) => row.id === id),
      Date.now(),
    );
    if (step.kind === "idle" || step.kind === "wait" || step.kind === "blocked") return;
    if (step.kind === "refuse_with_parent") {
      const parent = kinds[step.parent.kind]?.label(step.parent) ?? "an earlier change";
      updateRow(step.row.id, { state: "refused", serverMessage: `Not sent because ${parent} was refused` });
      notifyOutbox();
      continue;
    }
    const keepGoing = await attempt(step.row);
    if (!keepGoing) return;
  }
}

/** Send one row and record what the answer made of it. False stops the lane. */
async function attempt(row: OutboxRow): Promise<boolean> {
  const spec = kinds[row.kind];
  if (!spec) {
    // A kind this build no longer knows cannot be sent; it stays visible, never dropped.
    updateRow(row.id, { state: "refused", serverMessage: "This version of the app can't send this." });
    notifyOutbox();
    return true;
  }
  updateRow(row.id, { state: "sending" });
  notifyOutbox();
  const time = reportedTimeFor(row, { wallMs: Date.now(), monoMs: performance.now(), processId: PROCESS_ID });
  const { path, init } = spec.request(row, time);
  const answer = await api.request<unknown>(path, {
    ...init,
    idempotencyKey: row.id,
    workspaceId: row.workspaceId,
    branchId: row.branchId,
  });
  if (answer.status === "ok" || answer.status === "refused") learnServerDate(answer.serverDate);
  const today = kigaliDate(serverNow());
  const outcome = outcomeOf(answer, (refusal) => spec.alreadyDone(refusal, row, today));

  switch (outcome.type) {
    case "sent": {
      updateRow(row.id, {
        state: "sent",
        sentAt: Date.now(),
        serverAt: outcome.serverAt,
        serverMessage: outcome.note,
        result: outcome.result,
        // Once sent, nothing of where the phone was stays on it.
        payload: withoutLocation(row.payload),
        nextAttemptAt: null,
      });
      releaseDependents(row);
      notifyOutbox();
      for (const key of spec.refresh(row)) void queryClient.invalidateQueries({ queryKey: key });
      return true;
    }
    case "refused":
      updateRow(row.id, { state: "refused", serverMessage: outcome.message, nextAttemptAt: null });
      notifyOutbox();
      return true;
    case "retry": {
      const attempts = row.attempts + 1;
      updateRow(row.id, {
        state: "waiting_retry",
        attempts,
        nextAttemptAt: Date.now() + backoffMs(attempts),
        serverMessage: outcome.reason,
      });
      notifyOutbox();
      return false;
    }
    case "signed_out":
    case "step_up":
      updateRow(row.id, { state: "queued" });
      halted = true;
      notifyOutbox();
      if (outcome.type === "signed_out") sessionEvents.signedOut();
      else sessionEvents.stepUpRequired();
      return false;
  }
}

/** A sent parent lets the rows that waited on it go, handing its result to a kind that takes it. */
function releaseDependents(parent: OutboxRow): void {
  for (const child of rowsOf(parent.userId)) {
    if (child.dependsOn !== parent.id) continue;
    const adopt = kinds[child.kind]?.adoptParent;
    updateRow(child.id, { dependsOn: null, ...(adopt ? { payload: adopt(child.payload, parent.result) } : {}) });
  }
}

function withoutLocation(payload: Record<string, unknown>): Record<string, unknown> {
  const kept = { ...payload };
  for (const field of LOCATION_FIELDS) delete kept[field];
  return kept;
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Wake when the earliest waiting row is due, while the app is open (D-j). */
function scheduleRetry(): void {
  clearTimer();
  if (!account || halted) return;
  const due = earliestDue(rowsOf(account));
  if (due === null) return;
  timer = setTimeout(() => void sendOutbox("timer"), Math.max(0, due - Date.now()));
}
