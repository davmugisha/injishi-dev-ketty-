"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { normalizePsfDocId } from "@injishi/contracts";

/**
 * "Track an application": one box that takes a docID however it is typed
 * (lower case, no dashes, an O for a zero) and opens its page.
 *
 * It formats as you type, `PSF-7K3M-Q9XD`, because a docID read off a text
 * message is easier to check against the screen in its printed shape.
 */
function formatAsTyped(raw: string): string {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = normalizePsfDocId(value);
    if (!id) {
      setError("A docID looks like PSF-7K3M-Q9XD. Check it on your receipt or the text message we sent.");
      return;
    }
    setError(null);
    setBusy(true);
    router.push(`/psf/track/${id}`);
  };

  return (
    <form onSubmit={submit} className="w-full" noValidate>
      <label htmlFor="psf-track-input" className="text-sm font-semibold text-page-fg">
        Track an application
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
          placeholder="PSF-XXXX-XXXX"
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
