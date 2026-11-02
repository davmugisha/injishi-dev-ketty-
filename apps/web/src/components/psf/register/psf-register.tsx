"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { PsfCatalogue, PsfFeesView, PsfPublicSubmitResult, PsfTier } from "@injishi/contracts";
import { Button } from "@injishi/web-ui";

import { Notice } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchPsfCatalogue, fetchPsfFees, fetchPsfTiers, submitPsfApplication } from "@/data/psf";
import { apiResultMessage, retryWhileFailed } from "@/lib/api";

import {
  EMPTY_DRAFT,
  STEPS,
  clearDraft,
  loadDraft,
  rwf,
  saveDraft,
  stepOfPath,
  toRequest,
  validateBusiness,
  validateMembership,
  validatePlace,
  validateReview,
  validateYou,
  type Errors,
  type PsfDraft,
  type StepKey,
} from "./draft";
import { RegisterDone } from "./register-done";
import { StepBusiness } from "./step-business";
import { StepMembership } from "./step-membership";
import { StepPlace } from "./step-place";
import { StepReview } from "./step-review";
import { StepYou } from "./step-you";

/**
 * Join PSF (the public PSF path, 2026-10-19): one form, five steps, no account.
 *
 * Your business → Where it trades → You → Membership → Check and pay. The
 * business comes first, its TIN at the top, and where it trades is a step of
 * its own so neither is long (2026-11-02); the ID check follows, so its 30-minute
 * token is fresh for the payment, and the logo, which uploads under that
 * token, is asked for on the last step. Each step is checked
 * against the same contract schemas the API validates with before it lets the
 * person on, so a refusal at the end is rare; when the server does refuse a
 * field, the form goes back to the step that asked for it and puts the message
 * under the field.
 */
