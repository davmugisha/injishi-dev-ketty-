"use client";

import { useCallback, useEffect, useState } from "react";
import type { EbmReceipt } from "@injishi/contracts";
import { Button } from "@injishi/ui";

import { apiResultMessage } from "@/lib/api";
import { fetchReceipt } from "@/data/receipt";

import { ReceiptDocument } from "./receipt-document";
import { isSignedByRealDevice } from "./receipt-format";
import styles from "./receipt.module.css";
// Global print reset. Not a module: it has to reach `html` and `body`, which a
// pure-selector module may not. See the file for why.
import "./receipt-print.css";

/**
 * The screen at `/receipt/<booking reference>`.
 *
 * WHY THIS IS A CLIENT COMPONENT. `GET /api/v1/bookings/:reference/receipt` is
 * behind `SessionGuard`, and the session cookie belongs to the API origin
 * (:8000) while this app is served from :3000. Only a browser holds that
 * cookie, so only a browser can ask for a receipt on the caller's behalf; a
 * server component would fetch as nobody and be answered 401 every time.
 *
 * WHY EVERY BRANCH IS RENDERED. `ApiResult` has four outcomes and they mean
 * different things to a person holding a booking: sign in again, this receipt
 * is not yours or not ready, or we could not reach the server. Collapsing them
 * into one "something went wrong" is what turns a five-second problem into a
 * support ticket.
 */

type Screen =
  | { state: "loading" }
  | { state: "ready"; receipt: EbmReceipt }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "unreachable" };

export interface ReceiptScreenProps {
  /** The booking reference from the route, e.g. `BK-RBSV-XACM`. */
  reference: string;
}

export function ReceiptScreen({ reference }: ReceiptScreenProps) {
  const [screen, setScreen] = useState<Screen>({ state: "loading" });
  /** Bumped by the retry button; the effect keys off it and asks again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A guard against a late answer from a previous reference overwriting the
    // current one — the person navigated on, and the older request is stale.
    let current = true;
    setScreen({ state: "loading" });

    void fetchReceipt(reference).then((result) => {
      if (!current) return;
      switch (result.status) {
        case "ok":
          setScreen({ state: "ready", receipt: result.data });
          break;
        case "unauthenticated":
          setScreen({ state: "signed-out" });
          break;
        case "refused":
          setScreen({ state: "refused", message: result.message });
          break;
        case "failed":
          setScreen({ state: "unreachable" });
          break;
      }
    });

    return () => {
      current = false;
    };
  }, [reference, attempt]);

  const print = useCallback(() => {
    window.print();
  }, []);

  if (screen.state === "loading") {
    return (
      <div className={styles.screen}>
        <div className={styles.status} role="status">
          Loading the receipt for {reference}…
        </div>
        <div className={styles.skeleton} aria-hidden="true" />
      </div>
    );
  }

  if (screen.state === "signed-out") {
    return (
      <div className={styles.screen}>
        <div className={styles.status} role="status">
          <h1 className={styles.statusHeading}>Sign in to see this receipt</h1>
          <p>
            A receipt names the guest who paid, so it is only ever shown to
            them. Signing in again brings you straight back here.
          </p>
          <p>
            {/* A same-origin path, which `safeRedirect` accepts and which
                cannot be turned into an off-site destination. */}
            <Button asChild variant="primary">
              <a
                href={`/sign-in?redirect=${encodeURIComponent(`/receipt/${reference}`)}`}
              >
                Sign in
              </a>
            </Button>
          </p>
        </div>
      </div>
    );
  }

  if (screen.state === "refused") {
    return (
      <div className={styles.screen}>
        <div className={styles.status} role="status">
          <h1 className={styles.statusHeading}>No receipt for {reference}</h1>
          {/* The server's own sentence. It knows why — the booking is not this
              caller's, the stay was cancelled, the property has no registered
              TIN — and every one of those wants different words. */}
          <p>{screen.message}</p>
        </div>
      </div>
    );
  }

  if (screen.state === "unreachable") {
    return (
      <div className={styles.screen}>
        <div className={styles.status} role="status">
          <h1 className={styles.statusHeading}>We could not load the receipt</h1>
          <p>{apiResultMessage({ status: "failed" })}</p>
          <p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </p>
        </div>
      </div>
    );
  }

  const { receipt } = screen;

  return (
    <div className={styles.screen}>
      {/*
        Every other state on this screen has a heading; the successful one had
        none, because a receipt names itself in its own header. A reader
        navigating by headings landed on a page with zero of them.
      */}
      <h1 className={styles.srOnly}>
        RRA receipt for booking {receipt.bookingReference}
      </h1>

      {/*
        The screen-only twin of the warning printed on the paper itself. The
        printed one is the one that matters — it survives a screenshot — and
        this one says the same thing in ordinary prose to whoever is looking at
        the page right now.

        There is no way to dismiss it, on purpose. A closable warning on a
        document that looks like a tax invoice is a warning that will be closed.
      */}
      {isSignedByRealDevice(receipt) ? null : (
        <div className={styles.callout} role="note">
          <p className={styles.calloutHeading}>
            This is not a tax receipt yet
          </p>
          <p className={styles.calloutBody}>
            Injishi is not connected to the Rwanda Revenue Authority. This page
            reproduces the invoice layout the RRA prescribes for a Certified
            Invoicing System, but no certified device signed it: the SDC
            identifier, counters, internal data and signature on it are
            simulated. Keep it as your own record of the booking — it is not
            proof of tax paid and it will not be accepted as one.
          </p>
        </div>
      )}

      <div className={styles.toolbar}>
        <Button variant="primary" onClick={print}>
          Print receipt
        </Button>
      </div>

      <ReceiptDocument receipt={receipt} />
    </div>
  );
}
