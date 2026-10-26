"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@injishi/web-ui";

/**
 * What a screen says when it threw.
 *
 * One panel, used by every route group's `error.tsx`, so a page that breaks in
 * the marketplace and a page that breaks behind sign-in say the same thing in
 * the same voice. `(results)/explore/error.tsx` wrote this screen first and
 * wrote it well; this is that screen, made reusable rather than copied a fifth
 * time.
 *
 * THE VOICE IS NOT NEGOTIABLE HERE, because this is the moment a person is
 * most likely to conclude they did something wrong. The system owns the
 * failure, says what is still true (their work, their booking, their session),
 * and offers the way on. `ui-rules.md` § Do Nots: never show a raw error
 * message. `error.digest` is the server-side correlation id and is the one
 * thing worth printing, because support can look it up.
 *
 * It ARRIVES (`animate-arrive`) instead of appearing: bad news that snaps in
 * reads as a crash, and the half-second of travel is the difference between a
 * screen that broke and a screen that is telling you something.
 */
export function RouteFailure({
  error,
  reset,
  context,
  title,
  children,
  home = { href: "/", label: "Back to home" },
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  /** Where this happened, for the console. Never shown. */
  context: string;
  title: string;
  /** One or two sentences: own it, and say what is still true. */
  children: React.ReactNode;
  home?: { href: string; label: string };
}) {
  useEffect(() => {
    // The console is the only sink this app has today. When Sentry lands
    // (`[planned]` in library-docs.md) this is the call site that changes.
    console.error(context, error);
  }, [context, error]);

  return (
    <div className="mx-auto flex max-w-[46ch] animate-arrive flex-col items-center gap-4 px-5 py-24 text-center">
      <h1 className="text-2xl text-page-fg">{title}</h1>
      <p className="text-sm text-page-fg-70">{children}</p>

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {reset ? <Button onClick={reset}>Try again</Button> : null}
        <Button asChild variant="outline">
          <Link href={home.href}>{home.label}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/support">Contact support</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-2 text-xs text-page-fg-70">Reference for support: {error.digest}</p>
      ) : null}
    </div>
  );
}
