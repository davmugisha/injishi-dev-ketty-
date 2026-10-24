"use client";

import Link from "next/link";
import { BadgeCheck, CheckCircle2, ClipboardCheck, MessageSquareText, Printer, XCircle } from "lucide-react";
import { Button } from "@injishi/ui";

import { DocIdTicket } from "../doc-id-ticket";

/**
 * The moment the business is registered: the docID, which is all it keeps,
 * and what happens next. The docID was also texted to the contact phone, and
 * mailed when an email was given, so closing this page loses nothing.
 */
export function RegisterDone({
  docId,
  businessCode,
  businessName,
  feePaid,
  feeProblem,
  districtName,
}: {
  docId: string;
  businessCode: string | null;
  businessName: string;
  feePaid: boolean;
  feeProblem: string | null;
  districtName: string;
}) {
  const next = [
    { icon: ClipboardCheck, title: "PSF reviews it", body: `A PSF officer for ${districtName || "your district"} reads your application, usually within a week.` },
    { icon: BadgeCheck, title: "Approved: you are a member", body: "That day, for a year. We text you, and your certificate is on your tracking page." },
    { icon: XCircle, title: "Declined: PSF says why", body: "We text you the reason, and you can apply again. The membership fee is not refunded." },
  ];
  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text">
          <CheckCircle2 size={30} strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {feePaid ? `${businessName} is registered` : "Your application is saved"}
        </h1>
        <p className="max-w-[52ch] text-muted-foreground">
          {feePaid
            ? "Paid, and with PSF. Keep your docID: it is how you follow PSF's answer and print your certificate."
            : "The payment did not go through, so PSF has not received your application yet. Your docID keeps everything you typed: pay from the tracking page."}
        </p>
      </div>

      <DocIdTicket docId={docId} businessCode={businessCode} businessName={businessName} />

      {!feePaid && feeProblem ? (
        <p role="alert" className="rounded-card border border-warning/40 bg-warning/10 p-4 text-sm">
          {feeProblem}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-card border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center">
        <MessageSquareText size={20} aria-hidden className="shrink-0 text-accent-text" />
        <p className="flex-1 text-sm">We texted the docID to your phone. Screenshot this page or print the receipt to keep it.</p>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer size={15} aria-hidden /> Print receipt
        </Button>
      </div>

      <ol className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
        {next.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-2 rounded-card border border-border bg-card p-5">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <s.icon size={16} aria-hidden className="text-accent-text" /> Next {i + 1}
            </span>
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" variant="primary">
          <Link href={`/psf/track/${docId}`}>{feePaid ? "Track my application" : "Pay and send"}</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/psf">Back to PSF</Link>
        </Button>
      </div>
    </div>
  );
}
