"use client";

/**
 * /kiosk (ADR-058, 058-time AC-TM10): the shared tablet at a staff door where
 * people clock in and out with their staff number and a PIN, built to the
 * AttendanceKiosk board.
 *
 * ## Paired once, with a code, and no session ever
 *
 * Someone who runs attendance adds the kiosk in the operator app and is shown
 * an 8 digit code for ten minutes. Typed here, it is traded for a device token
 * the API sets as an HttpOnly, SameSite=Strict cookie on its kiosk routes
 * only: this page never holds the token and could not read it if it tried. A
 * shared tablet must never carry a staff member's session, which is why this
 * route sits outside the session gate (it is not in `PROTECTED_PREFIXES`).
 *
 * ## It never lists people, and it keeps nothing
 *
 * The kiosk learns a name only after a right PIN, to confirm the punch with.
 * A wrong PIN, an unknown number and a person of another branch all read the
 * same. The PIN is checked by Injishi and a punch takes Injishi's time, so the
 * tablet stores no punch for later: offline, it records nothing and says so.
 *
 * ## Every screen clears itself
 *
 * A kiosk is walked away from mid sentence. The answer clears after a few
 * seconds, a refusal after a little longer, and a half typed number or PIN
 * after a pause, so the next person never inherits the last one's digits.
 */
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Link2, QrCode as QrIcon, Wifi, WifiOff } from "lucide-react";
import type { KioskPunchResult, KioskQr, KioskSession } from "@injishi/contracts";
import { Badge, Button, Card, Input, Label, Toaster, toastDwellMs, type Toast } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { QrCode } from "@/components/shared/qr-code";

import { forgetKiosk, pairKiosk, punch, readQr, readSession } from "./kiosk-api";
import { clockTime, driftLabel, shortDate, useKioskNow } from "./kiosk-clock";
import { KioskKeypad } from "./kiosk-keypad";
import qrStyles from "./kiosk-qr.module.css";
import {
  ALT,
  DonePanel,
  DoublePanel,
  GO,
  IdlePanel,
  LockedPanel,
  MismatchPanel,
  OfflinePanel,
  PanelHeading,
  RefusedPanel,
  StatusDisc,
} from "./kiosk-panels";

type Flow =
  | { step: "loading" }
  | { step: "pair" }
  | { step: "idle" }
  | { step: "number" }
  | { step: "pin" }
  | { step: "done"; result: KioskPunchResult }
  | { step: "mismatch" }
  | { step: "locked"; until: Date | null }
  | { step: "double"; title: string; known: boolean }
  | { step: "refused"; message: string };

/** How often the kiosk asks Injishi whether it is still there (the board's 30 seconds). */
const HEARTBEAT_MS = 30_000;
/** The answer stays this long before the next person (the board's 8 seconds). */
const DONE_MS = 8_000;
/** A refusal stays a little longer: it has a next step to read. */
const REFUSAL_MS = 20_000;
/** A half typed number or PIN is cleared after this much stillness. */
const ENTRY_IDLE_MS = 45_000;
/** The API refuses a second punch inside a minute; a little slack for the round trip. */
const DOUBLE_TAP_WINDOW_MS = 70_000;

const PIN = /^\d{4,6}$/;
/** What a staff number may hold: the contract allows 20, the business may prefix it. */
const NUMBER_CHARS = /[^A-Za-z0-9-]/g;

/** One punch, kept in memory only, so a double tap can say what it doubled. */
interface LastPunch {
  number: string;
  direction: "in" | "out";
  at: string;
  seenAt: number;
}

