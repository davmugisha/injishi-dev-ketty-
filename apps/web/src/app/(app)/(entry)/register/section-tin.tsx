"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("registerForms.tin");
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
      {t("back")}
    </Button>
  ) : null;

  return (
    <>
      {showFields ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("nameLabel")} hint={t("nameHint")}>
            <TextInput
              id="register-business-name"
              className="w-full"
              value={typedName}
              disabled={checking}
              onChange={(e) => onTypedNameChange(e.target.value)}
            />
          </Field>
          <Field
            label={t("tinLabel")}
            hint={t("tinHint")}
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
            {t("validate")}
          </Button>
          {online ? null : <Offline id="register-tin-offline">{t("offline")}</Offline>}
        </div>
      ) : null}

      {checking ? (
        <div role="status" className="flex items-center gap-3 rounded-card bg-secondary px-4 py-3 text-sm">
          <LoaderCircle size={16} aria-hidden className="animate-spin text-accent-text" />
          <span>{t("checking", { tin: formatTin(digits) })}</span>
        </div>
      ) : null}

      {differs && found ? (
        <>
          <Callout tone="warning" icon={<TriangleAlert size={16} aria-hidden />} title={t("differsTitle", { name: found.legalName })}>
            {t("differsBody", { typed: typedName.trim() })}
          </Callout>
          <div className="flex flex-wrap gap-2">
            {back}
            <Button onClick={onUseRraName}>{t("useRra")}</Button>
            <Button variant="secondary" onClick={onCheckAnother}>
              {t("checkAnother")}
            </Button>
          </div>
        </>
      ) : null}

      {verdict?.result === "taken" ? (
        <>
          <Callout tone="danger" icon={<CircleX size={16} aria-hidden />} title={t("takenTitle")}>
            {t("takenBody")}
          </Callout>
          <div>
            <Button variant="secondary" onClick={onAskInjishi}>
              <MessageCircle size={16} aria-hidden />
              {t("askInjishi")}
            </Button>
          </div>
        </>
      ) : null}

      {verdict?.result === "pending" && !carryOnPending ? (
        <>
          <Callout tone="warning" icon={<CloudOff size={16} aria-hidden />} title={t("pendingTitle")} role="alert">
            {t("pendingBody")}
          </Callout>
          <div className="flex flex-wrap gap-2">
            {back}
            <Button variant="secondary" onClick={onValidate} disabled={!online}>
              <RotateCw size={16} aria-hidden />
              {t("retry")}
            </Button>
            <Button variant="ghost" onClick={onCarryOn}>
              {t("carryOn")}
            </Button>
          </div>
        </>
      ) : null}

      {known || pendingAccepted ? (
        <>
          {known ? (
            <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title={t("knownTitle")}>
              {found ? t("nameLocked") : t("noDetails")}
            </Callout>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-card bg-secondary px-4 py-3 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">{found ? t("nameRra") : t("name")}</dt>
            <dd className="flex items-center gap-1.5 font-medium sm:col-span-2">
              {found ? <Lock size={13} aria-hidden /> : null}
              {found ? found.legalName : typedName.trim() || t("notNamed")}
            </dd>
            <dt className="text-muted-foreground">TIN</dt>
            <dd className="flex flex-wrap items-center gap-x-2 font-medium tabular-nums sm:col-span-2">
              {formatTin(digits)}
              {pendingAccepted ? t("notChecked") : ""}
              <Button variant="link" size="sm" onClick={onChangeTin} className="h-auto min-h-6 px-0">
                {t("changeTin")}
              </Button>
            </dd>
            {found?.companyType ? (
              <>
                <dt className="text-muted-foreground">{t("companyType")}</dt>
                <dd className="font-medium sm:col-span-2">{PSF_COMPANY_TYPE_LABEL[found.companyType]}</dd>
              </>
            ) : null}
            {found && found.directors.length > 0 ? (
              <>
                <dt className="text-muted-foreground">{t("directors")}</dt>
                <dd className="font-medium sm:col-span-2">{found.directors.map((d) => d.name).join(", ")}</dd>
              </>
            ) : null}
          </dl>
          {found?.generated ? (
            <p className="text-xs text-muted-foreground">{t("demoGenerated")}</p>
          ) : null}
          {!found ? (
            <Field label={t("keptLabel")} hint={t("keptHint")} error={error}>
              <TextInput
                id="register-business-name-kept"
                className="w-full"
                value={typedName}
                onChange={(e) => onTypedNameChange(e.target.value)}
              />
            </Field>
          ) : null}

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold">{t("who")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceTile
                name="registrant-capacity"
                checked={capPick === "owner"}
                icon={<User size={20} aria-hidden />}
                title={t("ownerTitle")}
                description={t("ownerBody")}
                onSelect={() => onCapPick("owner")}
              />
              <ChoiceTile
                name="registrant-capacity"
                checked={capPick === "on_behalf_of"}
                icon={<Users size={20} aria-hidden />}
                title={t("prepTitle")}
                description={t("prepBody")}
                onSelect={() => onCapPick("on_behalf_of")}
              />
            </div>
          </fieldset>
          {capPick === "owner" && isDirector === true ? (
            <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title={t("listed")} />
          ) : null}
          {capPick === "owner" && isDirector === false ? (
            <>
              <Callout
                tone="warning"
                icon={<TriangleAlert size={16} aria-hidden />}
                title={t("notListedTitle")}
                role="alert"
              >
                {t("notListedBody")}
              </Callout>
              <div className="flex flex-wrap items-center gap-2">
                {back}
                <Button onClick={onPrepareForOwner}>{t("forOwner")}</Button>
              </div>
            </>
          ) : (
            <>
              {capPick === "on_behalf_of" && isDirector === false ? (
                <p className="text-sm text-muted-foreground">
                  {t("notListedNote")}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {back}
                <Button onClick={onNext}>{t("next")}</Button>
              </div>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

