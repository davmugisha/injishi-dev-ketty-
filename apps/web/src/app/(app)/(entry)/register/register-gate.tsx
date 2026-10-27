"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@injishi/web-ui";

import { fetchPlatform, isDemo, offersGoogle, registrationFeeMode, type RegistrationFeeMode } from "@/data/platform";
import type { MobileMoneyNetwork } from "@injishi/contracts";
import { useSessionUser } from "@/lib/session";
import { gateView, nextReconnectDelay } from "@/lib/session-reconnect";

import { EmailPanel } from "./email-panel";
import { RegisterShell, StepCard, StepSkeleton } from "./register-shell";
import RegisterWizard from "./register-wizard";
import { findRegistrationKind, type RegistrationKind } from "./registration-kinds";

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
 * The front door of business registration (FL01): who is registering.
 *
 * Registering a business creates an org and makes the registrant its owner, the
 * grant every later permission check resolves against (Spec 0004), so nothing
 * below this gate runs without a real session.
 *
 * SIGNED OUT, THE SIGN-IN IS THE FIRST PANEL, IN PLACE (ADR-069 D-g). This gate
 * used to send a signed out visitor away: "Checking your account…", then
 * "Taking you to sign in…", then `/sign-in`, `/verify-otp` and `/start`, and
 * back. Three interstitials around two screens that asked something. The
 * RegisterIA board draws the email and code inside the registration instead,
 * and D-g rules it is the one sign-in shown in a second place rather than a
 * second sign-in: `EmailPanel` is `/sign-in`'s Google button and the same
 * `lib/otp.ts` code, and only a session `lib/session.ts` reads back moves the
 * page on. `/sign-in` stays the only page whose job is signing in, and the
 * panel falls back to it, with this page as the way back, in the one case it
 * cannot finish here: a code accepted and no session kept.
 *
 * WHY CLIENT-SIDE. The Better Auth session cookie belongs to the API origin, so
 * a Server Component cannot read it. The gate resolves it in the browser, as
 * the booking flow does. It is an affordance, not the control: every write the
 * wizard makes is guarded by `SessionGuard` on the API.
 */
export default function RegisterGate({
  initialKind,
}: {
  initialKind: RegistrationKind | null;
}) {
  const session = useSessionUser();
  const online = useOnline();
  const [failedRetries, setFailedRetries] = useState(0);
  const { status, refresh } = session;

  // Whether the API is the demo (ADR-043): its code is published and it has no
  // Google client. Null until it answers, and a failed answer is production's.
  // Google is offered only where the API says its provider is mounted.
  const [demo, setDemo] = useState<boolean | null>(null);
  const [google, setGoogle] = useState(false);
  // How the registration fee is taken here, and on which networks (073 AC-17).
  const [feeMode, setFeeMode] = useState<RegistrationFeeMode>("unknown");
  const [feeNetworks, setFeeNetworks] = useState<MobileMoneyNetwork[]>(["mtn_momo", "airtel_money"]);
  const [feeMaxRwf, setFeeMaxRwf] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void fetchPlatform().then((p) => {
      if (!live) return;
      setDemo(isDemo(p));
      setGoogle(offersGoogle(p));
      setFeeMode(registrationFeeMode(p));
      if (p?.paymentRules) {
        setFeeNetworks(p.paymentRules.networks);
        setFeeMaxRwf(p.paymentRules.maxCollectionRwf);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // Where Google brings the person back to, and where the sign-in page sends
  // them back to: this page, its path and its query, so the kind survives.
  const [here, setHere] = useState<string | null>(null);
  const [signInHref, setSignInHref] = useState("/sign-in?redirect=%2Fregister");
  useEffect(() => {
    const back = `${window.location.pathname}${window.location.search}`;
    setHere(back);
    setSignInHref(`/sign-in?redirect=${encodeURIComponent(back)}`);
  }, []);

  // Any answer at all ends the run, so the next outage gets the whole schedule.
  useEffect(() => {
    if (status !== "unreachable") setFailedRetries(0);
  }, [status]);

  // Coming back online is worth a fresh run, not the tail of a spent one.
  useEffect(() => {
    if (online) setFailedRetries(0);
  }, [online]);

  // Ask again on the schedule while online and the schedule is not spent.
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

  const [asking, setAsking] = useState(false);
  const tryAgain = () => {
    setAsking(true);
    void refresh().then(() => {
      setAsking(false);
      setFailedRetries(0);
    });
  };

  const view = gateView(status, failedRetries, online);

  if (view === "authenticated") {
    return (
      <RegisterWizard
        initialKind={initialKind}
        user={session.user}
        demo={demo === true}
        feeMode={feeMode}
        feeNetworks={feeNetworks}
        feeMaxRwf={feeMaxRwf}
      />
    );
  }

  // Not signed in (yet): the shell with the kind they chose on `/host`, which
  // Change takes them back to, and no rail, because nothing is walked until
  // they are who they say they are.
  const kindLabel = initialKind ? (findRegistrationKind(initialKind)?.label ?? null) : null;
  return (
    <RegisterShell
      kindLabel={kindLabel}
      demo={demo === true}
      changeKindHref="/host#host-chooser-title"
      exit={{ label: "Exit", href: "/host" }}
    >
      {view === "checking" ? (
        <StepSkeleton />
      ) : view === "anonymous" ? (
        <EmailPanel
          demo={demo}
          googleReturn={google ? here : null}
          fallbackHref={signInHref}
          onSignedIn={async () => (await refresh()).status === "authenticated"}
        />
      ) : view === "reconnecting" ? (
        /**
         * Unreachable is NOT signed out (lib/session.ts), and it is usually
         * brief. Every step needs the API, so the gate waits, visibly, while
         * it is not answering, and only after the schedule is spent says so.
         */
        <StepCard
          id="register-connecting"
          title="Still connecting to Injishi…"
          lead="It isn't answering yet. We'll keep trying, so you don't need to do anything."
        />
      ) : (
        <StepCard
          id="register-down"
          title={view === "offline" ? "You're offline" : "We can't reach Injishi"}
          lead={
            view === "offline"
              ? "Registering a business needs a live connection: we check your TIN with RRA and send your application to a government officer. We'll carry on as soon as you're back online."
              : "Injishi isn't answering right now. Registering a business needs it, so it can't start until Injishi is back. Try again in a few minutes."
          }
          footer={
            <Button variant="outline" pending={asking} onClick={tryAgain}>
              {asking ? "Trying…" : "Try again"}
            </Button>
          }
        />
      )}
    </RegisterShell>
  );
}
