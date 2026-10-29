import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PsfApplicationView } from "@/features/oversight/PsfApplicationView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfApplication } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfApplication.pageTitle };

/** One membership application — approve / decline in the same portal as registrations. */
export default async function PsfApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePersona("PsfApplication");
  const { id } = await params;
  const app = await readPsfApplication(await requestContext(), id);
  if (!app) notFound();
  return <PsfApplicationView initial={app} />;
}
