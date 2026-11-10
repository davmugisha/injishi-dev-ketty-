"use server";

import { screenHref } from "@injishi/data";
import type { PayAmountInput } from "@injishi/product-hr";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { type NewAnnouncement, postAnnouncement, setAnnouncementShown } from "@/server/announcements";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { RETURN_NOTE } from "@/server/desk-view";
import { type AssetKindId, answerTicket, closeTicket, lendAsset, returnAsset } from "@/server/mutations/hr-desk";
import {
  addPayAmount as addPayAmountApi,
  buildPayFile as buildPayFileApi,
  claimReceipt,
  confirmPayRun as confirmPayRunApi,
  correctClockRecord,
  createLoan,
  decideClaim,
  fixStaffFile,
  holdPayslip as holdPayslipApi,
  type NewLoanInput,
  type PastRun,
  type PayClaimView,
  type PayLoansData,
  type PayrollContributionList,
  type PayrollSettingsView,
  preparePayRun as preparePayRunApi,
  readClaims,
  readContributions,
  readLoans,
  readPastRun,
  readPayrollSettings,
  recomputePayRun as recomputePayRunApi,
  type SetPayrollContributionRequest,
  type StaffFileFix,
  setContribution,
  setRssbEmployerNumber,
  submitPayRun as submitPayRunApi,
  validateClockRecord,
  withdrawPayRun as withdrawPayRunApi,
} from "@/server/mutations/payroll";
import { NoWorkspaceError } from "@/server/sources/types";

/** What a pay run action answers: done, or the API's refusal in words the board can show. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * A failed action in words for a toast: the API's refusal, an API that did not answer, or a person with no
 * business workspace. Anything else (a sign-in redirect) is rethrown for Next to handle.
 */
function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiError) return { ok: false, error: error.message };
  if (error instanceof ApiUnreachableError) {
    return { ok: false, error: "The Injishi service did not answer. Try again." };
  }
  if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
  throw error;
}

async function onBoard(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await requirePersona("PayRun");
    await run();
    return { ok: true };
  } catch (error) {
    return failure(error);
  } finally {
    revalidatePath(screenHref("PayRun"));
    revalidatePath(screenHref("PeopleHome"));
  }
}

/** HR computes the month's draft. */
export async function preparePayRun(period: string): Promise<ActionResult> {
  return onBoard(async () => preparePayRunApi(await requestContext(), period));
}

/** Compute the draft again, after a file was put right. */
export async function recomputePayRun(id: string): Promise<ActionResult> {
  return onBoard(async () => recomputePayRunApi(await requestContext(), id));
}

/** Pay a person next month, so everybody else is paid now. */
export async function holdPayslip(id: string, employeeId: string, reason: string): Promise<ActionResult> {
  return onBoard(async () => holdPayslipApi(await requestContext(), id, employeeId, reason));
}

/** Add or take off an amount for one person, then compute the draft again so the month shows it. */
export async function addPayAmount(input: PayAmountInput, key: string, runId: string | null): Promise<ActionResult> {
  return onBoard(async () => {
    const ctx = await requestContext();
    await addPayAmountApi(ctx, input, key);
    if (runId) await recomputePayRunApi(ctx, runId);
  });
}

/** HR hands the month to whoever confirms it. */
export async function submitPayRun(id: string, note: string | null): Promise<ActionResult> {
  return onBoard(async () => submitPayRunApi(await requestContext(), id, note));
}

/** HR takes the month back to change it, or whoever confirms sends it back with a reason. */
export async function withdrawPayRun(id: string, reason: string | null): Promise<ActionResult> {
  return onBoard(async () => withdrawPayRunApi(await requestContext(), id, reason));
}

/** Whoever confirms (the owner) freezes the month. */
export async function confirmPayRun(id: string): Promise<ActionResult> {
  return onBoard(async () => confirmPayRunApi(await requestContext(), id));
}

