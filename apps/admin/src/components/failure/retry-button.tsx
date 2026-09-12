"use client";

import { Button } from "@injishi/ui";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Ask the server for this screen again.
 *
 * `router.refresh()` rather than a full reload: the reads all happen during the
 * render, so re-rendering IS the retry, and it keeps the scroll position and
 * whatever is open in the chrome. It runs in a transition so the button can
 * wait visibly — a retry that looks like nothing happened is a retry pressed
 * four more times.
 *
 * If the read succeeds, the panel this sits in is replaced and the button goes
 * with it. So a button still mounted after a press means it did not work, and
 * saying so is the difference between a dead control and an honest one.
 */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, startRefresh] = useTransition();
  const [tried, setTried] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        pending={pending}
        onClick={() =>
          startRefresh(() => {
            setTried(true);
            router.refresh();
          })
        }
      >
        <RotateCw className="size-4" aria-hidden />
        {pending ? "Asking again…" : label}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {tried && !pending ? "Still the same answer. Give it a moment." : ""}
      </p>
    </div>
  );
}
