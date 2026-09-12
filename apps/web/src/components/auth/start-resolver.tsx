"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@injishi/ui";
import { fetchAccess, resolveDestination } from "@/lib/access";

/**
 * The arrival screen, and the Suspense fallback for it.
 *
 * ONE component for both, deliberately. `start/page.tsx` used to hand Suspense
 * `fallback={null}`, so the first thing anybody saw after typing a correct code
 * was an empty page, and then bold "Opening Injishi…" landed on top of it. A
 * person who has just signed in should see the product greet them, not a white
 * frame and a shout.
 *
 * No entrance animation on purpose: React swaps the fallback's DOM for the
 * resolver's own on hydration, and an animation would replay on that swap —
 * which is the flicker this is here to remove.
 */
export function StartArrival() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-tile text-center">
        <p className="text-base font-medium">Welcome back — opening Injishi</p>
        <p className="mt-2 text-sm text-muted-foreground">
          One moment while we take you where you were headed.
        </p>
      </div>
    </main>
  );
}

export default function StartResolver() {
  const params = useSearchParams();
  const requested = params.get("redirect");
  const [state, setState] = useState<"loading" | "unreachable">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState("loading");
    void fetchAccess().then((access) => {
      if (!live) return;
      if (access.status === "anonymous") {
        const back = new URLSearchParams({
          redirect: `/start${requested ? `?redirect=${encodeURIComponent(requested)}` : ""}`,
        });
        window.location.replace(`/sign-in?${back.toString()}`);
        return;
      }
      if (access.status === "unreachable") {
        setState("unreachable");
        return;
      }
      window.location.replace(resolveDestination(access, requested));
    });
    return () => {
      live = false;
    };
  }, [requested, attempt]);

  if (state === "loading") return <StartArrival />;

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-tile text-center">
        <p className="text-base font-medium">You&rsquo;re signed in.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Our service didn&rsquo;t answer just now, so we can&rsquo;t tell where to
          take you yet. Nothing is wrong with your sign-in.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
