import type { PsfBandsView, PsfFormSetupView, PsfSplitRateView } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfSetupScreen } from "@/features/oversight/psf-setup-view";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";

export const metadata: Metadata = { title: screens.PsfSetup.pageTitle };

/** What the National Manager changes without a release: the split, the bands and the form. */
export default async function PsfSetupPage() {
  await requirePersona("PsfSetup");
  const ctx = await requestContext();
  const [split, bands, form] = await Promise.all([
    ctx.api.get<PsfSplitRateView>("/api/v1/oversight/psf/setup/split"),
    ctx.api.get<PsfBandsView>("/api/v1/oversight/psf/setup/bands"),
    ctx.api.get<PsfFormSetupView>("/api/v1/oversight/psf/setup/form"),
  ]);
  return <PsfSetupScreen split={split} bands={bands} form={form} />;
}
