"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";

import { sessionDisplayName, useSessionUser } from "@/lib/session";
import { gateView, nextReconnectDelay } from "@/lib/session-reconnect";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** `navigator.onLine`, live. The server render assumes online. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Identity gate for the business-registration wizard (FL01).
 *
 * Registering a business creates an org and makes the registrant its owner —
 * the grant every later permission check resolves against (Spec 0004). The
 * prototype wizard shipped with no identity at all: any visitor could walk all
 * three steps, and the "Email" field on step 1 was a free-text box defaulted to
 * a fixture address, so the application carried whatever was typed rather than
 * who was applying. This is the front door.
 *
 * WHY CLIENT-SIDE. The Better Auth session cookie belongs to the API origin
 * (:8000), so the browser never sends it to the Next server (:3000) — a Server
 * Component cannot read it, and a server-side redirect is not available in this
 * cross-origin split. The gate therefore resolves the session in the browser,
 * exactly as the booking flow's step 1 does.
 *
 * It is an affordance, not the control. Every write the wizard makes is guarded
 * by `SessionGuard` on the API, and the registration routes check membership on
 * top of that. This gate exists so a person is not walked through three steps
 * before being told they are not signed in.
 *
 * WHAT CHANGED. This used to also mount `injishi-register.js` and write the
 * account email into that script's own field by hand. Both are gone: the wizard
 * is React now, it reads the identity from the session rather than from a form
 * field, and every answer it collects goes to the API.
 */
export default function RegisterGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSessionUser();
  const online = useOnline();
  const [failedRetries, setFailedRetries] = useState(0);
  const { status, refresh } = session;

  // Any answer at all ends the run, so the next outage gets the whole schedule.
  useEffect(() => {
    if (status !== "unreachable") setFailedRetries(0);
  }, [status]);

  // Coming back online is worth a fresh run, not the tail of a spent one.
  useEffect(() => {
    if (online) setFailedRetries(0);
  }, [online]);

  // Ask again on the schedule while we are online and it is not spent. Offline,
  // asking is pointless; the `online` event restarts the run instead.
  useEffect(() => {
    if (status !== "unreachable" || !online) return;
    const delay = nextReconnectDelay(failedRetries);
    if (delay === null) return;
    let live = true;
    const timer = setTimeout(() => {
      void refresh().then((next) => {
        if (live && next.status === "unreachable") setFailedRetries((n) => n + 1);
      });
    }, delay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [status, online, failedRetries, refresh]);

  // A press asks now, and only once that lookup settles does the schedule start
  // again behind it, so two lookups never race to write the session. Offline,
  // the schedule stays parked and the press is the only lookup:
  // `navigator.onLine` can be wrong, and a person who says try is owed a try.
  const [asking, setAsking] = useState(false);
  const tryAgain = () => {
    setAsking(true);
    void refresh().then(() => {
      setAsking(false);
      setFailedRetries(0);
    });
  };

  const view = gateView(status, failedRetries, online);

  if (view === "checking") {
    return (
      <p className="mx-auto max-w-wide px-4 py-16 text-sm text-muted-foreground sm:px-6">
        Checking your account…
      </p>
    );
  }

  /**
   * Unreachable is NOT signed out (lib/session.ts), and it is usually brief.
   *
   * The prototype let this branch through and ran offline, because it posted
   * nowhere. The real wizard cannot: every step needs the API, so continuing
   * would show a form that is guaranteed to fail on submit. So the gate waits,
   * visibly, while the API is not answering (lib/session-reconnect.ts), and
   * only after the schedule is spent says it is down. It blames the visitor's
   * connection only when the browser itself reports none: this screen used to
   * tell everyone to check theirs, which was wrong every time the API restarted.
   */
  if (view === "reconnecting") {
    return (
      <div
        role="status"
        className="mx-auto max-w-form px-4 py-16 text-sm text-muted-foreground sm:px-6"
      >
        <p className="font-semibold text-foreground">Still connecting to Injishi…</p>
        <p className="mt-1">
          It isn&apos;t answering yet. We&apos;ll keep trying — you don&apos;t
          need to do anything.
        </p>
      </div>
    );
  }

  if (view === "offline" || view === "down") {
    return (
      <div role="status" className="mx-auto max-w-form px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view === "offline" ? "You're offline" : "We can't reach Injishi"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {view === "offline"
            ? "Registering a business needs a live connection — we check your TIN with RRA and send your application to a government officer. We'll carry on as soon as you're back online."
            : "Injishi isn't answering right now. Registering a business needs it — we check your TIN with RRA and send your application to a government officer — so it can't start until Injishi is back. Try again in a few minutes."}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          isPending={asking}
          onPress={tryAgain}
        >
          {asking ? "Trying…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (view === "anonymous") {
    return <SendToSignIn />;
  }

  return (
    <>
      <div className="mx-auto max-w-wide px-4 pt-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Registering as{" "}
          <b className="text-foreground">{sessionDisplayName(session.user)}</b>
          {session.user?.email ? ` · ${session.user.email}` : ""}.
        </p>
      </div>
      {children}
    </>
  );
}

/**
 * Send a signed-out visitor to THE sign-in screen, and back here after it.
 *
 * This gate used to carry its own copy of the email code sign-in. That was a
 * second sign-in screen, which the product rules out (one sign-in, at
 * `/sign-in`), and it offered less than the real one: no Google, so a person
 * who signs in with Google had to leave anyway (ADR-060). `/sign-in` takes a
 * same-origin return path through `safeRedirect`, and says why they are there.
 */
function SendToSignIn() {
  const router = useRouter();
  const [target, setTarget] = useState("/sign-in?redirect=%2Fregister");
  useEffect(() => {
    const back = `${window.location.pathname}${window.location.search}`;
    const next = `/sign-in?redirect=${encodeURIComponent(back)}`;
    setTarget(next);
    router.replace(next);
  }, [router]);
  return (
    <p className="mx-auto max-w-wide px-4 py-16 text-sm text-muted-foreground sm:px-6">
      Taking you to sign in… <a className="font-semibold underline underline-offset-2" href={target}>Go now</a>
    </p>
  );
}
