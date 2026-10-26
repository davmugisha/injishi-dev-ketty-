"use server";

import { screenHref } from "@injishi/data";
import type { ReportsPropertyId, ReportsTab } from "@injishi/data/fixtures/owner";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { OwnerRefusal, saveReportView } from "@/server/mutations/owner";

type SaveViewResult = { ok: true; name: string } | { ok: false; message: string };

/**
 * "Save view" on Reports: the tab and branch on screen become one of the owner's saved views
 * (`POST /ops/list-views`, list key `owner.reports`). A second view of the same name is refused by the API
 * (409), and that refusal is what the person reads.
 */
export async function saveReportsView(input: {
  tab: ReportsTab;
  property: ReportsPropertyId;
  propertyLabel: string;
}): Promise<SaveViewResult> {
  await requirePersona("Reports");
  try {
    const view = await saveReportView(await requestContext(), input);
    revalidatePath(screenHref("Reports"));
    return { ok: true, name: view.name };
  } catch (error) {
    if (error instanceof OwnerRefusal || error instanceof ApiError) return { ok: false, message: error.message };
    if (error instanceof ApiUnreachableError) {
      return { ok: false, message: "The Injishi service did not answer. Try again." };
    }
    throw error;
  }
}
