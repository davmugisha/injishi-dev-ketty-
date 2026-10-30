import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PsfBusinessView } from "@/features/oversight/PsfBusinessView";
import { WEB_URL } from "@/lib/return-to";
import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  readPsfBusinessDetail,
  readPsfRegistrationProfile,
  readPsfScope,
  readRegistrationDocuments,
} from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfBusiness.pageTitle };

/**
 * One business in the manager's region (2026-10-30): what it is, who decided its registration and when,
 * its documents, whether guests can book it, and how it stands with PSF.
 */
export default async function PsfBusinessPage({ params }: { params: Promise<{ orgId: string }> }) {
  await requirePersona("PsfBusiness");
  const { orgId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) notFound();
  const ctx = await requestContext();
  const profile = await readPsfRegistrationProfile(ctx, orgId).catch((error: unknown) => {
    if (error instanceof ApiError && (error.notFound || error.forbidden)) return null;
    throw error;
  });
  if (!profile) notFound();
  const [scope, membership, documents] = await Promise.all([
    readPsfScope(ctx),
    readPsfBusinessDetail(ctx, orgId),
    readRegistrationDocuments(ctx, orgId),
  ]);
  return (
    <PsfBusinessView
      scope={scope}
      profile={profile}
      membership={membership}
      documents={documents?.documents ?? []}
      webUrl={WEB_URL}
    />
  );
}
