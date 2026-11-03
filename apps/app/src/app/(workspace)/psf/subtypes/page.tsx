import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfSubtypesView } from "@/features/oversight/PsfSubtypesView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfScope, readPsfSubsectors } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfSubtypes.pageTitle };

/** The kinds of business and associations the public PSF form offers, by sector. */
export default async function PsfSubtypesPage() {
  await requirePersona("PsfSubtypes");
  const ctx = await requestContext();
  const [scope, view] = await Promise.all([readPsfScope(ctx), readPsfSubsectors(ctx)]);
  return <PsfSubtypesView scope={scope} initial={view} />;
}
