import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PsfApplicationView } from "@/features/oversight/PsfApplicationView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfApplication, readRegistrationDocuments } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfApplication.pageTitle };

/** One membership application — approve / decline in the same portal as registrations. */
export default async function PsfApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePersona("PsfApplication");
  const { id } = await params;
  const ctx = await requestContext();
  const app = await readPsfApplication(ctx, id);
  if (!app) notFound();
  // A card holder's old PSF card (2026-11-02), for the District Manager to check before confirming.
  const doc = app.intake === "card_holder" ? (await readRegistrationDocuments(ctx, app.orgId))?.documents.find((d) => d.kind === "psf_certificate" && d.url) : null;
  return <PsfApplicationView initial={app} card={doc?.url ? { url: doc.url, mime: doc.mime } : null} />;
}
