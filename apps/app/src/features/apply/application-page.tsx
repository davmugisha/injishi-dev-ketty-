"use client";

import { Calendar, CircleCheck, Envelope, FileArrowUp, MapPin, Person } from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Label, TextField, Toast, toast } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { type ApplyResult, respondAction, sendCodeAction, uploadDocumentAction, verifyCodeAction } from "./actions";
import type { ApplicationRead, ApplicationView } from "./application";

const STEPS = [
  { id: "applied", title: "Applied" },
  { id: "screening", title: "Review" },
  { id: "interview", title: "Interview" },
  { id: "offer", title: "Offer" },
  { id: "hired", title: "Hired" },
] as const;

const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kigali",
  }).format(new Date(iso));

/**
 * An applicant's own page: locked until a code from their email opens it, then their steps, their
 * interview, the documents the role asks for (sent from here) and the offer, which they take or
 * answer with another figure.
 */
export function ApplicationPage({ token, read }: { token: string; read: ApplicationRead }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:py-12">
      <p className="text-sm font-semibold text-accent">Injishi</p>
      {read.state === "missing" ? (
        <Card className="gap-2 p-5">
          <h1 className="text-xl font-semibold">This link is not right</h1>
          <p className="text-sm text-muted">
            Open the link in the latest email we sent you, or ask the business for it again.
          </p>
        </Card>
      ) : read.state === "locked" ? (
        <Unlock token={token} />
      ) : (
        <Opened token={token} view={read.view} />
      )}
      <Toast.Provider placement="bottom" />
    </main>
  );
}

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (task: () => Promise<ApplyResult>, done?: string, after?: (r: ApplyResult) => void) =>
    start(async () => {
      const r = await task();
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      if (done) toast.success(done);
      after?.(r);
      router.refresh();
    });
  return { pending, act };
}

/** The lock: a code to the address they applied with, then the code typed here. */
function Unlock({ token }: { token: string }) {
  const { pending, act } = useAct();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Open your application</h1>
        <p className="text-sm text-muted">
          {sentTo
            ? `We sent a six digit code to ${sentTo}. It works for 10 minutes.`
            : "We email a code to the address you applied with, so only you can open it."}
        </p>
      </div>
      {sentTo ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField value={code} onChange={setCode} className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">Code</Label>
            <Input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="tracking-widest" />
          </TextField>
          <Button
            isPending={pending}
            isDisabled={code.replace(/\D/g, "").length !== 6}
            onPress={() => act(() => verifyCodeAction(token, code))}
          >
            Open
          </Button>
          <Button
            variant="ghost"
            isDisabled={pending}
            onPress={() => act(() => sendCodeAction(token), "A new code is on its way.")}
          >
            Send again
          </Button>
        </div>
      ) : (
        <Button
          className="self-start"
          isPending={pending}
          onPress={() =>
            act(
              () => sendCodeAction(token),
              undefined,
              (r) => r.ok && setSentTo(r.sentTo ?? "your email"),
            )
          }
        >
          <Envelope className="size-4" aria-hidden="true" />
          Email me a code
        </Button>
      )}
    </Card>
  );
}

