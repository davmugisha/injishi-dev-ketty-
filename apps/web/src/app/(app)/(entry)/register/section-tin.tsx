"use client";

import {
  PSF_COMPANY_TYPE_LABEL,
  type RegistrantCapacity,
  type RegistryBusiness,
  type TinCheckResult,
} from "@injishi/contracts";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  CloudOff,
  LoaderCircle,
  Lock,
  MessageCircle,
  RotateCw,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import { Button } from "@injishi/web-ui";

import { formatTin, normalizeTin, sameName } from "./business-draft";
import { Callout } from "./register-shell";
import { ChoiceTile, Field, Offline, TextInput } from "./wizard-ui";

/**
 * Business name and TIN (Register.dc.html, Business's first section).
 *
 * The person types the name as they know it and the nine digits, and
 * "Validate with RRA" asks the company register (`POST /registrations/tin-check`).
 * Every answer the API gives has its own face:
 *
 *  - verified, with the company: RRA's name, locked, its type and its directors.
 *    When the typed name differs, RRA's spelling is offered first, because the
 *    API refuses a registration whose name is not RRA's.
 *  - verified, with nothing on file: the typed name is the one kept.
 *  - failed: RRA does not know the TIN, said under the field.
 *  - taken: another business on Injishi holds it; Ask Injishi.
 *  - pending: RRA did not answer. Try again, or carry on, because the API
 *    checks the TIN again after the fee.
 *
 * Then "Who is registering it?": the owner, or someone preparing it for the
 * owner, who names them and the owner claims it after approval (ADR-053). For
 * the owner, RRA's answer on whether their ID (from You, the step before) is
 * among the directors for this TIN: listed or not, never the directors' names,
 * because the name matched may be typed (AC-7). The server matches again at
 * creation. Someone not listed registers it for the owner instead.
 */

export type TinView =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; verdict: TinCheckResult };

