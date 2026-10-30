import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfQueueView } from "@/features/oversight/PsfQueueView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfQueue, readPsfScope } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfConsole.pageTitle };

/** Membership applications waiting on PSF — same WorkspaceShell as /officer. */
export default async function PsfQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePersona("PsfConsole");
  const { q = "" } = await searchParams;
  const ctx = await requestContext();
  const [scope, page] = await Promise.all([readPsfScope(ctx), readPsfQueue(ctx, { q })]);
  return <PsfQueueView scope={scope} page={page} q={q} />;
}
