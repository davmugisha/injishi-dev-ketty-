"use client";

import { ArrowLeft, ArrowsRotateLeft, Keyboard, QrCode, ShieldCheck } from "@gravity-ui/icons";
import { Button, Chip } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { Kiosk, StaffProfile } from "@injishi/data/fixtures/staff";
import { StatusDot } from "@injishi/ui";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand";

export type KioskScreen = "pin" | "qr" | "confirm" | "done";

export interface KioskStaff {
  name: string;
  firstName: string;
  profile: StaffProfile;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"] as const;

/**
 * Why nobody is clocked in here yet. The API's kiosk (`POST /api/v1/kiosk/punch`) answers only a tablet paired
 * with a one-time code, through a device cookie this app does not hold, and it takes an employee number with the
 * PIN. Until the tablet is paired this screen checks nothing, so it accepts no PIN and no card.
 */
const NOT_CONNECTED =
  "This kiosk is not connected to Injishi attendance yet, so it cannot check a PIN or a card. Ask the front desk or your supervisor to record your time.";

/** Camera area of the staff-card scanner: a live viewfinder, not a photo. */
function Viewfinder({ onScan }: { onScan: () => void }) {
  const reduce = useReducedMotion();
  return (
    <Button
      variant="tertiary"
      aria-label="Camera frame. Hold your staff card here"
      onPress={onScan}
      className="relative h-[300px] w-[360px] flex-col gap-[12px] overflow-hidden rounded-[28px] bg-surface-secondary text-muted shadow-[inset_0_0_0_3px_var(--accent)]"
    >
      <span
        aria-hidden="true"
        className="absolute top-[22px] left-[22px] size-9 rounded-tl-[14px] border-t-4 border-l-4 border-accent"
      />
      <span
        aria-hidden="true"
        className="absolute top-[22px] right-[22px] size-9 rounded-tr-[14px] border-t-4 border-r-4 border-accent"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[22px] left-[22px] size-9 rounded-bl-[14px] border-b-4 border-l-4 border-accent"
      />
      <span
        aria-hidden="true"
        className="absolute right-[22px] bottom-[22px] size-9 rounded-br-[14px] border-r-4 border-b-4 border-accent"
      />
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-[40px] h-[2px] rounded-full bg-accent opacity-70"
        initial={{ top: "20%" }}
        animate={reduce ? { top: "50%" } : { top: ["20%", "80%", "20%"] }}
        transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <QrCode className="size-[72px] opacity-70" aria-hidden="true" />
      <span className="text-sm">Card reader not connected</span>
    </Button>
  );
}

/**
 * Staff clock-in kiosk at the staff entrance: PIN or staff card (artifact: AttendanceKiosk). Not connected to the
 * API's kiosk yet (see NOT_CONNECTED), so it confirms nobody and clocks nobody in: a full PIN or a card held to the
 * camera says so instead. `staff`, `offline` and a `confirm`/`done` initial screen are accepted and unused.
 */
export function AttendanceKioskView({
  kiosk,
  initialScreen = "pin",
}: {
  kiosk: Kiosk;
  staff: KioskStaff;
  initialScreen?: KioskScreen;
  offline?: boolean;
}) {
  const [step, setStep] = useState<"pin" | "qr">(initialScreen === "qr" ? "qr" : "pin");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => {
    setStep("pin");
    setPin("");
    setErr(false);
  }, []);

  const press = useCallback(
    (d: string) => {
      const next = (pin + d).slice(0, 4);
      if (next.length < 4) {
        setPin(next);
        setErr(false);
        return;
      }
      // Nothing can check the PIN, so a full PIN opens nothing.
      setPin("");
      setErr(true);
    },
    [pin],
  );

