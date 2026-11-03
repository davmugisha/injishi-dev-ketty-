"use client";

import { CircleCheck } from "@gravity-ui/icons";
import { Alert, Card, Chip } from "@heroui/react";
import { type ReactNode, useState } from "react";
import type { StepKey } from "@/server/mutations/setup";

/** The pieces every setup step is built from: its card, its outcome line and the press that saves it. */
export type Result = { ok: true } | { ok: false; error: string };

export const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function StepCard({
  id,
  index,
  title,
  done,
  icon,
  lead,
  children,
}: {
  id: StepKey;
  index: number;
  title: string;
  done: boolean;
  icon: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby={`step-${id}`} className="gap-4 p-5">
      <Card.Header className="flex flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-default text-muted">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`step-${id}`} className="text-[15px] leading-[22px] font-semibold">
            {index}. {title}
          </h2>
          <Card.Description>{lead}</Card.Description>
        </div>
        <Chip size="sm" variant="soft" color={done ? "success" : "default"}>
          {done ? "Done" : "To do"}
        </Chip>
      </Card.Header>
      {children}
    </Card>
  );
}

export function Outcome({ result, okText }: { result: Result | null; okText: string }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="flex items-center gap-1.5 text-[13px] text-success">
      <CircleCheck className="size-4" aria-hidden="true" />
      {okText}
    </p>
  ) : (
    <Alert status="danger" role="alert">
      <Alert.Content>
        <Alert.Title>Not saved</Alert.Title>
        <Alert.Description>{result.error}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** Run a server action and keep its outcome for the step it was pressed on. */
export function useStep() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const run = async (call: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setResult(null);
    const res = await call();
    setBusy(false);
    setResult(res.ok ? { ok: true } : { ok: false, error: res.error });
    return res.ok;
  };
  return { busy, result, run };
}

export const SELECT =
  "h-10 w-full rounded-xl border border-separator bg-field px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";