export function PsfRegister() {
  const [draft, setDraft] = useState<PsfDraft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<StepKey>("business");
  const [reached, setReached] = useState<number>(0);
  const [errors, setErrors] = useState<Errors>({});
  /** Steps the person has tried to leave: from then on their messages follow the answers live. */
  const [tried, setTried] = useState<ReadonlySet<StepKey>>(new Set());
  const [tiers, setTiers] = useState<PsfTier[] | null>(null);
  const [catalogue, setCatalogue] = useState<PsfCatalogue | null>(null);
  /** PSF's prices in the business's district; the amount is never the business's own. */
  const [fees, setFees] = useState<PsfFeesView | null>(null);
  const [feesTick, setFeesTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<PsfPublicSubmitResult | null>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(loadDraft());
    setLoaded(true);
    void retryWhileFailed(fetchPsfTiers).then((r) => r.status === "ok" && setTiers(r.data));
  }, []);
  useEffect(() => {
    if (loaded && !done) saveDraft(draft);
  }, [draft, loaded, done]);
  // The subtypes depend on where the business is: national ones, and the
  // district's own once a district is chosen.
  const districtForCatalogue = loaded ? Number(draft.districtId) || undefined : -1;
  useEffect(() => {
    if (districtForCatalogue === -1) return;
    void retryWhileFailed(() => fetchPsfCatalogue(districtForCatalogue)).then((r) => r.status === "ok" && setCatalogue(r.data));
  }, [districtForCatalogue]);

  // The prices follow the district too, and are read again on each visit to
  // the membership step, so the amount shown is the one PSF charges now.
  const districtForFees = loaded ? Number(draft.districtId) || 0 : 0;
  useEffect(() => {
    setFees((f) => (f && f.districtId === districtForFees ? f : null));
    if (!districtForFees) return;
    void retryWhileFailed(() => fetchPsfFees(districtForFees)).then((r) => r.status === "ok" && setFees(r.data));
  }, [districtForFees, feesTick]);
  // A band picked starts at its price; the business may raise it within the
  // band (2026-10-23), so an amount already typed is kept and checked instead.
  const priceOfPicked = fees?.fees.find((f) => f.tierCode === draft.tierCode)?.amountRwf ?? null;
  useEffect(() => {
    if (!fees || !draft.tierCode || draft.amount.trim() !== "" || priceOfPicked === null) return;
    setDraft((d) => ({ ...d, amount: String(priceOfPicked) }));
  }, [fees, draft.tierCode, draft.amount, priceOfPicked]);

  const index = STEPS.findIndex((s) => s.key === step);
  const change = (next: Partial<PsfDraft>) => setDraft((d) => ({ ...d, ...next }));
  const go = (key: StepKey) => {
    if (key === "membership") setFeesTick((t) => t + 1);
    setStep(key);
    setProblem(null);
    setReached((r) => Math.max(r, STEPS.findIndex((s) => s.key === key)));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validate = (key: StepKey): Errors =>
    key === "you"
      ? validateYou(draft)
      : key === "business"
        ? validateBusiness(draft)
        : key === "place"
          ? validatePlace(draft)
          : key === "membership"
            ? validateMembership(draft, tiers ?? [], fees)
            : validateReview(draft);

  // Once a step has been tried, each answer re-checks it: a message goes the
  // moment its field is right, and stays while it is still wrong.
  useEffect(() => {
    if (!tried.has(step)) return;
    setErrors(validate(step));
  }, [draft, tiers, fees, step, tried]);

  const next = async () => {
    setTried((t) => new Set(t).add(step));
    const found = validate(step);
    if (Object.keys(found).length) {
      setErrors(found);
      setProblem("Some answers need a look. They are marked below.");
      return;
    }
    if (step === "membership" && !draft.payer) setDraft((d) => ({ ...d, payer: d.phone.startsWith("+2507") ? d.phone : "" }));
    setErrors({});
    if (step !== "review") return go(STEPS[index + 1]!.key);

    setBusy(true);
    setProblem(null);
    const res = await submitPsfApplication(toRequest(draft));
    setBusy(false);
    if (res.status === "ok") {
      clearDraft();
      setDone(res.data);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (res.status === "refused" && res.httpStatus === 410) {
      setDraft((d) => ({ ...d, applicant: null }));
      go("you");
      setProblem(res.message);
      return;
    }
    if (res.status === "refused" && res.issues?.length) {
      const mapped: Errors = {};
      for (const i of res.issues) mapped[i.path.join(".")] = i.message;
      setErrors(mapped);
      go(stepOfPath(res.issues[0]!.path.join(".")));
      // Said here too: an answer the step has no field for would otherwise be marked nowhere.
      setProblem(`PSF's form needs a change: ${res.issues[0]!.message}`);
      return;
    }
    setProblem(apiResultMessage(res));
  };

  const declared = Number(draft.amount.replace(/[^\d]/g, ""));
  // The one payment is the membership fee: no registration fee (2026-10-23).
  const total = declared > 0 ? declared : null;

  if (done) {
    return (
      <div ref={top} className="container scroll-mt-24 py-10">
        <RegisterDone
          docId={done.docId}
          businessCode={done.businessCode}
          businessName={draft.legalName}
          feePaid={done.feePaid}
          feeProblem={done.feeProblem}
          districtName={draft.placeNames.district}
        />
      </div>
    );
  }

  return (
    <div ref={top} className="container scroll-mt-24 py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/psf" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden /> Back to PSF
        </Link>
        <Link href="/psf/track" className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
          Already applied? Track it
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17rem_1fr] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Join PSF</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Register your business</h1>
          <p className="mt-2 text-sm text-muted-foreground">About ten minutes. No account needed: you get a docID to follow your application.</p>

          {/* Mobile: a bar. Desktop: the rail. */}
          <div className="mt-6 lg:hidden">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{STEPS[index]!.title}</span>
              <span className="text-muted-foreground">
                Step {index + 1} of {STEPS.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-accent-brand transition-all" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>
          <ol className="mt-8 hidden list-none flex-col gap-1 p-0 lg:flex">
            {STEPS.map((s, i) => {
              const state = i < index ? "done" : i === index ? "current" : "todo";
              const canJump = i <= reached && i !== index;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => go(s.key)}
                    className={[
                      "flex w-full items-start gap-3 rounded-card p-3 text-left transition-colors",
                      state === "current" ? "bg-card shadow-sm ring-1 ring-border" : canJump ? "hover:bg-secondary" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        state === "done" ? "bg-accent-brand text-accent-brand-foreground" : state === "current" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground ring-1 ring-border",
                      ].join(" ")}
                    >
                      {state === "done" ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span>
                      <span className={["block text-sm font-semibold", state === "todo" ? "text-muted-foreground" : ""].join(" ")}>{s.title}</span>
                      <span className="block text-xs text-muted-foreground">{s.key === "review" && total ? `${rwf(total)}, one payment` : s.sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="min-w-0">
          <div className="rounded-card border border-border bg-card p-5 shadow-sm sm:p-8">
            {!loaded ? (
              <div className="h-80 animate-pulse rounded-card bg-secondary" />
            ) : step === "you" ? (
              <StepYou draft={draft} onChange={change} errors={errors} />
            ) : step === "business" ? (
              <StepBusiness draft={draft} onChange={change} errors={errors} catalogue={catalogue} />
            ) : step === "place" ? (
              <StepPlace draft={draft} onChange={change} errors={errors} />
            ) : step === "membership" ? (
              <StepMembership draft={draft} onChange={change} errors={errors} tiers={tiers} fees={fees} districtName={draft.placeNames.district} />
            ) : (
              <StepReview draft={draft} onChange={change} errors={errors} tiers={tiers} catalogue={catalogue} goTo={go} />
            )}

            {problem ? (
              <div className="mt-6">
                <Notice tone="danger">{problem}</Notice>
              </div>
            ) : null}

            <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
              {index > 0 ? (
                <Button variant="outline" onClick={() => go(STEPS[index - 1]!.key)}>
                  <ArrowLeft size={16} aria-hidden /> Back
                </Button>
              ) : null}
              <span className="grow" />
              <Button variant="primary" size="lg" onClick={() => void next()} pending={busy} disabled={busy || (step === "you" && !draft.applicant)}>
                {step === "review" ? `Pay ${total ? rwf(total) : "and send"}${total ? " and send" : ""}` : "Continue"}
                {step === "review" ? null : <ArrowRight size={16} aria-hidden />}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
