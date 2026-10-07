"use client";

/**
 * /kiosk (ADR-058, 058-time AC-TM10): the shared tablet at a staff door where
 * people clock in and out with their employee number and a PIN.
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
 * ## It never lists people
 *
 * The kiosk learns a name only after a right PIN, to confirm the punch with.
 * A wrong PIN, an unknown number and a person of another branch all read the
 * same. Five wrong PINs lock that person on this kiosk for fifteen minutes,
 * and a punch within a minute of the last is refused as a double tap.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "@heroui/react";
import { KioskPunchResult, KioskSession } from "@injishi/contracts";
import BrandLogo from "@/components/app/brand-logo";
import { apiFetch, apiFetchParsed, apiResultMessage } from "@/lib/api";

type Screen =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "pair" }
  | { kind: "ready"; session: KioskSession };

/** How long the confirmation stays before the next person. */
const CONFIRM_MS = 5_000;

function kigaliClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  const load = useCallback(async () => {
    const result = await apiFetchParsed(KioskSession, "/api/v1/kiosk/session");
    if (result.status === "ok") setScreen({ kind: "ready", session: result.data });
    else if (result.status === "unauthenticated") setScreen({ kind: "pair" });
    else setScreen({ kind: "offline" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-tile">
        <div className="flex items-center justify-between">
          <BrandLogo variant="short" />
          {screen.kind === "ready" && <Clock />}
        </div>
        {screen.kind === "loading" && <p className="mt-10 text-sm text-muted-foreground">Starting the kiosk…</p>}
        {screen.kind === "offline" && (
          <div className="mt-10 flex flex-col gap-4">
            <h1 className="font-display text-3xl font-bold tracking-tight">The kiosk cannot reach Injishi</h1>
            <p className="text-sm text-muted-foreground">Check the tablet&apos;s connection. Nothing was recorded.</p>
            <Button variant="primary" onPress={() => void load()}>
              Try again
            </Button>
          </div>
        )}
        {screen.kind === "pair" && <Pair onPaired={(session) => setScreen({ kind: "ready", session })} />}
        {screen.kind === "ready" && <Punch session={screen.session} onUnpaired={() => setScreen({ kind: "pair" })} />}
      </div>
    </main>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  return <span className="money text-2xl font-bold text-foreground">{kigaliClock(now)}</span>;
}

function Pair({ onPaired }: { onPaired: (session: KioskSession) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pair(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 8) {
      setError("The code is 8 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetchParsed(KioskSession, "/api/v1/kiosk/pair", { method: "POST", body: { code: digits } });
    setBusy(false);
    if (result.status === "ok") onPaired(result.data);
    else setError(apiResultMessage(result));
  }

  return (
    <form noValidate onSubmit={pair} className="mt-10 flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">Pair this tablet</h1>
      <p className="text-sm text-muted-foreground">
        In the operator app, Staff · Kiosks shows a code for ten minutes when a kiosk is added. Type it here, once.
      </p>
      <label htmlFor="kiosk-code" className="block text-sm font-semibold">
        Pairing code
      </label>
      <Input
        id="kiosk-code"
        inputMode="numeric"
        autoComplete="off"
        className="money w-full text-2xl tracking-widest"
        placeholder="1234 5678"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "kiosk-code-error" : undefined}
      />
      {error ? (
        <p id="kiosk-code-error" role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" fullWidth isDisabled={busy}>
        {busy ? "Pairing…" : "Pair"}
      </Button>
    </form>
  );
}

function Punch({ session, onUnpaired }: { session: KioskSession; onUnpaired: () => void }) {
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<KioskPunchResult | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      setDone(null);
      numberRef.current?.focus();
    }, CONFIRM_MS);
    return () => clearTimeout(t);
  }, [done]);

  async function punch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!number.trim() || !/^\d{4,6}$/.test(pin)) {
      setError("Type your employee number and your PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetchParsed(KioskPunchResult, "/api/v1/kiosk/punch", {
      method: "POST",
      body: { employeeNumber: number.trim(), pin },
    });
    setBusy(false);
    setPin("");
    if (result.status === "ok") {
      setNumber("");
      setDone(result.data);
      return;
    }
    if (result.status === "unauthenticated") {
      // Revoked, or the cookie is gone: this tablet is no longer a kiosk.
      onUnpaired();
      return;
    }
    setError(apiResultMessage(result));
  }

  if (done) {
    return (
      <section aria-live="polite" className="mt-10 flex flex-col gap-3 rounded-card border border-border bg-card p-6 text-card-foreground">
        <p className="text-sm text-muted-foreground">{done.direction === "in" ? "Clocked in" : "Clocked out"}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {done.direction === "in" ? `Welcome, ${done.displayName}` : `Goodbye, ${done.displayName}`}
        </h1>
        <p className="money text-2xl font-bold">{kigaliClock(new Date(done.at))}</p>
        <Button variant="outline" onPress={() => setDone(null)}>
          Next person
        </Button>
      </section>
    );
  }

  return (
    <form noValidate onSubmit={punch} className="mt-10 flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Clock in or out</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.kioskName} · {session.branchName}
        </p>
      </div>
      <label htmlFor="kiosk-number" className="block text-sm font-semibold">
        Employee number
      </label>
      <Input
        id="kiosk-number"
        ref={numberRef}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        className="money w-full text-xl uppercase"
        value={number}
        onChange={(e) => {
          setNumber(e.target.value);
          setError(null);
        }}
      />
      <label htmlFor="kiosk-pin" className="block text-sm font-semibold">
        PIN
      </label>
      <Input
        id="kiosk-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        className="money w-full text-xl tracking-widest"
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ""));
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "kiosk-error" : undefined}
      />
      {error ? (
        <p id="kiosk-error" role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" fullWidth isDisabled={busy}>
        {busy ? "One moment…" : "Clock in or out"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Forgot your PIN, or locked out? Ask whoever runs attendance at the desk.
      </p>
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline"
        onClick={() => {
          void apiFetch("/api/v1/kiosk/forget", { method: "POST" }).then(onUnpaired);
        }}
      >
        Unpair this tablet
      </button>
    </form>
  );
}