/** Build a payment file or a declaration, and answer the link to download it. */
export async function buildPayFile(
  id: string,
  kind: "bank" | "momo" | "paye" | "rssb",
): Promise<{ ok: true; url: string; leftOut: string[] } | { ok: false; error: string }> {
  try {
    await requirePersona("PayRun");
    const built = await buildPayFileApi(await requestContext(), id, kind);
    revalidatePath(screenHref("PayRun"));
    return { ok: true, url: built.url, leftOut: built.leftOut.map((p) => `${p.displayName}: ${p.reason}`) };
  } catch (error) {
    return failure(error);
  }
}

export type ContributionsResult = { ok: true; list: PayrollContributionList } | { ok: false; error: string };

/** The contributions on pay and this business's optional ones. */
export async function loadContributions(): Promise<ContributionsResult> {
  try {
    await requirePersona("PayrollRules");
    return { ok: true, list: await readContributions(await requestContext()) };
  } catch (error) {
    return failure(error);
  }
}

/** Switch an optional contribution on or off, or set the private insurer; the next run follows. */
export async function chooseContribution(
  code: string,
  body: SetPayrollContributionRequest,
): Promise<ContributionsResult> {
  try {
    await requirePersona("PayrollRules");
    const list = await setContribution(await requestContext(), code, body);
    revalidatePath(screenHref("PayRun"));
    return { ok: true, list };
  } catch (error) {
    return failure(error);
  }
}

export type PayrollSettingsResult = { ok: true; settings: PayrollSettingsView } | { ok: false; error: string };

/** The business's RSSB employer number, and whether this person may change it. */
export async function loadPayrollSettings(): Promise<PayrollSettingsResult> {
  try {
    await requirePersona("PayrollRules");
    return { ok: true, settings: await readPayrollSettings(await requestContext()) };
  } catch (error) {
    return failure(error);
  }
}

