"use client";

/**
 * The kiosk's answers, one panel each, in the AttendanceKiosk board's words.
 *
 * Every panel here is drawn from what the API actually said. Where the board
 * shows something the kiosk API does not return (the person's shift, how many
 * tries are left, who is on the desk), the panel says the true general thing
 * instead of inventing the specific one.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Check, ConciergeBell, Info, Lock, LogIn, RefreshCw, SquareX, WifiOff } from "lucide-react";
import type { KioskPunchResult } from "@injishi/contracts";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { clockTime, longDate } from "./kiosk-clock";

/** Board k-go: the one action on a panel, 64px tall. */
export const GO = "h-16 px-8 text-xl font-semibold";
/** Board k-alt: the quiet second action beside it. */
export const ALT = "h-16 px-7 text-lg font-semibold text-foreground";

type Tone = "ok" | "no" | "note";

const DISC: Record<Tone, string> = {
  ok: "bg-success-soft text-success-soft-foreground",
  no: "bg-danger-soft text-danger-soft-foreground",
  note: "bg-accent-soft text-accent-soft-foreground",
};

const EYEBROW: Record<Tone, string> = {
  ok: "text-success-soft-foreground",
  no: "text-danger-text",
  note: "text-accent-soft-foreground",
};

/** The round status mark above a panel's heading. */
export function StatusDisc({ tone, children, small }: { tone: Tone; children: ReactNode; small?: boolean }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full", small ? "size-14" : "size-18", DISC[tone])}>
      {children}
    </span>
  );
}

/**
 * A heading that takes focus when its panel appears, so a screen reader reads
 * the answer the moment the screen changes rather than staying on the button
 * that was pressed.
 */