export function AttendanceKiosk() {
  const [flow, setFlow] = useState<Flow>({ step: "loading" });
  const [session, setSession] = useState<KioskSession | null>(null);
  const [online, setOnline] = useState(true);
  const [lastReachedAt, setLastReachedAt] = useState<Date | null>(null);
  const [lostMidPunch, setLostMidPunch] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [num, setNum] = useState("");
  const [pin, setPin] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const lastPunch = useRef<LastPunch | null>(null);
  // Read by the heartbeat, which must not restart its timer on every key.
  const onlineRef = useRef(true);
  const lostMidPunchRef = useRef(false);
  const stepRef = useRef<Flow["step"]>("loading");
  stepRef.current = flow.step;

  const now = useKioskNow(offsetMs);

  const say = useCallback((message: string, tone: Toast["tone"] = "neutral") => {
    setToast({ id: `${Date.now()}`, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toastDwellMs(toast.message, toast.tone));
    return () => clearTimeout(t);
  }, [toast]);

  /** Start the next person from nothing. */
  const clearEntry = useCallback(() => {
    setNum("");
    setPin("");
    setError(null);
  }, []);

  const toIdle = useCallback(() => {
    clearEntry();
    setFlow({ step: "idle" });
  }, [clearEntry]);

  const goOffline = useCallback(
    (midPunch = false) => {
      onlineRef.current = false;
      setOnline(false);
      if (midPunch) {
        lostMidPunchRef.current = true;
        setLostMidPunch(true);
      }
      setBusy(false);
      clearEntry();
      setPairCode("");
      // Whatever was on screen goes; what the kiosk returns to is the start.
      setFlow((f) => (f.step === "loading" || f.step === "pair" ? f : { step: "idle" }));
    },
    [clearEntry],
  );

  const toPairing = useCallback(() => {
    setSession(null);
    clearEntry();
    setPairCode("");
    setFlow({ step: "pair" });
  }, [clearEntry]);

  /** Ask Injishi who this tablet is. The heartbeat, the retry and the first load. */
  const check = useCallback(async () => {
    const outcome = await readSession();
    if (outcome.kind === "unreachable") {
      goOffline();
      return;
    }
    const wasOffline = !onlineRef.current;
    onlineRef.current = true;
    setOnline(true);
    setLastReachedAt(new Date());
    if (wasOffline) {
      say(
        lostMidPunchRef.current
          ? "Connected again. Ask the front desk whether the last punch was recorded before tapping again."
          : "Connected again. Nothing was recorded while the kiosk was offline.",
        lostMidPunchRef.current ? "warning" : "success",
      );
      lostMidPunchRef.current = false;
      setLostMidPunch(false);
    }
    if (outcome.kind === "unpaired") {
      // Revoked, or the cookie is gone: this tablet is no longer a kiosk. A
      // code half typed on the pairing screen is left alone.
      if (stepRef.current !== "pair") toPairing();
      return;
    }
    setSession(outcome.session);
    setFlow((f) => (f.step === "loading" || f.step === "pair" ? { step: "idle" } : f));
  }, [goOffline, say, toPairing]);

  useEffect(() => {
    void check();
    const beat = setInterval(() => void check(), HEARTBEAT_MS);
    const lost = () => goOffline();
    const back = () => void check();
    window.addEventListener("offline", lost);
    window.addEventListener("online", back);
    return () => {
      clearInterval(beat);
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", back);
    };
  }, [check, goOffline]);

  // Every screen clears itself (see the header). The entry screens restart
  // their pause on each key, which is why the digits are in the dependencies.
  useEffect(() => {
    const wait =
      flow.step === "done"
        ? DONE_MS
        : flow.step === "mismatch" || flow.step === "locked" || flow.step === "double" || flow.step === "refused"
          ? REFUSAL_MS
          : flow.step === "number" || flow.step === "pin"
            ? ENTRY_IDLE_MS
            : null;
    if (wait === null) return;
    const t = setTimeout(toIdle, wait);
    return () => clearTimeout(t);
  }, [flow, num, pin, toIdle]);

  async function retry() {
    setRetrying(true);
    await check();
    setRetrying(false);
  }

  // --- The keypad writes to whichever field is open ----------------------------

  const field = flow.step === "pair" ? "pair" : flow.step === "pin" ? "pin" : "number";
  const value = field === "pair" ? pairCode : field === "pin" ? pin : num;

  function put(next: string) {
    setError(null);
    if (field === "pair") setPairCode(next.replace(/\D/g, "").slice(0, 8));
    else if (field === "pin") setPin(next.replace(/\D/g, "").slice(0, 6));
    else setNum(next.replace(NUMBER_CHARS, "").toUpperCase().slice(0, 20));
  }

  // --- The three entry steps ---------------------------------------------------

  async function submitPair(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (pairCode.length !== 8) {
      setError("The code is 8 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await pairKiosk(pairCode);
    setBusy(false);
    if (outcome.kind === "unreachable") {
      goOffline();
      return;
    }
    if (outcome.kind === "refused") {
      setError(outcome.message);
      return;
    }
    setPairCode("");
    setSession(outcome.session);
    setLastReachedAt(new Date());
    setFlow({ step: "idle" });
    say(`Paired to ${outcome.session.branchName}: ${outcome.session.kioskName}.`, "success");
  }

  function submitNumber(e?: FormEvent) {
    e?.preventDefault();
    if (!num.trim()) {
      setError("Type your staff number.");
      return;
    }
    setError(null);
    setPin("");
    setFlow({ step: "pin" });
  }

  async function submitPin(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!PIN.test(pin)) {
      setError("Type your PIN: 4 to 6 digits.");
      return;
    }
    const number = num.trim();
    setBusy(true);
    setError(null);
    const outcome = await punch(number, pin);
    setBusy(false);
    setPin("");
    switch (outcome.kind) {
      case "recorded": {
        // One measurement is enough to correct a clock by minutes; a wild one
        // (a tablet set to another day) is still the truth about this tablet.
        setOffsetMs(Math.round(outcome.offsetMs));
        lastPunch.current = { number, direction: outcome.result.direction, at: outcome.result.at, seenAt: Date.now() };
        setNum("");
        setFlow({ step: "done", result: outcome.result });
        return;
      }
      case "mismatch":
        setFlow({ step: "mismatch" });
        return;
      case "locked":
        setNum("");
        setFlow({ step: "locked", until: outcome.until });
        return;
      case "double": {
        const last = lastPunch.current;
        const known = !!last && last.number === number && Date.now() - last.seenAt < DOUBLE_TAP_WINDOW_MS;
        setNum("");
        setFlow({
          step: "double",
          known,
          title: known && last ? `You clocked ${last.direction} at ${clockTime(new Date(last.at))}` : "You were recorded less than a minute ago",
        });
        return;
      }
      case "unpaired":
        toPairing();
        say("This tablet is no longer paired. It needs a new code from the operator app.", "warning");
        return;
      case "refused":
        setFlow({ step: "refused", message: outcome.message });
        return;
      case "unreachable":
        goOffline(true);
        return;
    }
  }

  // --- Unpairing, with a second press, because anyone can reach this tablet ----

  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [unpairError, setUnpairError] = useState<string | null>(null);
  async function unpair() {
    setBusy(true);
    const ok = await forgetKiosk();
    setBusy(false);
    setConfirmUnpair(false);
    if (!ok) {
      setUnpairError("The kiosk could not reach Injishi, so it is still paired.");
      return;
    }
    setUnpairError(null);
    toPairing();
    say("This tablet is unpaired. It needs a new code from the operator app.");
  }

  // --- The page ------------------------------------------------------------------

  const paired = session !== null;
  const placeTitle = paired ? session.kioskName : flow.step === "pair" ? "Kiosk not paired" : "Attendance kiosk";
  const placeSub = paired
    ? [session.branchName, now ? shortDate(now) : null].filter(Boolean).join(" · ")
    : flow.step === "pair"
      ? "It learns its branch from the pairing code"
      : online
        ? "Starting"
        : "Waiting for Injishi";
  const showTopTime = now !== null && flow.step !== "loading" && !(online && flow.step === "idle");
  const isEntry = online && (flow.step === "pair" || flow.step === "number" || flow.step === "pin");
  const drift = driftLabel(offsetMs);

  // A USB keypad or a keyboard types into the open step even when nothing is
  // focused (the keypad buttons take focus as they are pressed). A key typed
  // INTO the field is the field's own, so it is left alone here.
  keyHandler.current = (e: KeyboardEvent) => {
    if (!isEntry || busy || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (/^\d$/.test(e.key) || (field === "number" && /^[A-Za-z-]$/.test(e.key))) {
      e.preventDefault();
      put(value + e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      put(value.slice(0, -1));
    } else if (e.key === "Enter" && target?.tagName !== "BUTTON") {
      e.preventDefault();
      if (field === "pair") void submitPair();
      else if (field === "pin") void submitPin();
      else submitNumber();
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-19 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-7">
        <KioskBrand />
        <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
        {/* On a phone the place takes a line of its own under the brand, the
            clock and the connection, rather than being cut to "Staff …". */}
        <div className="order-last flex w-full min-w-0 flex-col sm:order-none sm:w-auto sm:flex-1">
          <span className="truncate text-base font-semibold">{placeTitle}</span>
          <span className="truncate text-sm text-muted-foreground">{placeSub}</span>
        </div>
        <span aria-hidden className="flex-1 sm:hidden" />
        {showTopTime && now ? (
          <span className="text-xl font-bold tabular-nums">
            <time dateTime={now.toISOString()}>{clockTime(now)}</time>
          </span>
        ) : null}
        {flow.step === "loading" && online ? null : online ? (
          <Badge variant="ghost" size="lg" className="gap-1.5 bg-success-soft font-semibold text-success-soft-foreground">
            <Wifi aria-hidden className="size-4" strokeWidth={1.8} />
            Online
          </Badge>
        ) : (
          <Badge variant="ghost" size="lg" className="gap-1.5 bg-danger-soft font-semibold text-danger-soft-foreground">
            <WifiOff aria-hidden className="size-4" strokeWidth={1.8} />
            Offline
          </Badge>
        )}
      </header>

      <div className="grid flex-1 content-start gap-5 px-4 pb-4 sm:px-7 lg:grid-cols-[minmax(0,1fr)_20.75rem] lg:content-stretch">
        <main className="flex min-h-120 min-w-0 flex-col rounded-card bg-card p-6 text-card-foreground shadow-surface sm:px-9 sm:py-8">
          {!online ? (
            <OfflinePanel lastReachedAt={lastReachedAt} lostMidPunch={lostMidPunch} retrying={retrying} onRetry={() => void retry()} />
          ) : flow.step === "loading" ? (
            <div className="flex flex-1 items-center justify-center">
              <p role="status" className="text-base text-muted-foreground">
                Starting the kiosk…
              </p>
            </div>
          ) : flow.step === "idle" ? (
            <IdlePanel
              now={now}
              onStart={() => {
                clearEntry();
                setFlow({ step: "number" });
              }}
            />
          ) : isEntry ? (
            <div className="grid flex-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_15.75rem]">
              <div className="flex min-w-0 flex-col gap-3">
                {flow.step === "pair" ? (
                  <form noValidate onSubmit={(e) => void submitPair(e)} className="flex flex-col gap-3">
                    <StatusDisc tone="note" small>
                      <Link2 className="size-7" strokeWidth={1.8} />
                    </StatusDisc>
                    <PanelHeading>Pair this tablet</PanelHeading>
                    <p className="text-base">
                      In the operator app, Attendance › Clock-in rules shows an 8-digit code for ten minutes when a tablet is added.
                      Type it here, once.
                    </p>
                    <EntryField
                      id="kiosk-pair"
                      label="Pairing code"
                      value={pairCode}
                      onChange={put}
                      numeric
                      hint="Pairing gives this tablet a device key of its own. Nobody signs in on a kiosk."
                      error={error}
                    />
                    <Button type="submit" size="lg" fullWidth className={GO} pending={busy}>
                      <Link2 aria-hidden className="size-5" strokeWidth={1.8} />
                      Pair this tablet
                    </Button>
                  </form>
                ) : flow.step === "number" ? (
                  <form noValidate onSubmit={submitNumber} className="flex flex-col gap-3">
                    <Steps current="number" />
                    <PanelHeading>Your staff number</PanelHeading>
                    <EntryField
                      id="kiosk-number"
                      label="Staff number"
                      value={num}
                      onChange={put}
                      hint="The number on your staff card."
                      error={error}
                    />
                    <Button type="submit" size="lg" fullWidth className={GO}>
                      Next
                    </Button>
                    <Button variant="secondary" size="lg" fullWidth className={ALT} onClick={toIdle}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <form noValidate onSubmit={(e) => void submitPin(e)} className="flex flex-col gap-3">
                    <Steps current="pin" number={num} />
                    <PanelHeading>Your PIN</PanelHeading>
                    <EntryField
                      id="kiosk-pin"
                      label="PIN"
                      value={pin}
                      onChange={put}
                      numeric
                      secret
                      hint="4 to 6 digits. Your name shows only after a right PIN."
                      error={error}
                    />
                    <Button type="submit" size="lg" fullWidth className={GO} pending={busy}>
                      <Clock aria-hidden className="size-5" strokeWidth={1.8} />
                      Clock in or out
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      className={ALT}
                      disabled={busy}
                      onClick={() => {
                        setPin("");
                        setError(null);
                        setFlow({ step: "number" });
                      }}
                    >
                      Back
                    </Button>
                  </form>
                )}
              </div>
              <KioskKeypad
                disabled={busy}
                onDigit={(d) => put(value + d)}
                onClear={() => put("")}
                onDelete={() => put(value.slice(0, -1))}
              />
            </div>
          ) : flow.step === "done" ? (
            <DonePanel result={flow.result} kioskName={session?.kioskName ?? "this kiosk"} onNext={toIdle} />
          ) : flow.step === "mismatch" ? (
            <MismatchPanel
              onRetryPin={() => {
                setPin("");
                setError(null);
                setFlow({ step: "pin" });
              }}
              onRestart={() => {
                clearEntry();
                setFlow({ step: "number" });
              }}
            />
          ) : flow.step === "locked" ? (
            <LockedPanel until={flow.until} onNext={toIdle} />
          ) : flow.step === "double" ? (
            <DoublePanel title={flow.title} known={flow.known} onNext={toIdle} />
          ) : flow.step === "refused" ? (
            <RefusedPanel
              message={flow.message}
              onRestart={() => {
                clearEntry();
                setFlow({ step: "number" });
              }}
            />
          ) : null}
        </main>

        <aside aria-label="This kiosk" className="flex min-w-0 flex-col gap-4">
          {paired && online ? <ScanCard /> : null}
          <Card className="gap-2.5 px-5.5 py-5 shadow-surface">
            <h2 className="text-base font-bold">This kiosk</h2>
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2.5 text-sm">
              <dt className="font-semibold">Clock</dt>
              <dd className="text-muted-foreground">
                Punches take Injishi’s time, not this tablet’s{drift ? ` (it runs ${drift})` : ""}.
              </dd>
              <dt className="font-semibold">PIN</dt>
              <dd className="text-muted-foreground">Checked by Injishi with a secret kept off this tablet. Never stored or shown here.</dd>
              <dt className="font-semibold">Pairing</dt>
              <dd className="text-muted-foreground">Its own device key, in a cookie no page can read. Nobody is signed in here.</dd>
            </dl>
            {paired && online ? (
              <div className="flex flex-col gap-2 pt-1">
                {confirmUnpair ? (
                  <>
                    <p className="text-sm">Unpair it? It will need a new code from the operator app before anyone can clock in here.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" size="sm" pending={busy} onClick={() => void unpair()}>
                        Unpair
                      </Button>
                      <Button variant="secondary" size="sm" className="text-foreground" onClick={() => setConfirmUnpair(false)}>
                        Keep it paired
                      </Button>
                    </div>
                  </>
                ) : (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-foreground"
                      onClick={() => {
                        setUnpairError(null);
                        setConfirmUnpair(true);
                      }}
                    >
                      Unpair this tablet
                    </Button>
                  </div>
                )}
                {unpairError ? (
                  <p role="alert" className="text-sm font-semibold text-danger-text">
                    {unpairError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
      <Toaster toasts={toast ? [toast] : []} />
    </div>
  );
}

/**
 * The code phones scan to clock in (clock-in rules). It changes every 30 seconds and a scan is good
 * for 90, so a photo of it sent home has run out before it is any use. When it cannot be had the
 * card says so and the PIN pad carries on.
 */
function ScanCard() {
  const [qr, setQr] = useState<KioskQr | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = async () => {
      const got = await readQr();
      if (stopped) return;
      setFailed(got === null);
      if (got) setQr(got);
      timer = setTimeout(() => void next(), got ? Math.max(1_000, got.refreshInMs) : 5_000);
    };
    void next();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <Card className="items-center gap-3 px-5.5 py-5 text-center shadow-surface">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <QrIcon aria-hidden className="size-5" strokeWidth={1.8} />
        Clock in with your phone
      </h2>
      {qr && !failed ? (
        <span className={`overflow-hidden rounded ${qrStyles.qr}`}>
          <QrCode
            value={qr.url}
            size={208}
            light="var(--white)"
            ink="var(--ink)"
            label="Scan with your phone's camera to clock in or out"
          />
        </span>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">{failed ? "The code could not load. Use your PIN below." : "Loading the code…"}</p>
      )}
      <p className="text-sm text-muted-foreground">Scan with your phone's camera. The code changes every 30 seconds.</p>
    </Card>
  );
}

/** The wordmark, not linked: a kiosk is not a page to browse away from. */
function KioskBrand() {
  return (
    <span className="inline-flex shrink-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- the same static marks BrandLogo draws, unlinked */}
      <img src="/shared/img/injishi-extended.svg" alt="Injishi" className="h-7 w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above, its dark twin */}
      <img src="/shared/img/injishi-extended-white.svg" alt="Injishi" className="hidden h-7 w-auto dark:block" />
    </span>
  );
}

/** Where the person is in the two steps. The number they typed is theirs to see. */
function Steps({ current, number }: { current: "number" | "pin"; number?: string }) {
  return (
    <ol className="flex flex-wrap gap-2">
      <li aria-current={current === "number" ? "step" : undefined}>
        {current === "number" ? (
          <Badge variant="ghost" size="lg" className="bg-accent-soft font-semibold text-accent-soft-foreground">
            1 · Staff number
          </Badge>
        ) : (
          <Badge variant="ghost" size="lg" className="gap-1.5 bg-success-soft font-semibold text-success-soft-foreground">
            <Check aria-hidden className="size-4" strokeWidth={1.8} />
            <span className="sr-only">Staff number </span>
            {number}
          </Badge>
        )}
      </li>
      <li aria-current={current === "pin" ? "step" : undefined}>
        <Badge
          variant={current === "pin" ? "ghost" : "default"}
          size="lg"
          className={cn("font-semibold", current === "pin" && "bg-accent-soft text-accent-soft-foreground")}
        >
          2 · PIN
        </Badge>
      </li>
    </ol>
  );
}

/**
 * The one big field each entry step has. `numeric` keeps the tablet's own
 * keyboard down (the keypad is the input); the staff number lets it up when the
 * field is tapped, because a business may put letters in front of its numbers
 * and the kiosk is not told which.
 */
function EntryField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  numeric,
  secret,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint: string;
  error: string | null;
  numeric?: boolean;
  secret?: boolean;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type={secret ? "password" : "text"}
        inputMode={numeric ? "none" : "text"}
        autoComplete="off"
        autoCapitalize={numeric ? undefined : "characters"}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className="h-18 rounded-card px-4.5 text-3xl font-semibold tracking-widest tabular-nums"
      />
      <p id={hintId} className="text-sm text-muted-foreground">
        {hint}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-base font-semibold text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
