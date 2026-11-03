import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfDecisionsView } from "@/features/oversight/PsfDecisionsView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfDecisions, readPsfScope } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfDecisions.pageTitle };

/** Membership decisions: every PSF membership the region approved or declined, newest first. */
export default async function PsfDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; outcome?: string; cursor?: string }>;
}) {
  await requirePersona("PsfDecisions");
  const { q = "", outcome: raw = "", cursor } = await searchParams;
  const outcome = raw === "approved" || raw === "declined" ? raw : undefined;
  const ctx = await requestContext();
  const [scope, page] = await Promise.all([readPsfScope(ctx), readPsfDecisions(ctx, { q, outcome, cursor })]);
  return <PsfDecisionsView scope={scope} page={page} q={q} outcome={outcome ?? ""} paged={Boolean(cursor)} />;
}
