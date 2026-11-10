"use client";

import {
  ArrowRightFromSquare,
  CircleCheckFill,
  CircleXmark,
  LocationArrow,
  QrCode,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip } from "@heroui/react";
import type { MyHrClock } from "@injishi/data/fixtures/shared";
import { locate } from "@injishi/product-hr/web";
import { useState, useTransition } from "react";
import { type ClockResult, clockMe } from "./actions";

const KIGALI_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
const time = (iso: string) => KIGALI_TIME.format(new Date(iso));

/** What the branch's rule asks of the person, in a line. */
const RULE: Record<MyHrClock["mode"], string> = {
  anywhere: "Your location is checked when you clock in.",
  at_work: "You can clock in only at work. Your location is checked.",
  entrance: "Clock in at the entrance: scan the code on the tablet with your phone.",
};

/**
 * Me's clock-in card: in or out from the person's own phone or computer, by their branch's
 * clock-in rules. The browser is asked where it is at the press, never before; a refusal comes
 * back in the API's words ("You are 3.2 km from work…").
 */
export function ClockCard({ employeeId, clock }: { employeeId: string; clock: MyHrClock }) {
  const [now] = useState(() => new Date().toISOString());
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<ClockResult | null>(null);
  const opensLater = clock.opensAt !== null && clock.opensAt > now;
  const scanOnly = clock.mode === "entrance" && !clock.open;
  const direction = clock.open ? "out" : "in";

  const press = () => {
    setResult(null);
    setLocating(true);
    void locate().then((fix) => {
      setLocating(false);
      startTransition(async () => setResult(await clockMe(employeeId, direction, { fix })));
    });
  };

  const shiftLine = clock.shift
    ? `Shift ${time(clock.shift.startsAt)} – ${time(clock.shift.endsAt)}`
    : "No shift on the roster now";

  return (
    <Card aria-label="Clock in" className="gap-3 p-[18px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
            clock.open ? "bg-success-soft text-success" : "bg-default text-muted"
          }`}
        >
          {clock.open ? <ArrowRightFromSquare className="size-5" /> : <LocationArrow className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">
              {clock.open ? `Clocked in since ${time(clock.open.since)}` : "Not clocked in"}
            </span>
            {clock.open && !clock.open.checked ? (
              <Chip size="sm" color="warning" variant="soft">
                HR will check
              </Chip>
            ) : null}
          </span>
          <span className="text-sm text-muted">
            {shiftLine}
            {clock.branch ? ` · ${clock.branch}` : ""}
          </span>
          <span className="text-xs text-muted">{RULE[clock.mode]}</span>
        </div>
        {scanOnly ? (
          <Chip size="lg" variant="soft" className="self-start sm:self-center">
            <QrCode className="size-4" aria-hidden="true" />
            <Chip.Label>Scan at the entrance</Chip.Label>
          </Chip>
        ) : opensLater && !clock.open ? (
          <Button isDisabled variant="secondary" className="self-start sm:self-center">
            Opens at {time(clock.opensAt ?? now)}
          </Button>
        ) : (
          <Button
            variant={clock.open ? "secondary" : "primary"}
            isPending={pending || locating}
            onPress={press}
            className="w-full sm:w-auto sm:self-center"
          >
            {clock.open ? (
              <ArrowRightFromSquare className="size-4" aria-hidden="true" />
            ) : (
              <LocationArrow className="size-4" aria-hidden="true" />
            )}
            {locating ? "Finding you…" : clock.open ? "Clock out" : "Clock in"}
          </Button>
        )}
      </div>
      {result ? (
        <Alert status={!result.ok ? "danger" : result.counted ? "success" : "warning"}>
          <Alert.Indicator>
            {!result.ok ? <CircleXmark /> : result.counted ? <CircleCheckFill /> : <TriangleExclamation />}
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{result.ok ? result.message : result.error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </Card>
  );
}
