"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { looksLikePsfNumber, normalizeBusinessCode, normalizePsfDocId } from "@injishi/contracts";

import { apiResultMessage } from "@/lib/api";
import { confirmPsfMember, fetchPsfTrack, lookupPsfMember } from "@/data/psf";

/**
 * "Track an application": one box that takes a docID however it is typed (lower case, no dashes, an O
 * for a zero) and opens its page, or, since 2026-11-02, a membership number as it is on the certificate.
 *
 * The membership number is printed on the certificate, so it opens nothing alone: a code goes by text to
 * the phone on file, and the code read back opens the page. A docID keeps opening it directly.
 *
 * A docID formats as you type, `PSF-7K3M-Q9XD`; a value with a slash or a space is a membership number,
 * and is left as typed.
 */
function formatAsTyped(raw: string): string {
  if (/[/\s]/.test(raw)) return raw.toUpperCase();
  // A business code (2026-11-02), `GIS-4K7Q-92` or an old `GIS0005`: three letters other than PSF, then a
  // dash or a digit. Left as typed, never made into a docID.
  const up = raw.toUpperCase();
  if (!up.startsWith("PSF") && (/^[A-Z]{3}[-\d]/.test(up) || normalizeBusinessCode(up))) return up;
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (s.startsWith("PSF")) s = s.slice(3);
  s = s.slice(0, 8);
  if (s.length === 0) return "";
  return s.length > 4 ? `PSF-${s.slice(0, 4)}-${s.slice(4)}` : `PSF-${s}`;
}

export function TrackForm({ autoFocus = false, initial = "" }: { autoFocus?: boolean; initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** A code was sent for a membership number: where to, and the token the code is checked against. */
  const [sent, setSent] = useState<{ token: string; to: string; filledIn: boolean } | null>(null);
  const [code, setCode] = useState("");

  const byNumber = async (raw: string) => {
    const res = await lookupPsfMember(raw);
    if (res.status !== "ok") return setError(apiResultMessage(res));
    if (res.data.status !== "code_sent") return setError(res.data.message);
    setSent({ token: res.data.lookupToken, to: res.data.sentTo, filledIn: Boolean(res.data.demoCode) });
    setCode(res.data.demoCode ?? "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The business's code: a code goes by text to the phone on file, as for a membership number.
      if (!value.toUpperCase().startsWith("PSF") && normalizeBusinessCode(value)) return await byNumber(value);
      const id = normalizePsfDocId(value);
      if (id) {
        // A membership number can share a docID's shape (PSF-0412-2019): a docID nobody has is tried as one.
        const found = looksLikePsfNumber(value) ? await fetchPsfTrack(id) : null;
        if (!found || found.status === "ok") return router.push(`/psf/track/${id}`);
        return await byNumber(value);
      }
      if (looksLikePsfNumber(value)) return await byNumber(value);
      setError("Type your docID (like PSF-7K3M-Q9XD), the membership number on your certificate (like PSF/GAS/2026/0001), or your business code (like GIS-4K7Q-92).");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!sent) return;
    setError(null);
    setBusy(true);
    const res = await confirmPsfMember(sent.token, code.trim());
    setBusy(false);
    if (res.status !== "ok") return setError(apiResultMessage(res));
    router.push(`/psf/track/${res.data.docId}`);
  };

  if (sent) {
    return (
      <form onSubmit={(e) => void confirm(e)} className="w-full" noValidate>
        <p className="text-sm font-semibold text-page-fg">We sent a code to {sent.to}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {sent.filledIn
            ? "Texts are not sent on this test setup, so we filled the code in for you."
            : "That is the phone on this membership's application. Type the 6 digits to open it."}
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4 focus-within:ring-2 focus-within:ring-accent-brand">
          <input
            aria-label="Code from the text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6 digits"
            className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-[0.4em] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-brand px-4 py-2 text-sm font-semibold text-accent-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Open
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setCode("");
            setError(null);
          }}
          className="mt-2 text-sm font-medium text-accent-text hover:underline"
        >
          Use another number
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full" noValidate>
      <label htmlFor="psf-track-input" className="text-sm font-semibold text-page-fg">
        Track with your docID, membership number or business code
      </label>
      <div
        className={[
          "mt-2 flex items-center gap-2 rounded-full border p-1.5 pl-4 transition-shadow focus-within:ring-2 focus-within:ring-accent-brand",
          "border-border bg-card",
          error ? "border-destructive" : "",
        ].join(" ")}
      >
        <Search size={18} aria-hidden className="shrink-0 text-muted-foreground" />
        <input
          id="psf-track-input"
          value={value}
          onChange={(e) => setValue(formatAsTyped(e.target.value))}
          placeholder="docID, membership number or business code"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "psf-track-error" : undefined}
          className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-brand px-4 py-2 text-sm font-semibold text-accent-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Track
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
      {error ? (
        <p id="psf-track-error" role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