  // Any tap or key press restarts the idle timer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const touch = () => {
      lastTap.current = Date.now();
    };
    touch();
    el.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", touch, true);
    return () => {
      el.removeEventListener("pointerdown", touch, true);
      window.removeEventListener("keydown", touch, true);
    };
  }, []);

  // Goes back to the start some seconds after the last tap.
  const idle = step === "pin" && pin === "" && !err;
  useEffect(() => {
    if (idle) return;
    const id = window.setInterval(() => {
      const left = kiosk.resetSeconds - Math.floor((Date.now() - lastTap.current) / 1000);
      if (left <= 0) reset();
    }, 250);
    return () => window.clearInterval(id);
  }, [idle, kiosk.resetSeconds, reset]);

  // A USB keypad or keyboard works on the PIN screen too.
  useEffect(() => {
    if (step !== "pin") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") {
        setPin("");
        setErr(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, press]);

  const pick = (s: "pin" | "qr") => {
    setStep(s);
    setPin("");
    setErr(false);
  };

  return (
    <div ref={rootRef} className="flex h-full min-h-[600px] w-full">
      <aside
        aria-label="Kiosk information"
        className="flex w-[392px] flex-none flex-col justify-between bg-surface px-[36px] pt-[36px] pb-[32px] shadow-[1px_0_0_var(--separator)]"
      >
        <div className="flex items-center gap-[12px]">
          <BrandMark size={36} />
          <div className="flex flex-col">
            <span className="text-base leading-[22px] font-semibold">{kiosk.hotel}</span>
            <span className="text-[13px] leading-[18px] text-muted">{kiosk.place}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[6px]">
          <span
            role="timer"
            aria-label={`Current time ${kiosk.time}`}
            className="text-[112px] leading-[112px] font-semibold tracking-[-0.04em] tabular"
          >
            {kiosk.time}
          </span>
          <span className="text-xl leading-7 font-medium">{kiosk.date}</span>
          <Chip color="warning" variant="soft" className="mt-[12px] self-start">
            <StatusDot tone="warning" />
            <Chip.Label>Not connected · clock in at the front desk</Chip.Label>
          </Chip>
        </div>

        <div className="flex flex-col gap-[10px]">
          <p className="flex items-start gap-[8px] text-[13px] leading-[18px] text-muted">
            <ShieldCheck className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
            <span>This kiosk shows only your name, photo, department and shift. Nothing else is kept on it.</span>
          </p>
          <p className="flex items-start gap-[8px] text-[13px] leading-[18px] text-muted">
            <ArrowsRotateLeft className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
            <span>Goes back to the start {kiosk.resetSeconds} seconds after the last tap.</span>
          </p>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[24px] p-[32px]">
        <Segment
          aria-label="How to clock in"
          size="lg"
          selectedKey={step}
          onSelectionChange={(k) => pick(k === "qr" ? "qr" : "pin")}
          className="absolute top-[28px]"
        >
          <Segment.Item id="pin" className="h-12 gap-[8px] px-[22px] text-[15px]">
            <Keyboard className="size-4" />
            PIN
          </Segment.Item>
          <Segment.Item id="qr" className="h-12 gap-[8px] px-[22px] text-[15px]">
            <QrCode className="size-4" />
            Staff card
          </Segment.Item>
        </Segment>

        {step === "pin" ? (
          <>
            <div className="mt-[40px] flex flex-col items-center gap-[6px] text-center">
              <h1 className="text-[28px] leading-9 font-semibold">Enter your staff PIN</h1>
              <p className="text-[15px] text-muted">4 digits. Forgot it? Ask your supervisor.</p>
            </div>
            <div
              role="img"
              aria-label={`${pin.length} of 4 digits entered`}
              className="flex min-h-6 items-center justify-center gap-[20px]"
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`size-[22px] rounded-full shadow-[inset_0_0_0_2px_var(--border)] ${
                    i < pin.length ? "bg-foreground" : ""
                  }`}
                />
              ))}
            </div>
            {err ? (
              <p role="alert" className="-mt-[8px] max-w-[440px] text-center text-[15px] text-warning-soft-foreground">
                {NOT_CONNECTED}
              </p>
            ) : null}
            <div className="grid grid-cols-[repeat(3,104px)] gap-[12px]">
              {KEYS.map((k) =>
                k === "clear" ? (
                  <Button
                    key={k}
                    variant="ghost"
                    aria-label="Clear PIN"
                    className="h-[76px] w-full rounded-[22px] text-base font-semibold"
                    onPress={() => {
                      setPin("");
                      setErr(false);
                    }}
                  >
                    Clear
                  </Button>
                ) : k === "del" ? (
                  <Button
                    key={k}
                    variant="ghost"
                    aria-label="Delete last digit"
                    className="h-[76px] w-full rounded-[22px]"
                    onPress={() => setPin((p) => p.slice(0, -1))}
                  >
                    <ArrowLeft className="size-6" />
                  </Button>
                ) : (
                  <Button
                    key={k}
                    variant="secondary"
                    aria-label={k}
                    className="h-[76px] w-full rounded-[22px] text-[28px] font-semibold tabular"
                    onPress={() => press(k)}
                  >
                    {k}
                  </Button>
                ),
              )}
            </div>
          </>
        ) : null}

        {step === "qr" ? (
          <>
            <div className="mt-[40px] flex flex-col items-center gap-[6px] text-center">
              <h1 className="text-[28px] leading-9 font-semibold">Scan your staff card</h1>
              <p className="text-[15px] text-muted">Hold the QR code on your card in the frame.</p>
            </div>
            <Viewfinder onScan={() => setErr(true)} />
            {err ? (
              <p role="alert" className="max-w-[440px] text-center text-[15px] text-warning-soft-foreground">
                {NOT_CONNECTED}
              </p>
            ) : null}
            <Button variant="ghost" size="lg" className="min-h-[52px]" onPress={() => pick("pin")}>
              No card? Use your PIN
            </Button>
          </>
        ) : null}
      </main>
    </div>
  );
}
