"use client";

import { ArrowRightFromSquare, CircleCheckFill, LocationArrow, QrCode, TriangleExclamation } from "@gravity-ui/icons";
import { Button, Card } from "@heroui/react";
import { screenHref } from "@injishi/data";
import type { MyHr } from "@injishi/data/fixtures/shared";
import { locate } from "@injishi/product-hr/web";
import { LinkButton, PageContent } from "@injishi/ui";
import { useState, useTransition } from "react";
import { type ClockResult, clockMe } from "./actions";

const KIGALI_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

/**
 * The page a scanned entrance code opens: one big button that clocks the person in, or out when
 * they are in, with the code as the proof they are at the door. The phone's location goes with it,
 * so a photo of the code sent home still waits for HR.
 */
export function ScanClock({ code, data }: { code: string; data: MyHr | null }) {
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<ClockResult | null>(null);
  const employeeId = data?.person.employeeId ?? null;
  const open = data?.clock?.open ?? null;
  const direction = open ? "out" : "in";

  const press = () => {
    if (!employeeId) return;
    setLocating(true);
    void locate().then((fix) => {
      setLocating(false);
      startTransition(async () => setResult(await clockMe(employeeId, direction, { fix, code })));
    });
  };

  const meLink = (
    <LinkButton href={screenHref("MyHr")} variant="secondary" className="w-full">
      Go to Me
    </LinkButton>
  );

  let body: React.ReactNode;
  if (!data?.hasFile || !employeeId || data.readOnly) {
    body = (
      <Panel tone="muted" icon={<TriangleExclamation className="size-7" />} title="No staff file here">
        You have no active employee record at this business, so there is nothing to clock in to.
      </Panel>
    );
  } else if (!code) {
    body = (
      <Panel tone="muted" icon={<QrCode className="size-7" />} title="Scan the code again">
        Point your phone's camera at the code on the tablet by the entrance. It changes every 30 seconds.
      </Panel>
    );
  } else if (result?.ok) {
    body = (
      <Panel
        tone={result.counted ? "success" : "warning"}
        icon={result.counted ? <CircleCheckFill className="size-7" /> : <TriangleExclamation className="size-7" />}
        title={`${direction === "in" ? "In" : "Out"} at ${KIGALI_TIME.format(new Date())}`}
      >
        {result.message}
      </Panel>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <Panel
          tone="accent"
          icon={open ? <ArrowRightFromSquare className="size-7" /> : <LocationArrow className="size-7" />}
          title={open ? "Clock out" : "Clock in"}
        >
          {data.person.name}
          {data.clock?.branch ? ` · ${data.clock.branch}` : ""}
          {open ? ` · in since ${KIGALI_TIME.format(new Date(open.since))}` : ""}
        </Panel>
        {result && !result.ok ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {result.error}
          </p>
        ) : null}
        <Button size="lg" fullWidth isPending={pending || locating} onPress={press}>
          {locating ? "Finding you…" : open ? "Clock out now" : "Clock in now"}
        </Button>
      </div>
    );
  }

  return (
    <PageContent>
      <Card className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
        {body}
        {meLink}
      </Card>
    </PageContent>
  );
}

const TONE = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  muted: "bg-default text-muted",
} as const;

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span aria-hidden="true" className={`flex size-16 items-center justify-center rounded-full ${TONE[tone]}`}>
        {icon}
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
