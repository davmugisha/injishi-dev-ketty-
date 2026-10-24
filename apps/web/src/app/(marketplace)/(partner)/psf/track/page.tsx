import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Receipt, ShieldCheck } from "lucide-react";

import { TrackForm } from "@/components/psf/track-form";

export const metadata: Metadata = {
  title: "Track a PSF application",
  description: "Follow your PSF membership application with its docID.",
};

/** Where a docID is typed (the public PSF path, 2026-10-19). */
export default function PsfTrackLookupPage() {
  const hints = [
    { icon: MessageSquareText, text: "In the text message we sent when you registered." },
    { icon: Receipt, text: "On the receipt you printed or saved at the end of the form." },
    { icon: ShieldCheck, text: "It looks like PSF-7K3M-Q9XD. Keep it private." },
  ];
  return (
    <div className="container py-12 lg:py-20">
      <div className="mx-auto flex max-w-narrow flex-col gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Private Sector Federation</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Track your application</h1>
          <p className="mt-3 text-muted-foreground">
            Type your docID to see where your application stands, pay your membership once PSF approves it, and print your certificate.
          </p>
        </div>
        <div className="rounded-card border border-border bg-card p-5 shadow-sm sm:p-6">
          <TrackForm autoFocus />
        </div>
        <div>
          <p className="text-sm font-semibold">Where to find your docID</p>
          <ul className="mt-3 flex list-none flex-col gap-3 p-0">
            {hints.map((h) => (
              <li key={h.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <h.icon size={18} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Not registered yet?{" "}
          <Link href="/psf/register" className="font-medium text-accent-text underline-offset-4 hover:underline">
            Register your business
          </Link>
        </p>
      </div>
    </div>
  );
}
