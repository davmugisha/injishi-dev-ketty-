import type { Metadata } from "next";

import { CardResendForm } from "@/components/psf/card-resend-form";

export const metadata: Metadata = {
  title: "Send your PSF card again",
  // The token is a key to one card request: keep it out of search and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** What the email opens when PSF sends a card back to fix (2026-11-05). */
export default async function PsfCardResendPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container py-12 lg:py-20">
      <div className="mx-auto max-w-narrow">
        <CardResendForm token={token ?? ""} />
      </div>
    </div>
  );
}