export function PanelHeading({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={cn("text-3xl font-bold tracking-tight outline-none", className)}>
      {children}
    </h1>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">{children}</div>;
}

function Eyebrow({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <p className={cn("text-base font-semibold", EYEBROW[tone])}>{children}</p>;
}

// --- Ready -------------------------------------------------------------------

export function IdlePanel({ now, onStart }: { now: Date | null; onStart: () => void }) {
  return (
    <Centered>
      <p className="text-base text-muted-foreground">{now ? longDate(now) : " "}</p>
      {/* The one size above the type scale, and it is a wall clock, not text
          to read: it follows the screen (clamp, vw), which the scale rules
          treat as behaviour rather than a hand typed step. */}
      <p className="text-[clamp(4.5rem,12vw,7.5rem)] font-bold leading-none tracking-tighter tabular-nums">
        {now ? <time dateTime={now.toISOString()}>{clockTime(now)}</time> : " "}
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Clock in or out</h1>
      <p className="max-w-form text-base text-muted-foreground">
        Your staff number, then your PIN. The kiosk works out whether you are coming or going.
      </p>
      <Button size="lg" className={cn(GO, "mt-2.5 min-w-70")} onClick={onStart}>
        <LogIn aria-hidden className="size-5" strokeWidth={1.8} />
        Tap to start
      </Button>
    </Centered>
  );
}

// --- Answers -------------------------------------------------------------------

export function DonePanel({
  result,
  kioskName,
  onNext,
}: {
  result: KioskPunchResult;
  kioskName: string;
  onNext: () => void;
}) {
  const inward = result.direction === "in";
  const at = new Date(result.at);
  return (
    <Centered>
      <StatusDisc tone="ok">
        <Check className="size-9" strokeWidth={1.8} />
      </StatusDisc>
      <Eyebrow tone="ok">{inward ? "Clocked in" : "Clocked out"}</Eyebrow>
      <PanelHeading className="sm:text-display-md">
        {inward ? "Welcome" : "Goodbye"}, {result.displayName}
      </PanelHeading>
      <p className="text-display-lg font-bold tracking-tight tabular-nums">
        <time dateTime={result.at}>{clockTime(at)}</time>
      </p>
      <p className="max-w-form text-base text-muted-foreground">
        {/* A kiosk punch in is validated as it is written (the PIN and the
            door are the proof). A punch out closes whatever record was open,
            which may have been opened elsewhere, so it claims less. */}
        {inward ? `Recorded and validated at ${kioskName}. Have a good shift.` : `Recorded at ${kioskName}. Rest well.`}
      </p>
      <p className="text-sm text-muted-foreground">This screen clears by itself for the next person.</p>
      <Button variant="secondary" size="lg" className={cn(ALT, "min-w-60")} onClick={onNext}>
        Next person
      </Button>
    </Centered>
  );
}

export function MismatchPanel({ onRetryPin, onRestart }: { onRetryPin: () => void; onRestart: () => void }) {
  return (
    <Centered>
      <StatusDisc tone="no">
        <SquareX className="size-9" strokeWidth={1.8} />
      </StatusDisc>
      <Eyebrow tone="no">Not recorded</Eyebrow>
      <PanelHeading>That staff number and PIN do not match</PanelHeading>
      {/* The board counts the tries left. The API does not say, and for an
          unknown number there is no count at all, so a number here would be
          made up or would tell a stranger the number is real. */}
      <p className="max-w-form text-base font-semibold">
        Five wrong PINs in a row lock a number on this kiosk for 15 minutes.
      </p>
      <p className="text-base text-muted-foreground">The kiosk never says which of the two was wrong.</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-3">
        <Button size="lg" className={GO} onClick={onRetryPin}>
          Type the PIN again
        </Button>
        <Button variant="secondary" size="lg" className={ALT} onClick={onRestart}>
          Start again
        </Button>
      </div>
    </Centered>
  );
}

export function LockedPanel({ until, onNext }: { until: Date | null; onNext: () => void }) {
  return (
    <Centered>
      <StatusDisc tone="no">
        <Lock className="size-9" strokeWidth={1.8} />
      </StatusDisc>
      <Eyebrow tone="no">Not recorded</Eyebrow>
      <PanelHeading>This number is locked on this kiosk</PanelHeading>
      <p className="max-w-form text-base">
        Five wrong PINs in a row. It unlocks{" "}
        {until ? (
          <>
            at <time dateTime={until.toISOString()}>{clockTime(until)}</time>
          </>
        ) : (
          "within 15 minutes"
        )}
        , or
        sooner if the front desk lifts the lock. The desk can also record your time for you.
      </p>
      <p className="text-base text-muted-foreground">Colleagues can still clock in here.</p>
      <Button variant="secondary" size="lg" className={cn(ALT, "mt-1.5 min-w-60")} onClick={onNext}>
        Next person
      </Button>
    </Centered>
  );
}

export function DoublePanel({ title, known, onNext }: { title: string; known: boolean; onNext: () => void }) {
  return (
    <Centered>
      <StatusDisc tone="note">
        <Info className="size-9" strokeWidth={1.8} />
      </StatusDisc>
      <Eyebrow tone="note">Already recorded</Eyebrow>
      <PanelHeading>{title}</PanelHeading>
      <p className="max-w-form text-base">
        {known
          ? "That was less than a minute ago, so this second tap is not counted. Nothing changed."
          : "So this second tap is not counted. Nothing changed."}
      </p>
      <Button variant="secondary" size="lg" className={cn(ALT, "mt-1.5 min-w-60")} onClick={onNext}>
        Next person
      </Button>
    </Centered>
  );
}

/** Any other refusal (the throttle, a conflict): the API's own sentence. */
export function RefusedPanel({ message, onRestart }: { message: string; onRestart: () => void }) {
  return (
    <Centered>
      <StatusDisc tone="no">
        <SquareX className="size-9" strokeWidth={1.8} />
      </StatusDisc>
      <Eyebrow tone="no">Not recorded</Eyebrow>
      <PanelHeading>That did not go through</PanelHeading>
      <p className="max-w-form text-base">{message}</p>
      <Button variant="secondary" size="lg" className={cn(ALT, "mt-1.5 min-w-60")} onClick={onRestart}>
        Start again
      </Button>
    </Centered>
  );
}

// --- Offline -----------------------------------------------------------------

export function OfflinePanel({
  lastReachedAt,
  lostMidPunch,
  retrying,
  onRetry,
}: {
  lastReachedAt: Date | null;
  lostMidPunch: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3.5">
      <div className="flex items-center gap-4">
        <StatusDisc tone="no" small>
          <WifiOff className="size-7" strokeWidth={1.8} />
        </StatusDisc>
        <div className="min-w-0">
          <PanelHeading>The kiosk cannot reach Injishi</PanelHeading>
          <p className="text-sm text-muted-foreground">
            {lastReachedAt ? (
              <>
                Last reached at <time dateTime={lastReachedAt.toISOString()}>{clockTime(lastReachedAt)}</time>.
              </>
            ) : (
              "It has not reached Injishi since it was switched on."
            )}{" "}
            It tries again every 30 seconds.
          </p>
        </div>
      </div>
      <p className="text-base">Nothing can be recorded here until it reconnects, and anything half typed was cleared.</p>
      {lostMidPunch ? (
        <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-base font-semibold text-danger-soft-foreground">
          The line dropped while a punch was on its way, so Injishi may have recorded it. Ask the front desk to check
          before you tap again.
        </p>
      ) : null}
      <h2 className="mt-1 text-base font-bold">Why it does not keep punches for later</h2>
      <p className="text-base">
        Your PIN is checked by Injishi, never by this tablet, and a punch takes Injishi’s time, not the tablet’s. A punch
        saved on the tablet could be neither checked nor timed.
      </p>
      <h2 className="mt-1 text-base font-bold">Meanwhile</h2>
      <div className="flex items-start gap-3 text-base">
        <ConciergeBell aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        <span>Ask at the front desk. Whoever runs attendance there can record your time for you.</span>
      </div>
      <div className="mt-1.5">
        <Button size="lg" className={GO} pending={retrying} onClick={onRetry}>
          <RefreshCw aria-hidden className="size-5" strokeWidth={1.8} />
          {retrying ? "Trying now" : "Try again now"}
        </Button>
      </div>
    </div>
  );
}
