"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";

import { fetchPlatform, isDemo, offersGoogle, registrationFeeMode, type RegistrationFeeMode } from "@/data/platform";
import { type MobileMoneyNetwork } from "@injishi/contracts";
import { useOnline } from "@/hooks/use-online";
import { useSessionUser } from "@/lib/session";
import { gateView, nextReconnectDelay } from "@/lib/session-reconnect";

import { EmailPanel } from "./email-panel";
import { RegisterRail, type RailStep } from "./register-rail";
import { RegisterShell, StepCard, StepSkeleton } from "./register-shell";
import { STEP_ORDER, STEP_TITLE_KEY } from "./register-steps";
import RegisterWizard from "./register-wizard";
import { findRegistrationKind, registrationForKind, type RegistrationKind } from "./registration-kinds";

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
  const t = useTranslations("register");
  const tc = useTranslations("common");
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

  // Not signed in (yet): the same frame the form draws, so the email reads as
  // the start of its first step and not a page in front of it. The h1 names
  // the type, Change beside it goes back to the `/host` chooser, and the rail
  // shows all five steps with the first on screen and nothing past it open. A
  // broker has no steps, so it keeps the bare shell.
  const kindEntry = initialKind ? findRegistrationKind(initialKind) : null;
  const kindLabel = kindEntry ? t(kindEntry.labelKey) : null;
  const walks = initialKind !== "broker";
  const headingKind = initialKind ? registrationForKind(initialKind).businessKind : null;
  const heading = walks
    ? {
        title:
          headingKind && headingKind !== "other"
            ? t("heading.register", {
                kind: t(`kinds.items.${headingKind}.label`).toLowerCase(),
              })
            : t("heading.business"),
        sub: null,
      }
    : null;
  const rail: RailStep[] = STEP_ORDER.map((id) => ({
    id,
    title: t(`steps.${STEP_TITLE_KEY[id]}`),
    status: id === STEP_ORDER[0] ? "active" : "inactive",
    locked: id !== STEP_ORDER[0],
  }));
  return (
    <RegisterShell
      kindLabel={kindLabel}
      demo={demo === true}
      changeKindHref="/host#host-chooser-title"
      carried={walks && initialKind !== null}
      heading={heading}
      exit={{ label: t("shell.exit"), href: "/host" }}
      rail={walks && view === "anonymous" ? <RegisterRail steps={rail} onGo={() => {}} /> : null}
    >
      {view === "checking" ? (
        <StepSkeleton />
      ) : view === "anonymous" ? (
        <EmailPanel
          demo={demo}
          googleReturn={google ? here : null}
          fallbackHref={signInHref}
          position={
            walks
              ? { n: 1, of: STEP_ORDER.length, title: t(`steps.${STEP_TITLE_KEY[STEP_ORDER[0]!]}`) }
              : null
          }
          onSignedIn={async () => (await refresh()).status === "authenticated"}
        />
      ) : view === "reconnecting" ? (
        /**
         * Unreachable is NOT signed out (lib/session.ts), and it is usually
         * brief. Opening the registration needs the API once, so the gate
         * waits, visibly, while it is not answering, and only after the
         * schedule is spent says so. Once open, the wizard carries on without
         * a connection (ADR-075 S9).
         */
        <StepCard
          id="register-connecting"
          title={t("gate.connectingTitle")}
          lead={t("gate.connectingLead")}
        />
      ) : (
        <StepCard
          id="register-down"
          title={view === "offline" ? t("gate.offlineTitle") : t("gate.downTitle")}
          lead={view === "offline" ? t("gate.offlineLead") : t("gate.downLead")}
          footer={
            <Button variant="outline" pending={asking} onClick={tryAgain}>
              {asking ? tc("trying") : tc("tryAgain")}
            </Button>
          }
        />
      )}
    </RegisterShell>
  );
}