function Opened({ token, view }: { token: string; view: ApplicationView }) {
  const at = view.branch ?? view.business;
  const stepIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.id === view.stage),
  );
  return (
    <>
      <Card className="gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Hi {view.firstName}</h1>
          <p className="text-sm text-muted">
            {view.role} · {at}
          </p>
        </div>
        {view.stage === "rejected" ? (
          <div className="flex flex-col gap-1 rounded-xl bg-surface-secondary p-3 text-sm">
            <span className="font-semibold">This application is closed</span>
            <span className="text-muted">
              {view.closedReason ?? "This time the business chose another candidate. Thank you for applying."}
            </span>
          </div>
        ) : (
          <Stepper size="sm" currentStep={stepIdx} aria-label="Your application">
            {STEPS.map((s) => (
              <Stepper.Step key={s.id}>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title className="text-[11px]">{s.title}</Stepper.Title>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            ))}
          </Stepper>
        )}
      </Card>

      {view.offer ? <Offer token={token} offer={view.offer} /> : null}

      {view.interview && view.stage !== "rejected" ? (
        <Card className="gap-2 p-5">
          <h2 className="text-base font-semibold">Your interview</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Calendar className="size-4 text-muted" aria-hidden="true" />
              {when(view.interview.startsAt)}
            </li>
            {view.interview.place ? (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-muted" aria-hidden="true" />
                {view.interview.place}
              </li>
            ) : null}
            {view.interview.interviewerName ? (
              <li className="flex items-center gap-2">
                <Person className="size-4 text-muted" aria-hidden="true" />
                With {view.interview.interviewerName}
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {view.documents.length && view.stage !== "rejected" ? (
        <Documents token={token} documents={view.documents} />
      ) : null}

      <p className="text-center text-xs text-muted">Questions? Reply to any of our emails.</p>
    </>
  );
}

/** The documents the role asks for: what arrived, and a button to send each one. */
function Documents({ token, documents }: { token: string; documents: ApplicationView["documents"] }) {
  const { pending, act } = useAct();
  const [busy, setBusy] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const sent = documents.filter((d) => d.filename).length;
  const send = (name: string, file: File) => {
    setBusy(name);
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    act(
      () => uploadDocumentAction(token, form),
      `${name} sent.`,
      () => setBusy(null),
    );
  };
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Documents</h2>
        <span className="text-xs text-muted tabular">
          {sent} of {documents.length} sent
        </span>
      </div>
      <p className="text-xs text-muted">A PDF or a photo, 10 MB at most.</p>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = picker.current?.dataset.name;
          e.target.value = "";
          if (file && name) send(name, file);
        }}
      />
      <ul className="flex flex-col">
        {documents.map((d) => (
          <li key={d.name} className="flex items-center gap-3 border-t border-separator py-2.5 first:border-t-0">
            {d.filename ? (
              <CircleCheck className="size-5 shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <span
                aria-hidden="true"
                className="size-5 shrink-0 rounded-full border-[1.5px] border-dashed border-muted"
              />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{d.name}</span>
              <span className="truncate text-xs text-muted">{d.filename ?? "Not sent yet"}</span>
            </span>
            <Button
              size="sm"
              variant={d.filename ? "ghost" : "secondary"}
              isPending={pending && busy === d.name}
              isDisabled={pending}
              onPress={() => {
                if (!picker.current) return;
                picker.current.dataset.name = d.name;
                picker.current.click();
              }}
            >
              <FileArrowUp className="size-4" aria-hidden="true" />
              {d.filename ? "Replace" : "Send"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The offer: its figure, the back and forth so far, and their answer when it is their turn. */
function Offer({ token, offer }: { token: string; offer: NonNullable<ApplicationView["offer"]> }) {
  const { pending, act } = useAct();
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState({ amount: "", note: "" });
  const askRwf = Number(ask.amount.replace(/\D/g, ""));
  return (
    <Card className="gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{offer.agreedRwf !== null ? "Your wage is agreed" : "Our offer"}</h2>
        {offer.agreedRwf !== null ? (
          <Chip size="sm" variant="soft" color="success">
            Agreed
          </Chip>
        ) : null}
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold tabular">{rwf(offer.agreedRwf ?? offer.amountRwf)}</span>
        <span className="text-sm text-muted">a month{offer.startsOn ? ` · first day ${day(offer.startsOn)}` : ""}</span>
      </div>
      {offer.rounds.length > 1 ? (
        <ol aria-label="So far" className="flex flex-col gap-1 border-t border-separator pt-2 text-sm">
          {offer.rounds.map((r) => (
            <li key={r.createdAt} className="flex flex-col">
              <span>
                {r.side === "business" ? "We offered" : "You asked"}{" "}
                <span className="font-semibold tabular">{rwf(r.amountRwf)}</span>
              </span>
              {r.note ? <span className="text-xs text-muted">{r.note}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {offer.canRespond ? (
        asking ? (
          <div className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
            <TextField
              value={ask.amount}
              onChange={(v) => setAsk((a) => ({ ...a, amount: v }))}
              className="flex flex-col gap-1"
            >
              <Label className="text-xs">The monthly wage you ask (RWF)</Label>
              <Input inputMode="numeric" placeholder="350,000" />
            </TextField>
            <TextField
              value={ask.note}
              onChange={(v) => setAsk((a) => ({ ...a, note: v }))}
              className="flex flex-col gap-1"
            >
              <Label className="text-xs">Why (optional)</Label>
              <Input placeholder="Five years as a sous chef" />
            </TextField>
            <div className="flex gap-2">
              <Button
                isPending={pending}
                isDisabled={!askRwf}
                onPress={() =>
                  act(
                    () => respondAction(token, { askRwf, note: ask.note }),
                    "We have your answer.",
                    () => setAsking(false),
                  )
                }
              >
                Send my answer
              </Button>
              <Button variant="ghost" onPress={() => setAsking(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              isPending={pending}
              onPress={() => act(() => respondAction(token, { accept: true }), "You accepted the offer.")}
            >
              Accept the offer
            </Button>
            <Button variant="secondary" isDisabled={pending} onPress={() => setAsking(true)}>
              Ask for another figure
            </Button>
          </div>
        )
      ) : offer.agreedRwf === null ? (
        <p className="text-sm text-muted">We have your answer and will come back to you.</p>
      ) : null}
    </Card>
  );
}
