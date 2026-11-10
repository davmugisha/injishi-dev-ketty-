/**
 * The HR report (058, HR reports): everything that took place at a business over a period, read
 * whole from `GET /ops/hr/report`. The shapes are the API's; people come in name order.
 */

import type {
  AttendanceFigures,
  AttendanceRow,
  HrReport,
  ReportEvent,
  ReportLeave,
  ReportPayMonth,
  ReportPerson,
} from "@injishi/product-hr";
import { ApiError } from "./api";
import type { SourceContext } from "./sources/types";

export type { AttendanceFigures, AttendanceRow, HrReport, ReportEvent, ReportLeave, ReportPayMonth, ReportPerson };

/** The report, or null when the person may not read it. */
export async function readHrReport(ctx: SourceContext, from: string, to: string): Promise<HrReport | null> {
  try {
    return await ctx.ops("hospitality").get<HrReport>("/api/v1/ops/hr/report", { query: { from, to } });
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return null;
    throw error;
  }
}
