"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@injishi/ui";
import { leaveWaitlist } from "@/data/waitlist";
import { WAITLIST_UNSUBSCRIBE } from "@/data/waitlist-content";

/**
 * Leaving the waitlist (ADR-048 AC-12).
 *
 * IT POSTS BEHIND A BUTTON, and does not act on load. The API route is a POST
 * for the same reason: a mail client that prefetches links would otherwise
 * unsubscribe people who never clicked, and they would find out only when the
 * launch email never came.
 *
 * THE CONFIRMATION IS IDENTICAL for a known token, an unknown one, and one
 * already spent. There is deliberately no "that link was not recognised"
 * branch: any difference between those three answers turns this page into a way
 * to test whether an address is on the list, which is the exact disclosure the
 * unsubscribe link exists to protect people from. The server answers the same
 * way too, so this is not politeness layered over a leak.
 *
 * The one thing that IS reported differently is a transport failure, because it
 * is the only case where nothing happened and trying again is the right move.
 */
export function UnsubscribePanel({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);

  async function leave() {
    setWorking(true);
    setFailed(false);
    const ok = await leaveWaitlist(token);
    setWorking(false);
    if (ok) setDone(true);
    else setFailed(true);
  }

  if (done) {
    return (
      <>
        <h1
          className="text-2xl font-normal leading-[1.2] text-page-fg"
          role="status"
          aria-live="polite"
        >
          {WAITLIST_UNSUBSCRIBE.doneHeading}
        </h1>
        <p className="mt-3 text-base text-page-fg-70">
          {WAITLIST_UNSUBSCRIBE.doneBodyLead}
          <Link href="/waitlist" className="underline underline-offset-2">
            {WAITLIST_UNSUBSCRIBE.doneBodyLinkLabel}
          </Link>
          {WAITLIST_UNSUBSCRIBE.doneBodyTrail}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-normal leading-[1.2] text-page-fg">
        {WAITLIST_UNSUBSCRIBE.heading}
      </h1>
      <p className="mt-3 text-base text-page-fg-70">
        {WAITLIST_UNSUBSCRIBE.body}
      </p>

      {failed ? (
        <p
          role="alert"
          className="mt-4 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {WAITLIST_UNSUBSCRIBE.failed}
        </p>
      ) : null}

      <Button onClick={leave} disabled={working} className="mt-6">
        {WAITLIST_UNSUBSCRIBE.button}
      </Button>
    </>
  );
}
