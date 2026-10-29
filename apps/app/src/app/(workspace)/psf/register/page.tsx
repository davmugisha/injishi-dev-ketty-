import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfRegisterView } from "@/features/oversight/PsfRegisterView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfBusinesses, readPsfRegisterSummary, readPsfScope, type PsfStanding } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfRegister.pageTitle };

const STANDINGS = new Set<PsfStanding>(["waiting", "member", "lapsed", "declined"]);

/** Member register — same WorkspaceShell as /officer/delegated. */
export default async function PsfRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; standing?: string }>;
}) {
  await requirePersona("PsfRegister");
  const { q = "", standing: raw = "" } = await searchParams;
  const standing = STANDINGS.has(raw as PsfStanding) ? (raw as PsfStanding) : undefined;
  const ctx = await requestContext();
  const [scope, summary, page] = await Promise.all([
    readPsfScope(ctx),
    readPsfRegisterSummary(ctx),
    readPsfBusinesses(ctx, { q, standing }),
  ]);
  return <PsfRegisterView scope={scope} summary={summary} page={page} q={q} standing={standing ?? ""} />;
}