export function SectionTin({
  typedName,
  onTypedNameChange,
  tin,
  onTinChange,
  view,
  carryOnPending,
  capPick,
  onCapPick,
  onValidate,
  onUseRraName,
  onCheckAnother,
  onCarryOn,
  onAskInjishi,
  isDirector,
  onPrepareForOwner,
  onNext,
  onBack = null,
  onChangeTin,
  error,
  online = true,
}: {
  typedName: string;
  onTypedNameChange: (next: string) => void;
  tin: string;
  onTinChange: (next: string) => void;
  view: TinView;
  /** RRA did not answer and the registrant chose to carry on. */
  carryOnPending: boolean;
  capPick: RegistrantCapacity;
  onCapPick: (next: RegistrantCapacity) => void;
  onValidate: () => void;
  onUseRraName: () => void;
  onCheckAnother: () => void;
  onCarryOn: () => void;
  onAskInjishi: () => void;
  /** RRA's answer for the owner: is the registrant's ID among the directors? True, false, or not known. */
  isDirector: boolean | null;
  /** Switch to "I'm registering it for the owner" when RRA does not list the registrant. */
  onPrepareForOwner: () => void;
  onNext: () => void;
  /** Back: the step before. */
  onBack?: (() => void) | null;
  /** Reopen the TIN field on a checked answer, the digits kept, to check another. */
  onChangeTin: () => void;
  error?: string;
  /** The device has a network. RRA cannot be asked without one, and the section says so (ADR-075 S9). */
  online?: boolean;
}) {
  const digits = normalizeTin(tin);
  const verdict = view.kind === "result" ? view.verdict : null;
  const checking = view.kind === "checking";
  const found: RegistryBusiness | null = verdict?.result === "verified" ? verdict.business : null;
  const differs =
    found !== null && typedName.trim() !== "" && !sameName(typedName, found.legalName);
  const known = verdict?.result === "verified" && !differs;
  const pendingAccepted = verdict?.result === "pending" && carryOnPending;
  const showFields = !known && !pendingAccepted;
  const canValidate = /^\d{9}$/.test(digits);
  const back = onBack ? (
    <Button variant="ghost" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden />
      Back
    </Button>
  ) : null;

  return (
    <>
      {showFields ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registered business name" hint="As you know it. RRA's spelling is the one we keep.">
            <TextInput
              id="register-business-name"
              className="w-full"
              value={typedName}
              disabled={checking}
              onChange={(e) => onTypedNameChange(e.target.value)}
            />
          </Field>
          <Field
            label="TIN"
            hint="9 digits, from your RRA certificate"
            error={verdict?.result === "failed" ? verdict.message : error}
          >
            <TextInput
              id="register-tin"
              className="w-full tabular-nums"
              inputMode="numeric"
              autoComplete="off"
              placeholder="100 000 001"
              value={tin}
              disabled={checking}
              aria-invalid={verdict?.result === "failed" ? true : undefined}
              onChange={(e) => onTinChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canValidate) onValidate();
              }}
            />
          </Field>
        </div>
      ) : null}

      {view.kind === "idle" || verdict?.result === "failed" || verdict?.result === "taken" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {back}
          <Button onClick={onValidate} disabled={!canValidate || !online} aria-describedby={online ? undefined : "register-tin-offline"}>
            Validate with RRA
          </Button>
          {online ? null : <Offline id="register-tin-offline">You're offline. Connect to check the TIN with RRA.</Offline>}
        </div>
      ) : null}

      {checking ? (
        <div role="status" className="flex items-center gap-3 rounded-card bg-secondary px-4 py-3 text-sm">
          <LoaderCircle size={16} aria-hidden className="animate-spin text-accent-text" />
          <span>Asking RRA about TIN {formatTin(digits)}…</span>
        </div>
      ) : null}

      {differs && found ? (
        <>
          <Callout tone="warning" icon={<TriangleAlert size={16} aria-hidden />} title={`RRA has this TIN as ${found.legalName}`}>
            You typed {typedName.trim()}. Use RRA&apos;s name? A registration can only carry the name RRA holds.
          </Callout>
          <div className="flex flex-wrap gap-2">
            {back}
            <Button onClick={onUseRraName}>Use RRA&apos;s name</Button>
            <Button variant="secondary" onClick={onCheckAnother}>
              Check another TIN
            </Button>
          </div>
        </>
      ) : null}

      {verdict?.result === "taken" ? (
        <>
          <Callout tone="danger" icon={<CircleX size={16} aria-hidden />} title="This TIN is already registered on Injishi">
            Only one business on Injishi can hold a TIN. If this one is yours, ask us and a person will look into it.
          </Callout>
          <div>
            <Button variant="secondary" onClick={onAskInjishi}>
              <MessageCircle size={16} aria-hidden />
              Ask Injishi
            </Button>
          </div>
        </>
      ) : null}

      {verdict?.result === "pending" && !carryOnPending ? (
        <>
          <Callout tone="warning" icon={<CloudOff size={16} aria-hidden />} title="We can't reach RRA right now" role="alert">
            Nothing was checked. Try again in a few minutes, or carry on: RRA checks the TIN again once the fee is paid,
            and an officer sees that it was not checked here.
          </Callout>
          <div className="flex flex-wrap gap-2">
            {back}
            <Button variant="secondary" onClick={onValidate} disabled={!online}>
              <RotateCw size={16} aria-hidden />
              Try again
            </Button>
            <Button variant="ghost" onClick={onCarryOn}>
              Carry on without the check
            </Button>
          </div>
        </>
      ) : null}

      {known || pendingAccepted ? (
        <>
          {known ? (
            <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title="RRA knows this TIN">
              {found ? "The name is now locked to RRA's spelling." : "RRA holds no details for it, so the name you typed is the one we keep."}
            </Callout>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-card bg-secondary px-4 py-3 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">{found ? "Name RRA holds" : "Name"}</dt>
            <dd className="flex items-center gap-1.5 font-medium sm:col-span-2">
              {found ? <Lock size={13} aria-hidden /> : null}
              {found ? found.legalName : typedName.trim() || "Not named yet"}
            </dd>
            <dt className="text-muted-foreground">TIN</dt>
            <dd className="flex flex-wrap items-center gap-x-2 font-medium tabular-nums sm:col-span-2">
              {formatTin(digits)}
              {pendingAccepted ? " · not checked yet" : ""}
              <Button variant="link" size="sm" onClick={onChangeTin} className="h-auto min-h-6 px-0">
                Change TIN
              </Button>
            </dd>
            {found?.companyType ? (
              <>
                <dt className="text-muted-foreground">Company type</dt>
                <dd className="font-medium sm:col-span-2">{PSF_COMPANY_TYPE_LABEL[found.companyType]}</dd>
              </>
            ) : null}
            {found && found.directors.length > 0 ? (
              <>
                <dt className="text-muted-foreground">Directors on file</dt>
                <dd className="font-medium sm:col-span-2">{found.directors.map((d) => d.name).join(", ")}</dd>
              </>
            ) : null}
          </dl>
          {found?.generated ? (
            <p className="text-xs text-muted-foreground">Demo: no real register is connected, so this company was generated.</p>
          ) : null}
          {!found ? (
            <Field label="Registered business name" hint="Exactly as it appears on your RRA certificate." error={error}>
              <TextInput
                id="register-business-name-kept"
                className="w-full"
                value={typedName}
                onChange={(e) => onTypedNameChange(e.target.value)}
              />
            </Field>
          ) : null}

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold">Who is registering it?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceTile
                name="registrant-capacity"
                checked={capPick === "owner"}
                icon={<User size={20} aria-hidden />}
                title="I own or direct this business"
                description="You confirm it with your own ID, checked against RRA's directors."
                onSelect={() => onCapPick("owner")}
              />
              <ChoiceTile
                name="registrant-capacity"
                checked={capPick === "on_behalf_of"}
                icon={<Users size={20} aria-hidden />}
                title="I'm registering it for the owner"
                description="You prepare it and name the owner. They claim it once PSF approves it."
                onSelect={() => onCapPick("on_behalf_of")}
              />
            </div>
          </fieldset>
          {capPick === "owner" && isDirector === true ? (
            <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title="You're listed as a director" />
          ) : null}
          {capPick === "owner" && isDirector === false ? (
            <>
              <Callout
                tone="warning"
                icon={<TriangleAlert size={16} aria-hidden />}
                title="You're not listed as a director"
                role="alert"
              >
                RRA does not list your ID among the directors for this TIN. Register it for the owner instead: you
                name them, and they claim it with their own ID once Injishi approves it.
              </Callout>
              <div className="flex flex-wrap items-center gap-2">
                {back}
                <Button onClick={onPrepareForOwner}>Register it for the owner instead</Button>
              </div>
            </>
          ) : (
            <>
              {capPick === "on_behalf_of" && isDirector === false ? (
                <p className="text-sm text-muted-foreground">
                  RRA does not list your ID among the directors for this TIN, so you register it for the owner.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {back}
                <Button onClick={onNext}>Next</Button>
              </div>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

