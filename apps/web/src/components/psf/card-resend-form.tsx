"use client";

import { useEffect, useState } from "react";
import type { PsfClaimCardView } from "@injishi/contracts";
import { Button } from "@injishi/web-ui";

import { Field } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchPsfClaimCard, resendPsfClaimCard } from "@/data/psf";
import { apiResultMessage } from "@/lib/api";

/**
 * A card holder from Injishi's registration sending its card again (2026-11-05), by the signed link in
 * PSF's email. It has no docID until PSF confirms it, so the link is what opens this.
 */
export function CardResendForm({ token }: { token: string }) {
  const [view, setView] = useState<PsfClaimCardView | null>(null);
  const [problem, setProblem] = useState<string | null>(token ? null : "This link is not complete. Open it from PSF's email.");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetchPsfClaimCard(token).then((res) => {
      if (res.status === "ok") setView(res.data);
      else setProblem(apiResultMessage(res));
    });
  }, [token]);

  const send = async () => {
    if (!file) return setProblem("Add a photo or scan of your PSF card.");
    setBusy(true);
    setProblem(null);
    const res = await resendPsfClaimCard(token, file);
    setBusy(false);
    if (res.status === "ok") setSent(true);
    else setProblem(apiResultMessage(res));
  };

  if (sent) {
    return (
      <section className="rounded-card border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your card is with PSF</h1>
        <p className="mt-2 text-muted-foreground">Your District Manager checks it, usually within a week. We email you the answer.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-6 sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Private Sector Federation</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Send your PSF card again</h1>
        {view ? <p className="mt-2 text-muted-foreground">For {view.businessName}.</p> : null}
      </div>
      {view?.note ? (
        <p className="rounded-card bg-secondary p-3 text-sm">
          <span className="font-semibold">What to fix: </span>
          {view.note}
        </p>
      ) : null}
      {view ? (
        <>
          <Field label="Your PSF card" hint="A clear photo or scan, front side. PDF, JPEG or PNG, up to 10 MB." required>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <div>
            <Button variant="primary" size="lg" onClick={() => void send()} pending={busy} disabled={busy}>
              Send to PSF
            </Button>
          </div>
        </>
      ) : null}
      {problem ? (
        <p role="alert" className="rounded-card bg-destructive/10 p-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
