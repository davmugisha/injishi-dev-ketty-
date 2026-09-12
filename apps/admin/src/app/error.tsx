"use client";

import { Button } from "@injishi/ui";
import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

/**
 * A staff screen that threw.
 *
 * THERE WAS NO ERROR BOUNDARY IN THIS APP, so anything a section threw took the
 * whole console to Next's own crash screen — a stack trace in development and a
 * blank refusal in production, with the sidebar gone. This keeps the chrome and
 * replaces only the panel.
 *
 * It OWNS the failure. Every read in this console is already returned as an
 * outcome rather than thrown (`lib/api/server.ts`), so reaching here means a
 * bug on our side, and the copy says exactly that: nothing the person did
 * caused it, and nothing was changed. No raw `error.message` is printed —
 * that is our text, not theirs, and it has said things like
 * "ECONNREFUSED 127.0.0.1:8000" to a compliance officer.
 *
 * `digest` is the one thing worth showing: it is the id Next puts in the server
 * log for this exact throw, so a staffer can quote it and an engineer can find
 * it. It is not an internal identifier about a person or a record.
 *
 * `reset()` re-renders the segment. It runs in a transition so the button can
 * wait visibly, which is also what stops the fourth press.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, startReset] = useTransition();

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="animate-arrive rounded-card border border-dashed border-border bg-field p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          This section
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold">
          This section didn&apos;t load
        </h1>
        <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
          Something on our side stopped it. Nothing you did caused this, and
          nothing was changed. Try it again — if it keeps happening, it needs an
          engineer rather than another press.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            pending={retrying}
            onClick={() => startReset(() => reset())}
          >
            <RotateCw className="size-4" aria-hidden />
            {retrying ? "Trying again…" : "Try again"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/overview">Back to the overview</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Quote this if you report it: <span className="money">{error.digest}</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
