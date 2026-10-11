"use client";

/**
 * What a payslip is made of, and its PDF (HR module — first pass, no ADR yet).
 *
 * The lines and the month's attendance ride on the payslip rows `ops.ts`
 * already reads; their shapes live here, beside the one thing that is not a
 * JSON read: the PDF, which the API hands back as a file.
 */

import { API_BASE, ApiError } from "./api";

/**
 * One line of a payslip, as it was stored when the payslip was computed. The
 * sides are main's names: what is earned, what is withheld from the employee,
 * and what the business adds on top.
 */
export interface PayslipLine {
  code: string;
  label: string;
  side: "earning" | "employee" | "employer";
  /** Whole francs. A negative earning is pay taken off: an absence. */
  amountRwf: number;
  /** How the figure was reached, in words a person can check. */
  basis: string | null;
}

/** What the roster and the clock said about the month the payslip pays for. */
export interface PayAttendance {
  rosteredDays: number;
  workedDays: number;
  /** Rostered shifts that started and that nobody clocked: unpaid. */
  missedDays: number;
  lateDays: number;
  unpaidLeaveDays: number;
  overtimeMinutes: number;
}

/** A PDF is drawn on request and can be several pages of somebody's pay: give it longer than a list read. */
const PDF_TIMEOUT_MS = 30_000;

/**
 * Fetch a payslip PDF and hand it to the browser as a download.
 *
 * Not a plain link: the route is behind the session cookie AND the workspace
 * header, and a link can carry only the first. So the file is read here, with
 * both, and saved from memory under the name the API gave it. A browser only
 * shows a page that name when the API's cross-origin rules expose the header,
 * so the caller passes the name to use when it cannot be read.
 */
export async function downloadPayslipPdf(workspaceId: string, path: string, fallbackName: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      headers: { "x-workspace-id": workspaceId },
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new ApiError(res.status, res.status === 404 ? "That payslip is no longer available." : "We couldn't make that PDF.");
  }

  const named = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = named?.[1] ?? fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}
