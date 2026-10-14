"use client";

import {
  ArrowLeft,
  ArrowRightToSquare,
  ArrowsRotateLeft,
  CircleCheck,
  Clock,
  CloudSlash,
  Keyboard,
  QrCode,
  ShieldCheck,
} from "@gravity-ui/icons";
import { Button, Card, Chip, Label, ProgressBar } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { Kiosk, StaffProfile } from "@injishi/data/fixtures/staff";
import { stock } from "@injishi/data/media";
import { Photo, StatusDot } from "@injishi/ui";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand";
import { ToneTile } from "./parts";

export type KioskScreen = "pin" | "qr" | "confirm" | "done";

export interface KioskStaff {
  name: string;
  firstName: string;
  profile: StaffProfile;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"] as const;

/** The PIN the demo treats as unknown (any other 4 digits match the demo staff member). */
const UNKNOWN_PIN = "0000";

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
      <span className="text-sm">Looking for a card…</span>
    </Button>
  );
}

/** Staff clock-in kiosk at the staff entrance: PIN or staff card, confirm, done (artifact: AttendanceKiosk). */
export function AttendanceKioskView({
  kiosk,
  staff,
  initialScreen = "pin",
  offline = false,
}: {
  kiosk: Kiosk;
  staff: KioskStaff;
  initialScreen?: KioskScreen;
  offline?: boolean;
}) {
  const [step, setStep] = useState<KioskScreen>(initialScreen);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const [remaining, setRemaining] = useState(kiosk.resetSeconds);
  const { profile } = staff;

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
      setPin("");
      if (next === UNKNOWN_PIN) {
        setErr(true);
        return;
      }
      setErr(false);
      setStep("confirm");
    },
    [pin],
  );

  // Any tap or key press restarts the idle timer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const touch = () => {
      lastTap.current = Date.now();
      setRemaining(kiosk.resetSeconds);
    };
    touch();
    el.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", touch, true);
    return () => {
      el.removeEventListener("pointerdown", touch, true);
      window.removeEventListener("keydown", touch, true);
    };
  }, [kiosk.resetSeconds]);

  // Goes back to the start 10 seconds after the last tap (counted down on the done screen).
  const idle = step === "pin" && pin === "" && !err;
  useEffect(() => {
    if (idle) return;
    const id = window.setInterval(() => {
      const left = kiosk.resetSeconds - Math.floor((Date.now() - lastTap.current) / 1000);
      if (left <= 0) reset();
      else setRemaining(left);
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

  const pick = (s: KioskScreen) => {
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
          <Chip color={offline ? "warning" : "success"} variant="soft" className="mt-[12px] self-start">
            <StatusDot tone={offline ? "warning" : "success"} />
            <Chip.Label>
              {offline ? `Offline · ${kiosk.queued} clock-ins waiting to send` : "Online · times sent straight away"}
            </Chip.Label>
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
        {step === "pin" || step === "qr" ? (
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
        ) : null}

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
              <p role="alert" className="-mt-[8px] text-[15px] text-danger-soft-foreground">
                PIN not found. Try again, or ask your supervisor.
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
            <Viewfinder onScan={() => setStep("confirm")} />
            <Button variant="ghost" size="lg" className="min-h-[52px]" onPress={() => pick("pin")}>
              No card? Use your PIN
            </Button>
          </>
        ) : null}

        {step === "confirm" ? (
          <>
            <h1 className="text-[28px] leading-9 font-semibold">Is this you?</h1>
            <Card className="w-[440px] items-center gap-[14px] px-[40px] py-[28px] text-center">
              {profile.photo ? (
                <div role="img" aria-label="Staff photo" className="relative size-[140px] overflow-hidden rounded-full">
                  <Photo image={stock[profile.photo]} alt="" fill priority sizes="140px" className="object-[50%_30%]" />
                </div>
              ) : null}
              <div className="flex flex-col items-center gap-[2px]">
                <span className="text-[28px] leading-9 font-semibold">{staff.name}</span>
                <span className="text-base leading-[22px] text-muted">
                  {profile.department} · {profile.area}
                </span>
              </div>
              <Chip variant="soft">
                <Clock className="size-3" />
                <Chip.Label>Today {profile.shift}</Chip.Label>
              </Chip>
            </Card>
            <div className="grid w-[440px] grid-cols-[1fr_1.6fr] gap-[12px]">
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                className="h-[72px] rounded-[22px] text-[17px]"
                onPress={reset}
              >
                Not you?
              </Button>
              <Button
                size="lg"
                fullWidth
                className="h-[72px] rounded-[22px] text-[17px]"
                onPress={() => setStep("done")}
              >
                <ArrowRightToSquare className="size-5" />
                Clock in
              </Button>
            </div>
            <p className="text-[13px] text-muted">Not you? Nothing is saved. The kiosk goes back to the start.</p>
          </>
        ) : null}

        {step === "done" ? (
          <div role="status" className="flex w-[480px] flex-col items-center gap-[16px] text-center">
            <ToneTile tone={offline ? "warning" : "success"} className="size-[112px] rounded-[36px] [&>svg]:size-14">
              {offline ? <CloudSlash /> : <CircleCheck />}
            </ToneTile>
            <h1 className="text-[40px] leading-[48px] font-semibold tracking-[-0.02em] tabular">
              {offline ? `Saved on this kiosk · ${kiosk.time}` : `Clocked in ${kiosk.time}`}
            </h1>
            <p className="text-xl leading-7 font-medium">
              Shift {profile.shift} · {profile.area}
            </p>
            <p className="text-[15px] leading-[22px] text-muted">
              {offline
                ? "No connection right now. Your time is kept from the kiosk clock and sends to your attendance record when the connection is back."
                : `Have a good shift, ${staff.firstName}. Your rooms are on your phone.`}
            </p>
            <ProgressBar
              aria-label="Time until the kiosk resets"
              value={((kiosk.resetSeconds - remaining) / kiosk.resetSeconds) * 100}
              valueLabel={`in ${remaining} s`}
              className="mt-[8px] flex w-[320px] flex-col gap-[6px]"
            >
              <div className="flex items-center justify-between">
                <Label>Next person</Label>
                <ProgressBar.Output className="tabular" />
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <Button variant="secondary" size="lg" className="h-16 w-[240px] rounded-[22px] text-[17px]" onPress={reset}>
              Done
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