/** Record the RSSB employer number, from the month's blockers or from Payroll rules. */
export async function saveRssbEmployerNumber(value: string): Promise<ActionResult> {
  try {
    await requirePersona("PayrollRules");
    await setRssbEmployerNumber(await requestContext(), value.trim());
    revalidatePath(screenHref("PayRun"));
    revalidatePath(screenHref("PayrollRules"));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export type LoansResult = { ok: true; data: PayLoansData } | { ok: false; error: string };

/** The business's loans and advances, and who can be given one. */
export async function loadLoans(): Promise<LoansResult> {
  try {
    await requirePersona("PayRun");
    return { ok: true, data: await readLoans(await requestContext()) };
  } catch (error) {
    return failure(error);
  }
}

/** Record a loan or advance; each month's run takes an installment from then on. */
export async function recordLoan(input: NewLoanInput, key: string): Promise<ActionResult> {
  return onBoard(async () => createLoan(await requestContext(), input, key));
}

/** Put a blocker right on the person's file, then compute the draft again so the month sees it. */
export async function fixBlocker(employeeId: string, fix: StaffFileFix, runId: string | null): Promise<ActionResult> {
  return onBoard(async () => {
    const ctx = await requestContext();
    await fixStaffFile(ctx, employeeId, fix);
    if (runId) await recomputePayRunApi(ctx, runId);
  });
}

/** "2026-10-16" in Kigali for an instant. */
const kigaliDay = (at: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(at);

/**
 * Settle a clock record that stops the month: close it at a clock-out time ("HH:MM", Kigali; after
 * midnight when earlier than the clock-in) as a checked correction, or mark it checked; then
 * compute the draft again.
 */
export async function settleClockRecord(
  input: { kind: "out"; recordId: string; clockInAt: string; time: string } | { kind: "validate"; recordId: string },
  runId: string | null,
): Promise<ActionResult> {
  let outAt: Date | null = null;
  if (input.kind === "out") {
    const inAt = new Date(input.clockInAt);
    outAt = new Date(`${kigaliDay(inAt)}T${input.time}:00+02:00`);
    if (outAt <= inAt) outAt = new Date(outAt.getTime() + 86_400_000);
    if (outAt.getTime() > Date.now() + 5 * 60_000) return { ok: false, error: "That clock-out time has not come yet." };
  }
  return onBoard(async () => {
    const ctx = await requestContext();
    if (input.kind === "out" && outAt) {
      await correctClockRecord(ctx, input.recordId, {
        clockInAt: input.clockInAt,
        clockOutAt: outAt.toISOString(),
        note: "No clock-out; set from the pay run.",
      });
    } else await validateClockRecord(ctx, input.recordId);
    if (runId) await recomputePayRunApi(ctx, runId);
  });
}

export type PastRunResult = { ok: true; run: PastRun } | { ok: false; error: string };

/** A run of an earlier month, to read again: its totals and each payslip. */
export async function loadPastRun(id: string): Promise<PastRunResult> {
  try {
    await requirePersona("PayRun");
    return { ok: true, run: await readPastRun(await requestContext(), id) };
  } catch (error) {
    return failure(error);
  }
}

export type ClaimsResult = { ok: true; claims: PayClaimView[] } | { ok: false; error: string };

/** Every claim staff have made, for HR to follow and the owner to decide. */
export async function loadClaims(): Promise<ClaimsResult> {
  try {
    await requirePersona("PayRun");
    return { ok: true, claims: await readClaims(await requestContext()) };
  } catch (error) {
    return failure(error);
  }
}

/** The owner approves a claim into the next open month's pay, or declines it with a word why. */
export async function decidePayClaim(
  id: string,
  decision: "approve" | "reject",
  note: string | null,
): Promise<ActionResult> {
  return onBoard(async () => decideClaim(await requestContext(), id, decision, note));
}

/** A short-lived link to a claim's receipt. */
export async function openClaimReceipt(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requirePersona("PayRun");
    return { ok: true, url: await claimReceipt(await requestContext(), id) };
  } catch (error) {
    return failure(error);
  }
}

// ── Staff services: the help desk and things lent to staff ────────────────────────────────────

async function onServices(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await requirePersona("StaffServices");
    await run();
    return { ok: true };
  } catch (error) {
    return failure(error);
  } finally {
    revalidatePath(screenHref("StaffServices"));
    revalidatePath(screenHref("PeopleHome"));
  }
}

/** HR answers a question; with `close`, the answer resolves it. */
export async function answerHelpTicket(id: string, body: string, close: boolean): Promise<ActionResult> {
  return onServices(async () => answerTicket(await requestContext(), id, body.trim(), close));
}

/** HR resolves a question without another word. */
export async function closeHelpTicket(id: string): Promise<ActionResult> {
  return onServices(async () => closeTicket(await requestContext(), id));
}

/** Record an item lent to a person. */
export async function lendItem(input: {
  employeeId: string;
  kind: AssetKindId;
  name: string;
  tag: string;
  issuedOn: string;
  dueBackOn: string;
  note: string;
}): Promise<ActionResult> {
  return onServices(async () =>
    lendAsset(await requestContext(), {
      employeeId: input.employeeId,
      kind: input.kind,
      name: input.name.trim(),
      tag: input.tag.trim() || null,
      issuedOn: input.issuedOn,
      dueBackOn: input.dueBackOn || null,
      note: input.note.trim() || null,
    }),
  );
}

/** HR posts an announcement to the people it is for. */
export async function postAnnouncementAction(input: NewAnnouncement): Promise<ActionResult> {
  return onServices(async () => postAnnouncement(await requestContext(), input));
}

/** Take an announcement down, or put it back up. */
export async function setAnnouncementShownAction(id: string, shown: boolean): Promise<ActionResult> {
  return onServices(async () => setAnnouncementShown(await requestContext(), id, shown));
}

/** Record an item back today: in good shape, damaged, or lost (closed with that word). */
export async function returnItem(id: string, how: "good" | "damaged" | "lost", today: string): Promise<ActionResult> {
  const note = how === "good" ? null : RETURN_NOTE[how];
  return onServices(async () => returnAsset(await requestContext(), id, today, note));
}
