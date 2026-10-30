import type { Metadata } from "next";
import { normalizePsfDocId } from "@injishi/contracts";

import { PsfTrack } from "@/components/psf/track/psf-track";

export const metadata: Metadata = {
  title: "Your PSF application",
  // A docID is a bearer key: keep its pages out of search and out of referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** One application, by its docID (the public PSF path, 2026-10-19). */
export default async function PsfTrackPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const id = normalizePsfDocId(decodeURIComponent(docId)) ?? decodeURIComponent(docId).toUpperCase();
  return (
    <div className="container">
      <PsfTrack docId={id} />
    </div>
  );
}
