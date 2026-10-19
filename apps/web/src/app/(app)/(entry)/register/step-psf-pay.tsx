"use client";

import { useState } from "react";
import type { RegistrationSummary } from "@injishi/contracts";
import { Badge, Button, Checkbox } from "@injishi/ui";
import { ArrowRight, BadgeCheck, ClipboardCheck, Copy, Check, Wallet } from "lucide-react";

import { EMPTY_ADDRESS, useAddressLine, type AddressDraft } from "./address-picker";
import { StepCard } from "./register-shell";
import type { ReadBackRow } from "./step-review-pay";
import { Notice, formatRwf } from "./wizard-ui";

/**
 * Check and pay, on the PSF path.
 *
 * A PSF business signs no operator contract: it lists nothing on the
 * marketplace, which is what that contract governs. So this step is the hotel
 * one without the agreement and the signature: one read back with a Change on
 * every row, the one time fee, a single confirmation that the details are true
 * and may go to PSF, and one press that creates the registration and pays it.
 * The server issues the business code the moment the fee settles.
 *
 * THE PAYMENT IS NOT MOBILE MONEY YET, and the screen says so, as the hotel step
 * does: `POST /registrations/:id/pay` is the stand-in for the payment provider.
 */
export function StepPsfPay({
  rows,
  whereAddress,
  amount,
  busy,
  error,
  onPay,
  onBack,
  onChange,
}: {
  rows: ReadBackRow[];
  whereAddress: AddressDraft | null;
  amount: number | null;
  busy: boolean;
  error: string;
  onPay: () => Promise<void>;
  onBack: (() => void) | null;
  onChange: (step: "about" | "business" | "place") => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [localError, setLocalError] = useState("");
  const where = useAddressLine(whereAddress ?? EMPTY_ADDRESS);
  const all: ReadBackRow[] = [
    ...rows.slice(0, 1),
    ...(whereAddress ? [{ label: "Where", value: where ?? "Not chosen", change: "business" as const }] : []),
    ...rows.slice(1),
  ];

  async function pay() {
    if (!confirmed) {
      setLocalError("Confirm the details first.");
      return;
    }
    setLocalError("");
    await onPay();
  }

  return (
    <StepCard
      id="register-psf-pay"
      title="Check and pay"
      lead="One last look. Change anything here, and it opens the step that asked."
      footer={
        <>
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void pay()} pending={busy} disabled={amount === null}>
            {busy ? "Registering…" : amount !== null ? `Pay ${formatRwf(amount)} and register` : "Registration is not open yet"}
          </Button>
        </>
      }
    >
      <dl className="divide-y divide-border rounded-card border border-border">
        {all.map((r) => (
          <div key={r.label} className="flex items-start gap-3 px-4 py-3">
            <dt className="w-28 shrink-0 text-sm text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 grow text-sm font-medium break-words">{r.value}</dd>
            {r.change ? (
              <button
                type="button"
                onClick={() => onChange(r.change as "about" | "business" | "place")}
                className="shrink-0 rounded text-sm font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Change
              </button>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 rounded-card bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
            <Wallet size={20} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-semibold">Registration fee</p>
            <p className="text-xs text-muted-foreground">Once, never again. Your PSF membership fee is separate.</p>
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums">{amount !== null ? formatRwf(amount) : "—"}</p>
      </div>

      <Checkbox
        isSelected={confirmed}
        onChange={(on: boolean) => setConfirmed(on)}
        className="items-start gap-3"
        controlClassName="mt-0.5"
      >
        <span className="text-sm">
          These details are true, and Injishi may share them with the Private Sector Federation (PSF) so it can find my
          business and decide my membership.
        </span>
      </Checkbox>

      <Notice tone="info">
        Paying is recorded here for now: mobile money arrives with the payment provider, and no prompt goes to your phone yet.
      </Notice>
      {localError || error ? <Notice tone="danger">{localError || error}</Notice> : null}
    </StepCard>
  );
}

/**
 * Registered, on the PSF path: the business code, and the way on.
 *
 * The code is the screen's one large thing, because it is what PSF will ask for
 * from now on. Under it, the three steps that follow, with the first one, apply
 * for membership, as the button.
 */
export function PsfRegistered({ summary }: { summary: RegistrationSummary }) {
  const [copied, setCopied] = useState(false);
  const pending = summary.status !== "active";
  const copy = async () => {
    if (!summary.businessCode) return;
    try {
      await navigator.clipboard.writeText(summary.businessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The code is on the screen to copy by hand.
    }
  };

  return (
    <StepCard
      id="register-psf-done"
      chip={
        <Badge variant={pending ? "warning" : "success"} size="sm">
          {pending ? "Waiting for the RRA check" : "Registered"}
        </Badge>
      }
      title={pending ? `${summary.legalName} is almost registered` : `${summary.legalName} is registered`}
      lead={
        pending
          ? "Your fee is paid. RRA is checking your TIN, and your business is registered the moment it answers. We email you."
          : "PSF can now find your business. Keep your code: PSF asks for it whenever you deal with them."
      }
      footer={
        <>
          <Button asChild variant="ghost">
            <a href="/start">Go to my account</a>
          </Button>
          <Button asChild>
            <a href={`/w/${summary.workspaceId}/psf-membership`}>
              Apply for PSF membership <ArrowRight size={16} aria-hidden="true" />
            </a>
          </Button>
        </>
      }
    >
      {summary.businessCode ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-secondary px-6 py-6 text-center">
          <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Your business code</span>
          <span className="font-mono text-4xl font-bold tracking-[0.08em] tabular-nums">{summary.businessCode}</span>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded text-sm font-semibold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "Copied" : "Copy the code"}
          </button>
        </div>
      ) : null}

      <ol className="grid gap-3 sm:grid-cols-3">
        <NextStep icon={ClipboardCheck} n={1} title="Apply" text="Pick the membership your business can afford, and the amount you will pay a year." />
        <NextStep icon={BadgeCheck} n={2} title="PSF reviews" text="A PSF officer for your district reads your application and approves it." />
        <NextStep icon={Wallet} n={3} title="Pay and join" text="You pay the fee by mobile money in your portal, and your membership starts that day." />
      </ol>
    </StepCard>
  );
}

function NextStep({
  icon: Icon,
  n,
  title,
  text,
}: {
  icon: typeof Wallet;
  n: number;
  title: string;
  text: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border p-4">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full border border-border">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="text-xs font-semibold text-muted-foreground">Step {n}</span>
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  );
}
